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

  // Extract id from URL path (e.g., /api/articles/123)
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'articles');
  const id = urlParts[0];
  const hasIdInPath = !!id && typeof id === 'string';
  const articleIdFromPath = hasIdInPath ? parseInt(id) : null;

  if (hasIdInPath && articleIdFromPath !== null && isNaN(articleIdFromPath)) {
    console.log('Invalid ID in path: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID in path' });
  }

  console.log('Parsed articleId from path:', articleIdFromPath);

  try {
    // Base route: /api/articles (handles GET all, GET with query parameters including slug, POST)
    if (!hasIdInPath) {
      if (req.method === 'GET') {
        console.log('Fetching articles with query filters:', req.query);

        // Check for slug query parameter
        const { slug } = req.query;
        if (slug && typeof slug === 'string') {
          console.log(`Fetching article by slug: ${slug}`);
          const articles = await storage.getArticles();
          const article = articles.find((a: any) => a.slug === slug) || null;

          if (!article) {
            console.log(`No article found for slug: ${slug}`);
            return res.status(404).json({ message: `Article not found for slug: ${slug}` });
          }

          console.log(`Found article for slug: ${slug}`, article);
          return res.status(200).json(article); // Return single article object
        }

        // Handle other query parameters (e.g., category, author)
        let articles = await storage.getArticles();
        for (const key in req.query) {
          if (key === 'slug') continue; // Skip slug as it's handled above
          const queryValue = req.query[key];

          if (typeof queryValue === 'string') {
            const lowerCaseQueryValue = queryValue.toLowerCase();
            articles = articles.filter((article: any) => {
              const articleValue = article[key];
              if (typeof articleValue === 'string') {
                return articleValue.toLowerCase().includes(lowerCaseQueryValue);
              }
              if (typeof articleValue === 'number' && !isNaN(parseFloat(queryValue))) {
                return articleValue === parseFloat(queryValue);
              }
              if (Array.isArray(articleValue) && articleValue.every(item => typeof item === 'string')) {
                return articleValue.some(item => item.toLowerCase().includes(lowerCaseQueryValue));
              }
              return false;
            });
          }
        }

        console.log('Retrieved articles count after filtering:', articles.length);
        res.status(200).json(articles);

      } else if (req.method === 'POST') {
        const data = validateBody(insertArticleSchema, req, res);
        if (!data) return;
        console.log('Creating new article with data:', data);
        const article = await storage.createArticle(data);
        console.log('Created article:', article);
        res.status(201).json(article);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/articles/:id (GET single by ID, PUT, DELETE)
    else {
      if (req.method === 'GET') {
        console.log('Querying article with ID from path:', articleIdFromPath);
        const article = await storage.getArticle(articleIdFromPath);
        console.log('Retrieved article:', article);
        if (!article) {
          return res.status(404).json({ message: 'Article not found' });
        }
        res.status(200).json(article);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertArticleSchema.partial(), req, res);
        if (!data) return;
        console.log('Updating article with ID from path:', articleIdFromPath, 'Data:', data);
        const article = await storage.updateArticle(articleIdFromPath, data);
        if (!article) {
          return res.status(404).json({ message: 'Article not found' });
        }
        res.status(200).json(article);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete article with ID from path:', articleIdFromPath);
        const success = await storage.deleteArticle(articleIdFromPath);
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
      articleId: articleIdFromPath,
    });
  }
  console.log('=== ARTICLES API HANDLER END ===');
}