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
  console.log('Query:', req.query); // This will show the query parameters
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

  // Extract id from URL path. This should only happen for paths like /api/agents/123
  // It should NOT try to parse query parameters as part of the path.
  const pathParts = req.url.split('?')[0].split('/').filter(part => part); // Get path before query, then split
  let agentIdFromPath: number | null = null;
  let hasIdInPath = false;

  // Find the segment immediately after 'agents' that looks like an ID
  const agentsIndex = pathParts.indexOf('agents');
  if (agentsIndex !== -1 && agentsIndex + 1 < pathParts.length) {
    const potentialId = pathParts[agentsIndex + 1];
    const parsedId = parseInt(potentialId);
    if (!isNaN(parsedId)) {
      agentIdFromPath = parsedId;
      hasIdInPath = true;
    } else {
      // If there's a segment after 'agents' but it's not a valid number, it's an invalid path.
      console.log('Invalid ID in path: not a number:', potentialId);
      return res.status(400).json({ message: 'Invalid ID in path' });
    }
  }

  console.log('Parsed agentId from path:', agentIdFromPath);
  console.log('Has ID in path:', hasIdInPath);

  try {
    // Base route: /api/agents (handles GET all and GET with query parameters, POST)
    if (!hasIdInPath) {
      if (req.method === 'GET') {
        console.log('Fetching agents with query filters (if any):', req.query);
        let agents = await storage.getAgents();

        for (const key in req.query) {
          const queryValue = req.query[key];

          if (typeof queryValue === 'string') {
            const lowerCaseQueryValue = queryValue.toLowerCase();

            agents = agents.filter((agent: any) => {
              const agentValue = agent[key];

              if (typeof agentValue === 'string') {
                return agentValue.toLowerCase().includes(lowerCaseQueryValue);
              }
              if (typeof agentValue === 'number' && !isNaN(parseFloat(queryValue))) {
                return agentValue === parseFloat(queryValue);
              }
              return false;
            });
          }
        }

        console.log('Retrieved agents count after filtering:', agents.length);
        res.status(200).json(agents);

      } else if (req.method === 'POST') {
        const data = validateBody(insertAgentSchema, req, res);
        if (!data) return;
        console.log('Creating new agent');
        const agent = await storage.createAgent(data);
        console.log('Created agent:', agent);
        res.status(201).json(agent);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/agents/:id (GET single by ID, PUT, DELETE)
    else {
      // Ensure agentIdFromPath is not null for these operations
      if (agentIdFromPath === null) {
        return res.status(400).json({ message: 'Agent ID is required for this operation' });
      }

      if (req.method === 'GET') {
        console.log('Querying agent with ID from path:', agentIdFromPath);
        const agent = await storage.getAgent(agentIdFromPath);
        console.log('Retrieved agent:', agent);
        if (!agent) {
          return res.status(404).json({ message: 'Agent not found' });
        }
        res.status(200).json(agent);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertAgentSchema.partial(), req, res);
        if (!data) return;
        console.log('Updating agent with ID from path:', agentIdFromPath);
        const agent = await storage.updateAgent(agentIdFromPath, data);
        if (!agent) {
          return res.status(404).json({ message: 'Agent not found' });
        }
        res.status(200).json(agent);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete agent with ID from path:', agentIdFromPath);
        const success = await storage.deleteAgent(agentIdFromPath);
        if (!success) {
          return res.status(404).json({ message: 'Agent not found' });
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
      agentId: agentIdFromPath // Use agentIdFromPath for consistency
    });
  }
  console.log('=== AGENTS API HANDLER END ===');
}