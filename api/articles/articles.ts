import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertArticleSchema } from '../shared/schema.js';
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
  console.log('=== ARTICLES API HANDLER START ===');
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

  // Extract id from URL
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'articles');
  const id = urlParts[0];
  const hasId = !!id && typeof id === 'string';
  const articleId = hasId ? parseInt(id) : null;

  if (hasId && articleId !== null && isNaN(articleId)) {
    console.log('Invalid ID: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID' });
  }

  console.log('Parsed articleId:', articleId);

  try {
    // Base route: /api/articles
    if (!hasId) {
      if (req.method === 'GET') {
        console.log('Fetching all articles');
        const articles = await storage.getArticles();
        console.log('Retrieved articles count:', articles.length);
        res.status(200).json(articles);
      } else if (req.method === 'POST') {
        const data = validateBody(insertArticleSchema, req, res);
        if (!data) return;
        console.log('Creating new article');
        const article = await storage.createArticle(data);
        console.log('Created article:', article);
        res.status(201).json(article);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/articles/:id
    else {
      if (req.method === 'GET') {
        console.log('Querying article with ID:', articleId);
        const article = await storage.getArticle(articleId);
        console.log('Retrieved article:', article);
        if (!article) {
          return res.status(404).json({ message: 'Article not found' });
        }
        res.status(200).json(article);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertArticleSchema.partial(), req, res);
        if (!data) return;
        console.log('Updating article with ID:', articleId);
        const article = await storage.updateArticle(articleId, data);
        if (!article) {
          return res.status(404).json({ message: 'Article not found' });
        }
        res.status(200).json(article);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete article with ID:', articleId);
        const success = await storage.deleteArticle(articleId);
        if (!success) {
          return res.status(404).json({ message: 'Article not found' });
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