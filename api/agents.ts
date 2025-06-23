import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage.js';
import { insertAgentSchema } from '../shared/schema.js';
import { validateBody } from '../server/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id ? parseInt(req.query.id as string) : null;

  if (id !== null) {
    // Handle single agent operations
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    if (req.method === 'GET') {
      try {
        const agent = await storage.getAgent(id);
        if (!agent) {
          return res.status(404).json({ message: 'Agent not found' });
        }
        res.status(200).json(agent);
      } catch (error) {
        res.status(500).json({ message: 'Failed to fetch agent' });
      }
    } else if (req.method === 'PUT') {
      try {
        const data = validateBody(insertAgentSchema.partial(), req, res);
        if (!data) return;
        const agent = await storage.updateAgent(id, data);
        if (!agent) {
          return res.status(404).json({ message: 'Agent not found' });
        }
        res.status(200).json(agent);
      } catch (error) {
        res.status(500).json({ message: 'Failed to update agent' });
      }
    } else if (req.method === 'DELETE') {
      try {
        const success = await storage.deleteAgent(id);
        if (!success) {
          return res.status(404).json({ message: 'Agent not found' });
        }
        res.status(204).end();
      } catch (error) {
        res.status(500).json({ message: 'Failed to delete agent' });
      }
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } else {
    // Handle collection operations
    if (req.method === 'GET') {
      try {
        const agents = await storage.getAgents();
        res.status(200).json(agents);
      } catch (error) {
        res.status(500).json({ message: 'Failed to fetch agents' });
      }
    } else if (req.method === 'POST') {
      const data = validateBody(insertAgentSchema, req, res);
      if (!data) return;
      try {
        const agent = await storage.createAgent(data);
        res.status(201).json(agent);
      } catch (error) {
        res.status(500).json({ message: 'Failed to create agent' });
      }
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  }
}