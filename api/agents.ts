import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertAgentSchema } from '../shared/schema.js';
import { validateBody } from '../server/utils.js';

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

  if (!req.url) {
    console.log('Invalid request: URL is undefined');
    return res.status(400).json({ message: 'Invalid request' });
  }

  const normalizedUrl = req.url.split('?')[0].replace(/\/+$/, '');
  console.log('Normalized URL:', normalizedUrl);

  const urlParts = normalizedUrl
    .split('/')
    .filter(part => part && part !== 'api' && part !== 'agents');
  console.log('URL parts after filtering:', urlParts);

  const id = urlParts[0];
  const hasId = !!id && typeof id === 'string' && id !== '';
  const agentId: number | null = hasId ? parseInt(id) : null;

  if (hasId && (isNaN(agentId as number) || agentId === null || agentId <= 0)) {
    console.log('Invalid ID: not a valid positive number:', id);
    return res.status(400).json({
      message: 'Invalid ID',
      receivedId: id,
      method: req.method,
      url: req.url,
      normalizedUrl,
    });
  }

  console.log('Parsed agentId:', agentId);

  try {
    if (!hasId && normalizedUrl === '/api/agents') {
      if (req.method === 'GET') {
        console.log('Getting all agents...');
        const agents = await storage.getAgents();
        console.log('Got agents from storage:', agents?.length || 0);
        return res.status(200).json(agents);
      } else if (req.method === 'POST') {
        console.log('Creating new agent...');
        const data = validateBody(insertAgentSchema, req, res);
        if (!data) return;
        const result = await storage.createAgent(data);
        console.log('Created agent:', result);
        return res.status(201).json(result);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ message: 'Method not allowed' });
      }
    } else if (hasId && agentId !== null) { // Explicit null check
      if (req.method === 'GET') {
        console.log('Querying agent with ID:', agentId);
        const agent = await storage.getAgent(agentId); // Safe: agentId is number
        console.log('Retrieved agent:', agent);
        if (!agent) {
          return res.status(404).json({ message: 'Agent not found' });
        }
        return res.status(200).json(agent);
      } else if (req.method === 'PUT') {
        console.log('Updating agent with ID:', agentId);
        const data = validateBody(insertAgentSchema.partial(), req, res);
        if (!data) return;
        const agent = await storage.updateAgent(agentId, data); // Safe: agentId is number
        if (!agent) {
          return res.status(404).json({ message: 'Agent not found' });
        }
        return res.status(200).json(agent);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete agent with ID:', agentId);
        const success = await storage.deleteAgent(agentId); // Safe: agentId is number
        if (!success) {
          return res.status(404).json({ message: 'Agent not found' });
        }
        return res.status(204).end();
      } else {
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ message: 'Method not allowed' });
      }
    } else {
      console.log('Invalid route:', normalizedUrl);
      return res.status(400).json({
        message: 'Invalid route',
        url: req.url,
        normalizedUrl,
        method: req.method,
      });
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