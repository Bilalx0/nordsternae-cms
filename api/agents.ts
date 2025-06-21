import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertEnquirySchema } from '../shared/schema.js';
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
  console.log('=== ENQUIRIES API HANDLER START ===');
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
  const urlParts = normalizedUrl
    .split('/')
    .filter(part => part && part !== 'api' && part !== 'enquiries');
  const id = urlParts[0];
  const hasId = !!id && typeof id === 'string' && id !== '';
  const enquiryId = hasId ? parseInt(id) : null;

  if (hasId && (isNaN(enquiryId) || enquiryId <= 0)) {
    console.log('Invalid ID: not a valid positive number:', id);
    return res.status(400).json({ message: 'Invalid ID', receivedId: id, method: req.method });
  }

  console.log('Parsed enquiryId:', enquiryId);

  try {
    if (!hasId) {
      if (req.method === 'GET') {
        console.log('Getting all enquiries...');
        const enquiries = await storage.getEnquiries();
        console.log('Got enquiries from storage:', enquiries?.length || 0);
        return res.status(200).json(enquiries);
      } else if (req.method === 'POST') {
        console.log('Creating new enquiry...');
        const data = validateBody(insertEnquirySchema, req, res);
        if (!data) return;
        const result = await storage.createEnquiry(data);
        console.log('Created enquiry:', result);
        return res.status(201).json(result);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ message: 'Method not allowed' });
      }
    } else {
      if (req.method === 'GET') {
        console.log('Querying enquiry with ID:', enquiryId);
        const enquiry = await storage.getEnquiry(enquiryId);
        console.log('Retrieved enquiry:', enquiry);
        if (!enquiry) {
          return res.status(404).json({ message: 'Enquiry not found' });
        }
        return res.status(200).json(enquiry);
      } else if (req.method === 'PUT') {
        console.log('Marking enquiry as read with ID:', enquiryId);
        const enquiry = await storage.markEnquiryAsRead(enquiryId);
        if (!enquiry) {
          return res.status(404).json({ message: 'Enquiry not found' });
        }
        return res.status(200).json(enquiry);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete enquiry with ID:', enquiryId);
        const success = await storage.deleteEnquiry(enquiryId);
        if (!success) {
          return res.status(404).json({ message: 'Enquiry not found' });
        }
        return res.status(204).end();
      } else {
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        return res.status(405).json({ message: 'Method not allowed' });
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