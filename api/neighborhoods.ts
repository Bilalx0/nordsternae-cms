import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertNeighborhoodSchema } from '../shared/schema.js';
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
  console.error('Storage error:', error);
  storageError = error instanceof Error ? error.message : 'Unknown storage import error';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== NEIGHBORHOODS API HANDLER START ===');
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
    return res.status(500).json({ message: 'Storage service unavailable', error: storageError });
  }

  // Safely handle req.url
  if (!req.url) {
    console.log('Invalid request: URL is undefined');
    return res.status(400).json({ message: 'Invalid request' });
  }

  // Extract id from URL
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'neighborhoods');
  const id = urlParts[0];
  const hasId = !!id && typeof id === 'string';
  const neighborhoodId = hasId ? parseInt(id) : null;

  if (hasId && neighborhoodId !== null && isNaN(neighborhoodId)) {
    console.log('Invalid ID: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID' });
  }

  console.log('Parsed neighborhoodId:', neighborhoodId);

  try {
    // Base route: /api/neighborhoods
    if (!hasId) {
      if (req.method === 'GET') {
        console.log('Fetching all neighborhoods');
        const neighborhoods = await storage.getNeighborhoods();
        console.log('Retrieved neighborhoods count:', neighborhoods.length);
        res.status(200).json(neighborhoods);
      } else if (req.method === 'POST') {
        const data = validateBody(insertNeighborhoodSchema, req, res);
        if (!data) return;
        console.log('Creating new neighborhood');
        const neighborhood = await storage.createNeighborhood(data);
        console.log('Created neighborhood:', neighborhood);
        res.status(201).json(neighborhood);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/neighborhoods/:id
    else {
      if (req.method === 'GET') {
        console.log('Querying neighborhood with ID:', neighborhoodId);
        const neighborhood = await storage.getNeighborhood(neighborhoodId);
        console.log('Retrieved neighborhood:', neighborhood);
        if (!neighborhood) {
          return res.status(404).json({ message: 'Neighborhood not found' });
        }
        res.status(200).json(neighborhood);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertNeighborhoodSchema.partial(), req, res);
        if (!data) return;
        console.log('Updating neighborhood with ID:', neighborhoodId);
        const neighborhood = await storage.updateNeighborhood(neighborhoodId, data);
        if (!neighborhood) {
          return res.status(404).json({ message: 'Neighborhood not found' });
        }
        res.status(200).json(neighborhood);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete neighborhood with ID:', neighborhoodId);
        const success = await storage.deleteNeighborhood(neighborhoodId);
        if (!success) {
          return res.status(404).json({ message: 'Neighborhood not found' });
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
    });
  }
}