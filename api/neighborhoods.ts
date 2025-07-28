import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertNeighborhoodSchema } from '../shared/schema.js';
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
  console.log('=== NEIGHBORHOODS API HANDLER START ===');
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

  // Extract id from URL path (for /api/neighborhoods/:id)
  const pathWithoutQuery = req.url.split('?')[0];
  const urlParts = pathWithoutQuery.split('/').filter(part => part && part !== 'api' && part !== 'neighborhoods');
  const id = urlParts[0];
  const hasIdInPath = !!id && typeof id === 'string';
  const neighborhoodIdFromPath = hasIdInPath ? parseInt(id) : null;

  if (hasIdInPath && (neighborhoodIdFromPath === null || isNaN(neighborhoodIdFromPath))) {
    console.log('Invalid ID in path: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID in path' });
  }

  console.log('Parsed neighborhoodId from path:', neighborhoodIdFromPath);

  try {
    // Base route: /api/neighborhoods (handles GET all, GET with slug, POST)
    if (!hasIdInPath) {
      if (req.method === 'GET') {
        console.log('Fetching neighborhoods with query filters:', req.query);

        // Handle 'slug' query parameter for fetching a single neighborhood
        const { slug } = req.query;
        if (slug && typeof slug === 'string' && slug.trim() !== '') {
          console.log(`Fetching neighborhood by slug: ${slug}`);
          const neighborhoods = await storage.getNeighborhoods();
          const neighborhood = neighborhoods.find((n: { urlSlug: string }) => n.urlSlug === slug) || null;

          if (!neighborhood) {
            console.log(`No neighborhood found for slug: ${slug}`);
            return res.status(404).json({ message: `Neighborhood not found for slug: ${slug}` });
          }

          // Ensure image fields have defaults
          neighborhood.images = neighborhood.images || [{ downloadURL: '/fallback-image.jpg' }];
          console.log(`Found neighborhood for slug: ${slug}`, neighborhood);
          return res.status(200).json(neighborhood);
        }

        // Handle other query parameters (if any, for filtering)
        let neighborhoods = await storage.getNeighborhoods();
        for (const key in req.query) {
          if (key === 'slug') continue;
          const queryValue = req.query[key];
          if (typeof queryValue === 'string') {
            const lowerCaseQueryValue = queryValue.toLowerCase();
            neighborhoods = neighborhoods.filter((neighborhood: Record<string, unknown>) => {
              const neighborhoodValue = neighborhood[key];
              if (typeof neighborhoodValue === 'string') {
                return neighborhoodValue.toLowerCase().includes(lowerCaseQueryValue);
              }
              if (typeof neighborhoodValue === 'number' && !isNaN(parseFloat(queryValue))) {
                return neighborhoodValue === parseFloat(queryValue);
              }
              if (Array.isArray(neighborhoodValue) && neighborhoodValue.every(item => typeof item === 'string')) {
                return neighborhoodValue.some(item => item.toLowerCase().includes(lowerCaseQueryValue));
              }
              return false;
            });
          }
        }

        // Ensure image fields for all neighborhoods
        neighborhoods.forEach((neighborhood: { images: any[] }) => {
          neighborhood.images = neighborhood.images || [{ downloadURL: '/fallback-image.jpg' }];
        });

        console.log('Retrieved neighborhoods count after filtering:', neighborhoods.length);
        res.status(200).json(neighborhoods);

      } else if (req.method === 'POST') {
        const data = validateBody(insertNeighborhoodSchema, req, res);
        if (!data) return;
        console.log('Creating new neighborhood');
        const neighborhood = await storage.createNeighborhood(data);
        console.log('Created neighborhood:', neighborhood);
        res.status(201).json(neighborhood);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/neighborhoods/:id (GET, PUT, DELETE by ID)
    else {
      if (req.method === 'GET') {
        console.log('Querying neighborhood with ID:', neighborhoodIdFromPath);
        const neighborhood = await storage.getNeighborhood(neighborhoodIdFromPath);
        console.log('Retrieved neighborhood:', neighborhood);
        if (!neighborhood) {
          return res.status(404).json({ message: 'Neighborhood not found' });
        }
        neighborhood.images = neighborhood.images || [{ downloadURL: '/fallback-image.jpg' }];
        res.status(200).json(neighborhood);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertNeighborhoodSchema.partial(), req, res);
        if (!data) return;
        console.log('Updating neighborhood with ID:', neighborhoodIdFromPath);
        const neighborhood = await storage.updateNeighborhood(neighborhoodIdFromPath, data);
        if (!neighborhood) {
          return res.status(404).json({ message: 'Neighborhood not found' });
        }
        neighborhood.images = neighborhood.images || [{ downloadURL: '/fallback-image.jpg' }];
        res.status(200).json(neighborhood);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete neighborhood with ID:', neighborhoodIdFromPath);
        const success = await storage.deleteNeighborhood(neighborhoodIdFromPath);
        if (!success) {
          return res.status(404).json({ message: 'Neighborhood not found' });
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
      neighborhoodId: neighborhoodIdFromPath,
    });
  }
  console.log('=== NEIGHBORHOODS API HANDLER END ===');
}