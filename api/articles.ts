import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertArticleSchema } from '../shared/schema.js'; // Assuming this path is correct
import { validateBody } from '../server/utils.js'; // Assuming this path is correct

// Initialize storage with error handling
// This section attempts to dynamically import the storage module.
// If the import fails (e.g., file not found, syntax error in storage.js),
// it catches the error and sets storageError, preventing the server from crashing
// and allowing the handler to return a 500 error for subsequent requests.
let storage: any = null;
let storageError: string | null = null;

try {
  console.log('Attempting to import storage...');
  // Dynamic import is used here. 'await' is necessary because import() returns a Promise.
  const storageModule = await import('../server/storage.js'); // Assuming this path is correct
  storage = storageModule.storage;
  console.log('Storage imported successfully:', !!storage);
} catch (error) {
  console.error('Storage error:', error);
  // Capture the error message for debugging and client response
  storageError = error instanceof Error ? error.message : 'Unknown storage import error';
}

/**
 * Main handler function for the /api/articles endpoint.
 * This function processes HTTP requests for article management (CRUD operations).
 * @param req VercelRequest object containing request details (method, url, query, body).
 * @param res VercelResponse object for sending responses.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== ARTICLES API HANDLER START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', req.query);
  console.log('Storage available:', !!storage);
  console.log('Storage error:', storageError);

  // Enable CORS (Cross-Origin Resource Sharing) for all origins.
  // This allows requests from any domain to access this API.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS preflight requests.
  // Browsers send an OPTIONS request before actual cross-origin requests
  // to check which methods and headers are allowed.
  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // Respond with 200 OK and headers
  }

  // If storage failed to initialize, return a 500 Internal Server Error.
  if (!storage) {
    console.log('Storage unavailable');
    return res.status(500).json({ message: 'Storage service unavailable', error: storageError });
  }

  // Validate that req.url is defined.
  if (!req.url) {
    console.log('Invalid request: URL is undefined');
    return res.status(400).json({ message: 'Invalid request' });
  }

  // --- START OF CRITICAL FIX FOR URL PARSING ---
  // This section correctly extracts the ID from the URL path,
  // preventing query parameters from being misinterpreted as path IDs.

  // 1. Get the path part of the URL, excluding the query string.
  //    Example: "/api/articles/123?param=value" becomes "/api/articles/123"
  //    Example: "/api/articles?slug=test" becomes "/api/articles"
  const pathWithoutQuery = req.url.split('?')[0];

  // 2. Split the path into segments and filter out empty strings and
  //    the fixed 'api' and 'articles' parts.
  //    For "/api/articles/123", urlParts will be ["123"]
  //    For "/api/articles", urlParts will be []
  const urlParts = pathWithoutQuery.split('/').filter(part => part && part !== 'api' && part !== 'articles');

  // 3. The first remaining part is considered the ID if it exists.
  const id = urlParts[0];
  const hasIdInPath = !!id && typeof id === 'string'; // Check if an ID string was found
  const articleIdFromPath = hasIdInPath ? parseInt(id) : null; // Attempt to parse it as an integer

  // 4. If an ID was present in the path but it's not a valid number, return a 400 error.
  if (hasIdInPath && (articleIdFromPath === null || isNaN(articleIdFromPath))) {
    console.log('Invalid ID in path: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID in path' });
  }
  // --- END OF CRITICAL FIX FOR URL PARSING ---

  console.log('Parsed articleId from path:', articleIdFromPath);

  try {
    // --- Base route: /api/articles (handles GET all, GET with query parameters including slug, POST) ---
    if (!hasIdInPath) { // This condition is true if no ID was found in the URL path
      if (req.method === 'GET') {
        console.log('Fetching articles with query filters:', req.query);

        // Handle 'slug' query parameter specifically.
        // If a slug is provided, attempt to find a single article by that slug.
        const { slug } = req.query;
        if (slug && typeof slug === 'string' && slug.trim() !== '') {
          console.log(`Fetching article by slug: ${slug}`);
          const articles = await storage.getArticles(); // Get all articles
          // Find the article with a matching slug (case-sensitive as per current logic)
          const article = articles.find((a: { slug: string }) => a.slug === slug) || null;

          if (!article) {
            console.log(`No article found for slug: ${slug}`);
            return res.status(404).json({ message: `Article not found for slug: ${slug}` });
          }

          // Ensure image fields have default empty arrays if not present
          // This prevents potential errors if these fields are missing in stored data.
          article.tileImage = article.tileImage || [{ downloadURL: '/fallback-image.jpg' }];
          article.inlineImages = article.inlineImages || [];

          console.log(`Found article for slug: ${slug}`, article);
          return res.status(200).json(article); // Return the single article object
        }

        // Handle other general query parameters (e.g., category, author, tags).
        // This filters the articles based on any provided query parameters.
        let articles = await storage.getArticles(); // Start with all articles
        for (const key in req.query) {
          if (key === 'slug') continue; // Skip 'slug' as it's handled above
          const queryValue = req.query[key];

          if (typeof queryValue === 'string') {
            const lowerCaseQueryValue = queryValue.toLowerCase();
            articles = articles.filter((article: Record<string, unknown>) => {
              const articleValue = article[key];
              // Filter logic for different data types:
              // - String: case-insensitive partial match
              // - Number: exact match
              // - Array of Strings: any item in array has case-insensitive partial match
              if (typeof articleValue === 'string') {
                return articleValue.toLowerCase().includes(lowerCaseQueryValue);
              }
              if (typeof articleValue === 'number' && !isNaN(parseFloat(queryValue))) {
                return articleValue === parseFloat(queryValue);
              }
              if (Array.isArray(articleValue) && articleValue.every(item => typeof item === 'string')) {
                return articleValue.some(item => item.toLowerCase().includes(lowerCaseQueryValue));
              }
              return false; // If type is not string, number, or array of strings, don't include
            });
          }
        }

        // Ensure image fields for all filtered articles before sending the response.
        articles.forEach((article: { tileImage: any; inlineImages: any[] }) => {
          article.tileImage = article.tileImage || [{ downloadURL: '/fallback-image.jpg' }];
          article.inlineImages = article.inlineImages || [];
        });

        console.log('Retrieved articles count after filtering:', articles.length);
        res.status(200).json(articles); // Return the filtered list of articles

      } else if (req.method === 'POST') {
        // Handle POST requests to create a new article.
        // Validate the request body against the insertArticleSchema.
        const data = validateBody(insertArticleSchema, req, res);
        if (!data) return; // If validation fails, validateBody already sends a response

        console.log('Creating new article with data:', data);
        const article = await storage.createArticle(data); // Call storage to create
        console.log('Created article:', article);
        res.status(201).json(article); // Respond with 201 Created and the new article
      } else {
        // For any other unsupported method on the base path, return 405 Method Not Allowed.
        res.setHeader('Allow', ['GET', 'POST']); // Inform client of allowed methods
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // --- Dynamic route: /api/articles/:id (GET single by ID, PUT, DELETE) ---
    else {
      // This block is executed only if a valid numeric ID was found in the path.

      if (req.method === 'GET') {
        // Handle GET requests for a specific article by ID.
        console.log('Querying article with ID from path:', articleIdFromPath);
        const article = await storage.getArticle(articleIdFromPath); // Fetch by ID
        if (!article) {
          return res.status(404).json({ message: 'Article not found' }); // Not found
        }
        // Ensure image fields before returning
        article.tileImage = article.tileImage || [{ downloadURL: '/fallback-image.jpg' }];
        article.inlineImages = article.inlineImages || [];
        console.log('Retrieved article:', article);
        res.status(200).json(article); // Return the found article
      } else if (req.method === 'PUT') {
        // Handle PUT requests to update an article by ID.
        // Use partial schema for updates, allowing only some fields to be provided.
        const data = validateBody(insertArticleSchema.partial(), req, res);
        if (!data) return;

        console.log('Updating article with ID from path:', articleIdFromPath, 'Data:', data);
        const article = await storage.updateArticle(articleIdFromPath, data); // Update
        if (!article) {
          return res.status(404).json({ message: 'Article not found' }); // Not found
        }
        // Ensure image fields before returning
        article.tileImage = article.tileImage || [{ downloadURL: '/fallback-image.jpg' }];
        article.inlineImages = article.inlineImages || [];
        res.status(200).json(article); // Return the updated article
      } else if (req.method === 'DELETE') {
        // Handle DELETE requests to remove an article by ID.
        console.log('Attempting to delete article with ID from path:', articleIdFromPath);
        const success = await storage.deleteArticle(articleIdFromPath); // Delete
        if (!success) {
          return res.status(404).json({ message: 'Article not found' }); // Not found
        }
        res.status(204).end(); // 204 No Content for successful deletion
      } else {
        // For any other unsupported method on the dynamic path, return 405.
        res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
  } catch (error) {
    // Catch any unexpected errors during request processing.
    console.error('Handler error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      storageError, // Include storage error status for debugging
      timestamp: new Date().toISOString(),
      articleId: articleIdFromPath, // Include the ID being processed
    });
  }
  console.log('=== ARTICLES API HANDLER END ===');
}
