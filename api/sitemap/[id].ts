import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage.js';
import { insertSitemapSchema } from '../../shared/schema.js';
import { validateBody } from '../../server/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = parseInt(req.query.id as string);
  if (isNaN(id)) {
    return res.status(400).json({ message: 'Invalid ID' });
  }

  if (req.method === 'GET') {
    try {
      const sitemapEntry = await storage.getSitemapEntry(id);
      if (!sitemapEntry) {
        return res.status(404).json({ message: 'Sitemap entry not found' });
      }
      res.status(200).json(sitemapEntry);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch sitemap entry' });
    }
  } else if (req.method === 'PUT') {
    try {
      const data = validateBody(insertSitemapSchema.partial(), req, res);
      if (!data) return;
      const sitemapEntry = await storage.updateSitemapEntry(id, data);
      if (!sitemapEntry) {
        return res.status(404).json({ message: 'Sitemap entry not found' });
      }
      res.status(200).json(sitemapEntry);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update sitemap entry' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const success = await storage.deleteSitemapEntry(id);
      if (!success) {
        return res.status(404).json({ message: 'Sitemap entry not found' });
      }
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete sitemap entry' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}