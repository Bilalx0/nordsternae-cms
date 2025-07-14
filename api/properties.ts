import { VercelRequest, VercelResponse } from '@vercel/node';
import { insertPropertySchema } from '../shared/schema.js';
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
  console.error('Failed to import storage:', error);
  storageError = error instanceof Error ? error.message : 'Unknown storage import error';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== PROPERTIES API HANDLER START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Query:', req.query); // This will now show the query parameters
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
    return res.status(500).json({ message: 'Storage service unavailable', storageError });
  }

  // Safely handle req.url
  if (!req.url) {
    console.log('Invalid request: URL is undefined');
    return res.status(400).json({ message: 'Invalid request' });
  }

  // Extract id from URL
  // This logic is for path-based IDs (e.g., /api/properties/123)
  // Query parameters are handled separately via req.query
  const urlParts = req.url.split('/').filter(part => part && part !== 'api' && part !== 'properties');
  const id = urlParts[0]; // This 'id' is from the path, not query params
  const hasIdInPath = !!id && typeof id === 'string';
  const propertyIdFromPath = hasIdInPath ? parseInt(id) : null;

  if (hasIdInPath && propertyIdFromPath !== null && isNaN(propertyIdFromPath)) {
    console.log('Invalid ID in path: not a number after parsing:', id);
    return res.status(400).json({ message: 'Invalid ID in path' });
  }

  console.log('Parsed propertyId from path:', propertyIdFromPath);

  try {
    // Base route: /api/properties (handles GET all and GET with query parameters, POST)
    if (!hasIdInPath) {
      if (req.method === 'GET') {
        console.log('Fetching properties with query filters (if any):', req.query);
        // Get all properties first
        let properties = await storage.getProperties();

        // Apply filters based on query parameters
        // req.query contains all query parameters as key-value pairs
        // Example: /api/properties?reference=REF123&propertyType=villa
        for (const key in req.query) {
          const queryValue = req.query[key];

          // Ensure the queryValue is a string for filtering, or handle arrays if applicable
          if (typeof queryValue === 'string') {
            const lowerCaseQueryValue = queryValue.toLowerCase();

            properties = properties.filter((property: any) => {
              const propertyValue = property[key]; // Access the property's field value

              // Basic case-insensitive string matching
              if (typeof propertyValue === 'string') {
                return propertyValue.toLowerCase().includes(lowerCaseQueryValue);
              }
              // If it's a number, convert query to number for comparison
              if (typeof propertyValue === 'number' && !isNaN(parseFloat(queryValue))) {
                return propertyValue === parseFloat(queryValue);
              }
              // Handle arrays of strings (e.g., 'amenities')
              if (Array.isArray(propertyValue) && propertyValue.every(item => typeof item === 'string')) {
                return propertyValue.some(item => item.toLowerCase().includes(lowerCaseQueryValue));
              }
              // You might need more specific logic for nested objects or complex types
              return false; // Exclude if type not handled or no match
            });
          }
          // Add more complex filtering logic here if needed (e.g., for range filters like minPrice, maxPrice)
        }

        console.log('Retrieved properties count after filtering:', properties.length);
        res.status(200).json(properties);

      } else if (req.method === 'POST') {
        const data = validateBody(insertPropertySchema, req, res);
        if (!data) return;
        console.log('Creating new property');
        const property = await storage.createProperty(data);
        console.log('Created property:', property);
        res.status(201).json(property);
      } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ message: 'Method not allowed' });
      }
    }
    // Dynamic route: /api/properties/:id (GET single by ID, PUT, DELETE)
    else {
      if (req.method === 'GET') {
        console.log('Querying property with ID from path:', propertyIdFromPath);
        const property = await storage.getProperty(propertyIdFromPath);
        console.log('Retrieved property:', property);
        if (!property) {
          return res.status(404).json({ message: 'Property not found' });
        }
        res.status(200).json(property);
      } else if (req.method === 'PUT') {
        const data = validateBody(insertPropertySchema.partial(), req, res);
        if (!data) return;
        console.log('Updating property with ID from path:', propertyIdFromPath);
        const property = await storage.updateProperty(propertyIdFromPath, data);
        if (!property) {
          return res.status(404).json({ message: 'Property not found' });
        }
        res.status(200).json(property);
      } else if (req.method === 'DELETE') {
        console.log('Attempting to delete property with ID from path:', propertyIdFromPath);
        const success = await storage.deleteProperty(propertyIdFromPath);
        if (!success) {
          return res.status(404).json({ message: 'Property not found' });
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
      propertyId: propertyIdFromPath // Use propertyIdFromPath for consistency
    });
  }
  console.log('=== PROPERTIES API HANDLER END ===');
}