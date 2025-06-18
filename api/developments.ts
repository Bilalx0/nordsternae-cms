import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertDevelopmentSchema } from '../shared/schema.js';
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
  console.log('=== DEVELOPMENTS API HANDLER START ===');
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
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'developments');
  const id = urlParts[0];
  const hasId = !!id && typeof id === 'string';
  const developmentId = hasId ? parseInt(id) : null;

  if (hasId && developmentId !== null && isNaN(developmentId)) {
    console.log('Invalid ID: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID' });
  }

  console.log('Parsed developmentId:', developmentId);

  try {
    // Base route: /api/developments
    if (!hasId) {
      if (req.method === 'GET') {
        console.log('Fetching all developments');
        const developments = await storage.getDevelopments();
        console.log('Retrieved developments count:', developments.length);
        res.status(200).json(developments);
      } else if (req.method === 'POST') {
        const data = validateBody(insertDevelopmentSchema, req, res);
        if (!data) return;
        console.log('Creating new development');
        const development = await storage.createDevelopment(data);
        console.log('Created development:', development);
        res.status(201).json(development);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/developments/:id
    else {
      if (req.method === 'GET') {
        console.log('Querying development with ID:', developmentId);
        const development = await storage.getDevelopment(developmentId);
        console.log('Retrieved development:', development);
        if (!development) {
          return res.status(404).json({ message: 'Development not found' });
        }
        res.status(200).json(development);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertDevelopmentSchema.partial(), req, res);
        if (!data) return;
        console.log('Updating development with ID:', developmentId);
        const development = await storage.updateDevelopment(developmentId, data);
        if (!development) {
          return res.status(404).json({ message: 'Development not found' });
        }
        res.status(200).json(development);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete development with ID:', developmentId);
        const success = await storage.deleteDevelopment(developmentId);
        if (!success) {
          return res.status(404).json({ message: 'Development not found' });
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