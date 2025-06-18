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
  console.log('Query:', req.query);
  console.log('Storage available:', !!storage);
  console.log('Storage error:', storageError);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!storage) {
    console.log('Storage unavailable');
    return res.status(500).json({ message: 'Storage service unavailable', storageError });
  }

  // Safely handle req.url
  if (!req.url) {
    console.log('Invalid request: URL is undefined');
    return res.status(400).json({ message: 'Invalid request' });
  }

  // Extract id from URL
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'properties');
  const id = urlParts[0];
  const hasId = !!id && typeof id === 'string';
  const propertyId = hasId ? parseInt(id) : null;

  if (hasId && propertyId !== null && isNaN(propertyId)) {
    console.log('Invalid ID: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID' });
  }

  console.log('Parsed propertyId:', propertyId);

  try {
    // Base route: /api/properties
    if (!hasId) {
      if (req.method === 'GET') {
        console.log('Fetching all properties');
        const properties = await storage.getProperties();
        console.log('Retrieved properties count:', properties.length);
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
    // Dynamic route: /api/properties/:id
    else {
      if (req.method === 'GET') {
        console.log('Querying property with ID:', propertyId);
        const property = await storage.getProperty(propertyId);
        console.log('Retrieved property:', property);
        if (!property) {
          return res.status(404).json({ message: 'Property not found' });
        }
        res.status(200).json(property);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertPropertySchema.partial(), req, res);
        if (!data) return;
        console.log('Updating property with ID:', propertyId);
        const property = await storage.updateProperty(propertyId, data);
        if (!property) {
          return res.status(404).json({ message: 'Property not found' });
        }
        res.status(200).json(property);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete property with ID:', propertyId);
        const success = await storage.deleteProperty(propertyId);
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
      propertyId
    });
  }
}