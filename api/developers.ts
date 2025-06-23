import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertDeveloperSchema } from '../shared/schema.js';
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
  console.log('=== DEVELOPERS API HANDLER START ===');
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
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'developers');
  const id = urlParts[0];
  const hasId = !!id && typeof id === 'string';
  const developerId = hasId ? parseInt(id) : null;

  if (hasId && developerId !== null && isNaN(developerId)) {
    console.log('Invalid ID: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID' });
  }

  console.log('Parsed developerId:', developerId);

  try {
    // Base route: /api/developers
    if (!hasId) {
      if (req.method === 'GET') {
        console.log('Fetching all developers');
        const developers = await storage.getDevelopers();
        console.log('Retrieved developers count:', developers.length);
        res.status(200).json(developers);
      } else if (req.method === 'POST') {
        const data = validateBody(insertDeveloperSchema, req, res);
        if (!data) return;
        console.log('Creating new developer');
        const developer = await storage.createDeveloper(data);
        console.log('Created developer:', developer);
        res.status(201).json(developer);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/developers/:id
    else {
      if (req.method === 'GET') {
        console.log('Querying developer with ID:', developerId);
        const developer = await storage.getDeveloper(developerId);
        console.log('Retrieved developer:', developer);
        if (!developer) {
          return res.status(404).json({ message: 'Developer not found' });
        }
        res.status(200).json(developer);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertDeveloperSchema.partial(), req, res);
        if (!data) return;
        console.log('Updating developer with ID:', developerId);
        const developer = await storage.updateDeveloper(developerId, data);
        if (!developer) {
          return res.status(404).json({ message: 'Developer not found' });
        }
        res.status(200).json(developer);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete developer with ID:', developerId);
        const success = await storage.deleteDeveloper(developerId);
        if (!success) {
          return res.status(404).json({ message: 'Developer not found' });
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