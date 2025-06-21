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

  // Extract id from URL - Fixed logic
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'agents');
  console.log('URL parts after filtering:', urlParts);
  
  const id = urlParts.length > 0 ? urlParts[0] : null;
  const hasId = id !== null && id !== '';
  
  let agentId: number | null = null;
  
  // Only try to parse ID if we actually have one
  if (hasId) {
    const parsedId = parseInt(id as string);
    if (isNaN(parsedId)) {
      console.log('Invalid ID: not a number:', id);
      return res.status(400).json({ message: 'Invalid ID format. ID must be a number.' });
    }
    agentId = parsedId;
  }

  console.log('Has ID:', hasId);
  console.log('Parsed agentId:', agentId);

  try {
    // Base route: /api/agents (no ID)
    if (!hasId) {
      if (req.method === 'GET') {
        console.log('Fetching all agents');
        const agents = await storage.getAgents();
        console.log('Retrieved agents count:', agents.length);
        res.status(200).json(agents);
      } else if (req.method === 'POST') {
        const data = validateBody(insertAgentSchema, req, res);
        if (!data) return;
        console.log('Creating new agent with data:', data);
        const agent = await storage.createAgent(data);
        console.log('Created agent:', agent);
        res.status(201).json(agent);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/agents/:id (has ID)
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
        console.log('Updating agent with ID:', agentId, 'Data:', data);
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
    });
  }
}