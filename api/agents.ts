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

  // Extract id from URL
  // This logic is for path-based IDs (e.g., /api/agents/123)
  // Query parameters are handled separately via req.query
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'agents');
  const id = urlParts[0]; // This 'id' is from the path, not query params
  const hasIdInPath = !!id && typeof id === 'string';
  const agentIdFromPath = hasIdInPath ? parseInt(id) : null;

  if (hasIdInPath && agentIdFromPath !== null && isNaN(agentIdFromPath)) {
    console.log('Invalid ID in path: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID in path' });
  }

  console.log('Parsed agentId from path:', agentIdFromPath);

  try {
    // Base route: /api/agents (handles GET all and GET with query parameters, POST)
    if (!hasIdInPath) {
      if (req.method === 'GET') {
        console.log('Fetching agents with query filters (if any):', req.query);
        // Get all agents first
        let agents = await storage.getAgents();

        // Apply filters based on query parameters
        // req.query contains all query parameters as key-value pairs
        // Example: /api/agents?name=John%20Doe&licenseNumber=ALN123
        for (const key in req.query) {
          const queryValue = req.query[key];

          // Ensure the queryValue is a string for filtering, or handle arrays if applicable
          if (typeof queryValue === 'string') {
            const lowerCaseQueryValue = queryValue.toLowerCase();

            agents = agents.filter((agent: any) => {
              const agentValue = agent[key]; // Access the agent's field value

              // Basic case-insensitive string matching
              if (typeof agentValue === 'string') {
                return agentValue.toLowerCase().includes(lowerCaseQueryValue);
              }
              // If it's a number, convert query to number for comparison (e.g., for numerical IDs if applicable)
              if (typeof agentValue === 'number' && !isNaN(parseFloat(queryValue))) {
                return agentValue === parseFloat(queryValue);
              }
              // You might need more specific logic for nested objects or complex types
              return false; // Exclude if type not handled or no match
            });
          }
          // Add more complex filtering logic here if needed (e.g., for specific date ranges, etc.)
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