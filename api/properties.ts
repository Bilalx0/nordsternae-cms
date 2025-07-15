import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertPropertySchema } from '../shared/schema.js';
import { validateBody } from '../server/utils.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== PROPERTIES API HANDLER START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', req.query); // This will now show the query parameters
  console.log('Storage available:', !!storage);
  console.log('Storage error:', storageError);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- ADDED CACHE-CONTROL HEADERS HERE ---
  if (req.method === 'GET') {
    // For GET requests, tell Vercel CDN and browsers NOT to cache this dynamic content aggressively.
    // 'no-store' means don't store anywhere. 'must-revalidate' means always check with origin.
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  } else {
    // For POST, PUT, DELETE, no caching is desired.
    res.setHeader('Cache-Control', 'no-store');
  }
  // --- END ADDED CACHE-CONTROL HEADERS ---

  if (!storage) {
    console.log('Storage unavailable');
    return res.status(500).json({ message: 'Storage service unavailable', storageError });
  }

  // Safely handle req.url
  if (!req.url) {
    console.log('Invalid request: URL is undefined');
    return res.status(400).json({ message: 'Invalid request' });
  }

  // --- START OF MODIFIED ID EXTRACTION ---
  // Get the path part of the URL, excluding the query string
  const pathWithoutQuery = req.url.split('?')[0];

  // Extract id from URL segments after splitting and filtering
  // This correctly isolates path segments like '123' from '/api/properties/123'
  const urlParts = pathWithoutQuery.split('/').filter(part => part && part !== 'api' && part !== 'properties');
  const id = urlParts[0]; // This will be the ID, or undefined if no ID in path

  const hasIdInPath = !!id && typeof id === 'string';
  const propertyIdFromPath = hasIdInPath ? parseInt(id) : null;

  if (hasIdInPath && (propertyIdFromPath === null || isNaN(propertyIdFromPath))) {
    console.log('Invalid ID in path: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID in path' });
  }
  // --- END OF MODIFIED ID EXTRACTION ---

  console.log('Parsed propertyId from path:', propertyIdFromPath);

  try {
    // Base route: /api/properties (handles GET all and GET with query parameters, POST)
    if (!hasIdInPath) { // This condition will now correctly be true for /api/properties?reference=NS2767
      if (req.method === 'GET') {
        console.log('Fetching properties with query filters (if any):', req.query);
        let properties = await storage.getProperties();

        for (const key in req.query) {
          const queryValue = req.query[key];

          if (typeof queryValue === 'string') {
            const lowerCaseQueryValue = queryValue.toLowerCase();

            properties = properties.filter((property: any) => {
              const propertyValue = property[key];
              if (typeof propertyValue === 'string') {
                return propertyValue.toLowerCase().includes(lowerCaseQueryValue);
              }
              if (typeof propertyValue === 'number' && !isNaN(parseFloat(queryValue))) {
                return propertyValue === parseFloat(queryValue);
              }
              if (Array.isArray(propertyValue) && propertyValue.every(item => typeof item === 'string')) {
                return propertyValue.some(item => item.toLowerCase().includes(lowerCaseQueryValue));
              }
              return false;
            });
          }
        }

        console.log('Retrieved properties count after filtering:', properties.length);
        res.status(200).json(properties);

      } else if (req.method === 'POST') {
        const data = validateBody(insertPropertySchema, req, res);
        if (!data) return;
        console.log('Creating new property');
        const property = await storage.createProperty(data);
        console.log('Created property:', property);
        res.status(201).json(property);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/properties/:id (GET single by ID, PUT, DELETE)
    else {
      if (req.method === 'GET') {
        console.log('Querying property with ID from path:', propertyIdFromPath);
        const property = await storage.getProperty(propertyIdFromPath);
        console.log('Retrieved property:', property);
        if (!property) {
          return res.status(404).json({ message: 'Property not found' });
        }
        res.status(200).json(property);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertPropertySchema.partial(), req, res);
        if (!data) return;
        console.log('Updating property with ID from path:', propertyIdFromPath);
        const property = await storage.updateProperty(propertyIdFromPath, data);
        if (!property) {
          return res.status(404).json({ message: 'Property not found' });
        }
        res.status(200).json(property);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete property with ID from path:', propertyIdFromPath);
        const success = await storage.deleteProperty(propertyIdFromPath);
        if (!success) {
          return res.status(404).json({ message: 'Property not found' });
        }
        res.status(204).end();
      } else {
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      storageError,
      timestamp: new Date().toISOString(),
      propertyId: propertyIdFromPath
    });
  }
  console.log('=== PROPERTIES API HANDLER END ===');
}