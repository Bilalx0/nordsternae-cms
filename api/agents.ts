import { VercelRequest, VercelResponse } from '@vercel/node';
import { validateBody } from '../server/utils.js';

// Try to import schema with error handling
let insertAgentSchema: any = null;
let schemaError: string | null = null;

try {
  console.log('Attempting to import agent schema...');
  const schemaModule = await import('../shared/schema.js');
  insertAgentSchema = schemaModule.insertAgentSchema;
  console.log('Agent schema imported:', !!insertAgentSchema);
  if (!insertAgentSchema) {
    schemaError = 'insertAgentSchema not found in schema module';
  }
} catch (error) {
  console.error('Schema import error:', error);
  schemaError = error instanceof Error ? error.message : 'Unknown schema import error';
}

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
  console.log('=== AGENTS API HANDLER START ===');
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

  if (!insertAgentSchema) {
    console.log('Schema unavailable');
    return res.status(500).json({ message: 'Agent schema unavailable', error: schemaError });
  }

  // Safely handle req.url
  if (!req.url) {
    console.log('Invalid request: URL is undefined');
    return res.status(400).json({ message: 'Invalid request' });
  }

  // Extract id from URL - exactly like properties route
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'agents');
  const id = urlParts[0];
  const hasId = !!id && typeof id === 'string';
  const agentId = hasId ? parseInt(id) : null;

  if (hasId && agentId !== null && isNaN(agentId)) {
    console.log('Invalid ID: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID' });
  }

  console.log('Parsed agentId:', agentId);

  try {
    // Base route: /api/agents
    if (!hasId) {
      if (req.method === 'GET') {
        console.log('Fetching all agents');
        
        // Check if storage methods exist
        if (!storage.getAgents) {
          console.log('storage.getAgents method not found');
          return res.status(500).json({ message: 'getAgents method not available' });
        }
        
        const agents = await storage.getAgents();
        console.log('Retrieved agents count:', agents?.length || 0);
        res.status(200).json(agents || []);
      } else if (req.method === 'POST') {
        console.log('Creating new agent');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        // Check if storage methods exist
        if (!storage.createAgent) {
          console.log('storage.createAgent method not found');
          return res.status(500).json({ message: 'createAgent method not available' });
        }
        
        const data = validateBody(insertAgentSchema, req, res);
        if (!data) {
          console.log('Validation failed for agent creation');
          return;
        }
        console.log('Validated data:', JSON.stringify(data, null, 2));
        
        const agent = await storage.createAgent(data);
        console.log('Created agent:', JSON.stringify(agent, null, 2));
        res.status(201).json(agent);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/agents/:id
    else {
      if (req.method === 'GET') {
        console.log('Querying agent with ID:', agentId);
        const agent = await storage.getAgent(agentId);
        console.log('Retrieved agent:', agent);
        if (!agent) {
          return res.status(404).json({ message: 'Agent not found' });
        }
        res.status(200).json(agent);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertAgentSchema.partial(), req, res);
        if (!data) return;
        console.log('Updating agent with ID:', agentId);
        const agent = await storage.updateAgent(agentId, data);
        if (!agent) {
          return res.status(404).json({ message: 'Agent not found' });
        }
        res.status(200).json(agent);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete agent with ID:', agentId);
        const success = await storage.deleteAgent(agentId);
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
      agentId
    });
  }
}