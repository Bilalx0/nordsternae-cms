import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertPropertySchema } from '../../shared/schema.js';
import { validateBody } from '../../server/utils.js';
import { Property } from '../../shared/schema.js'; // Import the Property type

// Try to import storage with proper error handling
let storage: any = null;
let storageError: string | null = null;

try {
  console.log('Attempting to import storage...');
  const storageModule = await import('../../server/storage.js');
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

  try {
    if (!storage) {
      return res.status(500).json({ message: 'Storage service unavailable', storageError });
    }

    // Handle base route /api/properties
    if (req.method === 'GET') {
      try {
        console.log('Fetching all properties');
        const properties = await storage.getProperties();
        console.log('Retrieved properties count:', properties.length);
        res.status(200).json(properties);
      } catch (error) {
        console.error('GET all properties error:', error);
        res.status(500).json({ message: 'Failed to fetch properties' });
      }
    } else if (req.method === 'POST') {
      const data = validateBody(insertPropertySchema, req, res);
      if (!data) return;
      try {
        console.log('Creating new property');
        const property = await storage.createProperty(data);
        console.log('Created property:', property);
        res.status(201).json(property);
      } catch (error) {
        console.error('POST property error:', error);
        res.status(500).json({ message: 'Failed to create property' });
      }
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      storageError: storageError,
      timestamp: new Date().toISOString()
    });
  }
}