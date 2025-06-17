import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertPropertySchema } from '../../shared/schema.js';
import { validateBody } from '../../server/utils.js';
import { storage } from '../../server/storage.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== [PROPERTYID] API HANDLER START ===');
  console.log('Raw URL:', req.url);
  console.log('Raw Query:', req.query);
  console.log('Method:', req.method);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!storage) {
    console.log('Storage unavailable');
    return res.status(500).json({ message: 'Storage service unavailable' });
  }

  // Safely handle req.url
  if (!req.url) {
    console.log('Invalid request: URL is undefined');
    return res.status(400).json({ message: 'Invalid request' });
  }

  // Extract id from URL
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'properties');
  const id = urlParts[0];
  if (!id || typeof id !== 'string') {
    console.log('Invalid ID from URL:', id);
    return res.status(400).json({ message: 'ID must be a string' });
  }

  const propertyId = parseInt(id);
  if (isNaN(propertyId)) {
    console.log('Invalid ID: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID' });
  }

  console.log('Parsed propertyId:', propertyId);

  if (req.method === 'GET') {
    try {
      console.log('Querying property with ID:', propertyId);
      const property = await storage.getProperty(propertyId);
      console.log('Retrieved property:', property);
      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }
      res.status(200).json(property);
    } catch (error) {
      console.error('GET property error:', error);
      res.status(500).json({ message: 'Failed to fetch property' });
    }
  } else if (req.method === 'PUT') {
    const data = validateBody(insertPropertySchema.partial(), req, res);
    if (!data) return;
    try {
      console.log('Updating property with ID:', propertyId);
      const property = await storage.updateProperty(propertyId, data);
      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }
      res.status(200).json(property);
    } catch (error) {
      console.error('PUT property error:', error);
      res.status(500).json({ message: 'Failed to update property' });
    }
  } else if (req.method === 'DELETE') {
    try {
      console.log('Attempting to delete property with ID:', propertyId);
      const success = await storage.deleteProperty(propertyId);
      if (!success) {
        return res.status(404).json({ message: 'Property not found' });
      }
      res.status(204).end();
    } catch (error) {
      console.error('DELETE error:', error);
      res.status(500).json({ message: 'Failed to delete property' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    res.status(405).json({ message: 'Method not allowed' });
  }
}