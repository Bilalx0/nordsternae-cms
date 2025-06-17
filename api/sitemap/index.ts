import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage.js';
import { insertSitemapSchema } from '../../shared/schema.js';
import { validateBody } from '../../server/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const sitemapEntries = await storage.getSitemapEntries();
      res.status(200).json(sitemapEntries);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch sitemap entries' });
    }
  } else if (req.method === 'POST') {
    const data = validateBody(insertSitemapSchema, req, res);
    if (!data) return;
    try {
      const sitemapEntry = await storage.createSitemapEntry(data);
      res.status(201).json(sitemapEntry);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create sitemap entry' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}