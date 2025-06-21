import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertAgentSchema } from '../shared/schema.js';
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
  console.log('=== AGENTS API HANDLER START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query params:', req.query);
  console.log('Storage available:', !!storage);

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

  try {
    // Check if this is a base route request (no ID in path)
    // For Vercel dynamic routes, the ID would be in req.query if the file is named [id].js
    // For static routes, we need to parse the URL
    
    let agentId: number | null = null;
    let isBaseRoute = true;

    // Method 1: Check if there's an id in query params (for dynamic routes like [id].js)
    if (req.query.id) {
      const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
      const parsedId = parseInt(id);
      if (!isNaN(parsedId)) {
        agentId = parsedId;
        isBaseRoute = false;
      }
    }
    
    // Method 2: Parse from URL path (for static routes)
    if (isBaseRoute && req.url) {
      const url = req.url.split('?')[0]; // Remove query string
      const pathSegments = url.split('/').filter(segment => segment !== '');
      
      // Look for pattern like /api/agents/123
      const agentsIndex = pathSegments.findIndex(segment => segment === 'agents');
      if (agentsIndex !== -1 && agentsIndex + 1 < pathSegments.length) {
        const idSegment = pathSegments[agentsIndex + 1];
        const parsedId = parseInt(idSegment);
        if (!isNaN(parsedId)) {
          agentId = parsedId;
          isBaseRoute = false;
        }
      }
    }

    console.log('Is base route:', isBaseRoute);
    console.log('Agent ID:', agentId);

    // Handle base route operations (no ID)
    if (isBaseRoute) {
      switch (req.method) {
        case 'GET':
          console.log('Fetching all agents');
          const agents = await storage.getAgents();
          console.log('Retrieved agents count:', agents?.length || 0);
          return res.status(200).json(agents || []);

        case 'POST':
          console.log('Creating new agent');
          console.log('Request body:', req.body);
          const data = validateBody(insertAgentSchema, req, res);
          if (!data) {
            console.log('Validation failed');
            return;
          }
          console.log('Validated data:', data);
          const newAgent = await storage.createAgent(data);
          console.log('Created agent:', newAgent);
          return res.status(201).json(newAgent);

        default:
          res.setHeader('Allow', ['GET', 'POST']);
          return res.status(405).json({ message: 'Method not allowed' });
      }
    }
    
    // Handle ID-specific operations
    else {
      switch (req.method) {
        case 'GET':
          console.log('Fetching agent with ID:', agentId);
          const agent = await storage.getAgent(agentId);
          if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
          }
          return res.status(200).json(agent);

        case 'PUT':
          console.log('Updating agent with ID:', agentId);
          const updateData = validateBody(insertAgentSchema.partial(), req, res);
          if (!updateData) return;
          
          const updatedAgent = await storage.updateAgent(agentId, updateData);
          if (!updatedAgent) {
            return res.status(404).json({ message: 'Agent not found' });
          }
          return res.status(200).json(updatedAgent);

        case 'DELETE':
          console.log('Deleting agent with ID:', agentId);
          const deleted = await storage.deleteAgent(agentId);
          if (!deleted) {
            return res.status(404).json({ message: 'Agent not found' });
          }
          return res.status(204).end();

        default:
          res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
          return res.status(405).json({ message: 'Method not allowed' });
      }
    }

  } catch (error) {
    console.error('Handler error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      storageError,
      timestamp: new Date().toISOString(),
    });
  }
}