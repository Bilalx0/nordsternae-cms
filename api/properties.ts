import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertPropertySchema } from '../shared/schema.js';
import { validateBody } from '../server/utils.js';
import { Readable } from 'stream';
import Redis from 'ioredis';
import { queryWithBreaker } from '../server/storage.js';

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Initialize storage with error handling
let storage: any = null;
let storageError: string | null = null;

try {
  console.log('Attempting to import storage...');
  const storageModule = await import('../server/storage.js');
  storage = storageModule.storage;
  console.log('Storage imported successfully:', !!storage);
} catch (error) {
  console.error('Failed to import storage:', error);
  storageError = error instanceof Error ? error.message : 'Unknown storage import error';
}

// Request deduplication middleware
const dedupeRequests = async (req: VercelRequest, key: string, fn: () => Promise<any>) => {
  const cacheKey = `req:${req.method}:${req.url}:${key}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  const result = await fn();
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 10); // 10s dedupe window
  return result;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  console.log('=== PROPERTIES API HANDLER START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', req.query);
  console.log('Storage available:', !!storage);
  console.log('Storage error:', storageError);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Encoding', 'gzip'); // Enable compression

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Cache-control headers
  res.setHeader('Cache-Control', req.method === 'GET' ? 'public, max-age=300' : 'no-store');

  if (!storage) {
    console.log('Storage unavailable');
    return res.status(500).json({
      message: 'Storage service unavailable',
      storageError,
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    });
  }

  if (!req.url) {
    console.log('Invalid request: URL is undefined');
    return res.status(400).json({
      message: 'Invalid request',
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    });
  }

  // Extract ID from URL
  const pathWithoutQuery = req.url.split('?')[0];
  const urlParts = pathWithoutQuery.split('/').filter(part => part && part !== 'api' && part !== 'properties');
  const id = urlParts[0];
  const hasIdInPath = !!id && typeof id === 'string';
  const propertyIdFromPath = hasIdInPath ? parseInt(id) : null;

  if (hasIdInPath && (propertyIdFromPath === null || isNaN(propertyIdFromPath))) {
    console.log('Invalid ID in path: not a number after parsing:', id);
    return res.status(400).json({
      message: 'Invalid ID in path',
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    });
  }

  console.log('Parsed propertyId from path:', propertyIdFromPath);

  try {
    // Base route: /api/properties
    if (!hasIdInPath) {
      if (req.method === 'GET') {
        console.log('Fetching properties with query filters (if any):', req.query);
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 50;
        const filters = { ...req.query };
        delete filters.page;
        delete filters.pageSize;

        const cacheKey = `properties:${page}:${pageSize}:${JSON.stringify(filters)}`;
        const properties = await dedupeRequests(req, cacheKey, async () => {
          const dbStart = Date.now();
          const result = await queryWithBreaker(() =>
            storage.getProperties(page, pageSize, filters)
          );
          const dbDuration = Date.now() - dbStart;
          console.log(`Database query took ${dbDuration}ms`);
          return result;
        });

        // Stream response
        res.setHeader('Content-Type', 'application/json');
        const stream = new Readable({
          read() {
            this.push(JSON.stringify(properties));
            this.push(null);
          },
        });
        stream.pipe(res);
        console.log('Retrieved properties count:', properties.length);
        console.log(`Total processing time: ${Date.now() - startTime}ms`);

      } else if (req.method === 'POST') {
        const data = validateBody(insertPropertySchema, req, res);
        if (!data) return;
        console.log('Creating new property');
        const dbStart = Date.now();
        const property = await queryWithBreaker(() => storage.createProperty(data));
        const dbDuration = Date.now() - dbStart;
        console.log('Created property:', property);
        console.log(`Database query took ${dbDuration}ms`);
        await redis.del('properties_list'); // Invalidate cache
        res.status(201).json(property);
        console.log(`Total processing time: ${Date.now() - startTime}ms`);

      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({
          message: 'Method not allowed',
          timestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
        });
      }
    }
    // Dynamic route: /api/properties/:id
    else {
      if (req.method === 'GET') {
        console.log('Querying property with ID from path:', propertyIdFromPath);
        const cacheKey = `property:${propertyIdFromPath}`;
        const property = await dedupeRequests(req, cacheKey, async () => {
          const dbStart = Date.now();
          const result = await queryWithBreaker(() => storage.getProperty(propertyIdFromPath));
          const dbDuration = Date.now() - dbStart;
          console.log(`Database query took ${dbDuration}ms`);
          return result;
        });
        console.log('Retrieved property:', property);
        if (!property) {
          return res.status(404).json({
            message: 'Property not found',
            timestamp: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
          });
        }
        res.status(200).json(property);
        console.log(`Total processing time: ${Date.now() - startTime}ms`);

      } else if (req.method === 'PUT') {
        const data = validateBody(insertPropertySchema.partial(), req, res);
        if (!data) return;
        console.log('Updating property with ID from path:', propertyIdFromPath);
        const dbStart = Date.now();
        const property = await queryWithBreaker(() =>
          storage.updateProperty(propertyIdFromPath, data)
        );
        const dbDuration = Date.now() - dbStart;
        console.log(`Database query took ${dbDuration}ms`);
        await redis.del('properties_list'); // Invalidate cache
        if (!property) {
          return res.status(404).json({
            message: 'Property not found',
            timestamp: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
          });
        }
        res.status(200).json(property);
        console.log(`Total processing time: ${Date.now() - startTime}ms`);

      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete property with ID from path:', propertyIdFromPath);
        const dbStart = Date.now();
        const success = await queryWithBreaker(() => storage.deleteProperty(propertyIdFromPath));
        const dbDuration = Date.now() - dbStart;
        console.log(`Database query took ${dbDuration}ms`);
        await redis.del('properties_list'); // Invalidate cache
        if (!success) {
          return res.status(404).json({
            message: 'Property not found',
            timestamp: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
          });
        }
        res.status(204).end();
        console.log(`Total processing time: ${Date.now() - startTime}ms`);

      } else {
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        res.status(405).json({
          message: 'Method not allowed',
          timestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
        });
      }
    }
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      storageError,
      timestamp: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    });
  }
  console.log('=== PROPERTIES API HANDLER END ===');
}