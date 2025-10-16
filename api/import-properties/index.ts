import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage.js';
import { InsertProperty } from '../../shared/schema.js';
import axios from 'axios';
import * as xml2js from 'xml2js';

// Pre-configured parser for better performance
const XML_PARSER = new xml2js.Parser({ 
  explicitArray: true, 
  trim: true,
  normalize: true,
  normalizeTags: true,
  ignoreAttrs: true,
  mergeAttrs: true,
});

// Property type mapping with expanded types
const PROPERTY_TYPE_MAP: Record<string, string> = {
  'AP': 'Apartment',
  'BU': 'Bulk Units',
  'BW': 'Bungalow',
  'CD': 'Compound',
  'DX': 'Duplex',
  'FA': 'Factory',
  'FM': 'Farm',
  'FF': 'Full Floor',
  'HA': 'Hotel Apartment',
  'HF': 'Half Floor',
  'LC': 'Labor Camp',
  'LP': 'Land/Plot',
  'OF': 'Office Space',
  'BC': 'Business Centre',
  'PH': 'Penthouse',
  'RE': 'Retail',
  'RT': 'Restaurant',
  'ST': 'Storage',
  'TH': 'Townhouse',
  'VH': 'Villa/House',
  'SA': 'Staff Accommodation',
  'WB': 'Whole Building',
  'SH': 'Shop',
  'SR': 'Showroom',
  'CW': 'Co-working Space',
  'WH': 'Warehouse'
};

// Commercial property types
const COMMERCIAL_TYPES = new Set([
  'OF', 'BC', 'RE', 'RT', 'ST', 'WB', 'SH', 'SR', 'CW', 'WH', 'FA', 'FF', 'HF'
]);

// Private amenities mapping
const PRIVATE_AMENITIES_MAP: Record<string, string> = {
  'AC': 'Central A/C & Heating',
  'BA': 'Balcony',
  'BK': 'Built-in Kitchen Appliances',
  'BL': 'View of Landmark',
  'BW': 'Built-in Wardrobes',
  'CP': 'Covered Parking',
  'CS': 'Concierge Service',
  'LB': 'Lobby in Building',
  'MR': 'Maid\'s Room',
  'MS': 'Maid Service',
  'PA': 'Pets Allowed',
  'PG': 'Private Garden',
  'PJ': 'Private Jacuzzi',
  'PP': 'Private Pool',
  'PY': 'Private Gym',
  'VC': 'Vastu-compliant',
  'SE': 'Security',
  'SP': 'Shared Pool',
  'SS': 'Shared Spa',
  'ST': 'Study',
  'SY': 'Shared Gym',
  'VW': 'View of Water',
  'WC': 'Walk-in Closet',
  'CO': 'Children\'s Pool',
  'PR': 'Children\'s Play Area',
  'BR': 'Barbecue Area'
};

// Commercial amenities mapping
const COMMERCIAL_AMENITIES_MAP: Record<string, string> = {
  'CR': 'Conference Room',
  'AN': 'Available Networked',
  'DN': 'Dining in building',
  'LB': 'Lobby in Building',
  'SP': 'Shared Pool',
  'SY': 'Shared Gym',
  'CP': 'Covered Parking',
  'VC': 'Vastu-compliant',
  'PN': 'Pantry',
  'MZ': 'Mezzanine'
};

// Cache for existing references to avoid repeated DB calls
let existingReferencesCache: Set<string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Safely extract first array element or value
 */
function extractValue(data: any): string {
  if (!data) return '';
  return Array.isArray(data) ? (data[0] || '') : data;
}

/**
 * Safely parse integer
 */
function parseIntSafe(value: any): number | null {
  if (!value) return null;
  const str = extractValue(value);
  const num = parseInt(str.toString().replace(/\D/g, ''), 10);
  return isNaN(num) ? null : num;
}

/**
 * Parse amenities from XML codes to readable format
 */
function parseAmenities(amenitiesStr: string, isCommercial: boolean): string {
  if (!amenitiesStr) return '';
  
  const amenityMap = isCommercial ? COMMERCIAL_AMENITIES_MAP : PRIVATE_AMENITIES_MAP;
  const codes = amenitiesStr.split(',').map(code => code.trim());
  
  const mappedAmenities = codes
    .map(code => amenityMap[code] || code)
    .filter(amenity => amenity);
  
  return mappedAmenities.join(',');
}

/**
 * Fix URL by ensuring proper slashes and fixing domain corruption
 */
function fixImageUrl(url: string): string {
  if (!url) return '';
  
  // Remove any quotes, backticks, or unwanted characters
  let cleanUrl = url.trim().replace(/[`'"]/g, '');
  
  // Fix the specific issue where zoho.nordstern.ae becomes zoho.nordstern.a/e
  cleanUrl = cleanUrl.replace(/zoho\.nordstern\.a\/e/g, 'zoho.nordstern.ae');
  
  // If it starts with https: but missing //, add them
  if (cleanUrl.startsWith('https:') && !cleanUrl.startsWith('https://')) {
    cleanUrl = cleanUrl.replace('https:', 'https://');
  }
  
  // If it starts with http: but missing //, add them
  if (cleanUrl.startsWith('http:') && !cleanUrl.startsWith('http://')) {
    cleanUrl = cleanUrl.replace('http:', 'http://');
  }
  
  // Fix missing slashes after domain (but avoid breaking already correct URLs)
  // Pattern: https://domain.compath -> https://domain.com/path
  if (cleanUrl.match(/^https?:\/\/[^\/]+[^\/]$/)) {
    cleanUrl = cleanUrl.replace(/^(https?:\/\/[^\/]+)([^\/])/, '$1/$2');
  }
  
  return cleanUrl;
}

/**
 * Map XML property to schema - optimized version
 */
function mapXmlToPropertySchema(xmlProperty: any): InsertProperty {
  const reference = extractValue(xmlProperty.reference_number) || '';
  
  try {
    // Price extraction - optimized
    let price = 0;
    const priceData = xmlProperty.price?.[0] || xmlProperty.price;
    if (priceData?.yearly) {
      price = parseInt(extractValue(priceData.yearly).toString().replace(/\D/g, ''), 10) || 0;
    }

    // Image extraction with proper URL fixing - optimized
    let images: string[] = [];
    const photoData = xmlProperty.photo?.[0] || xmlProperty.photo;
    if (photoData?.url) {
      const rawUrls = Array.isArray(photoData.url) ? photoData.url : [photoData.url];
      images = rawUrls
        .filter(Boolean)
        .map((url: string) => fixImageUrl(url))
        .filter((url: string) => url.length > 0);
    }

    // Agent extraction - optimized
    let agent = null;
    const agentData = xmlProperty.agent?.[0] || xmlProperty.agent;
    if (agentData) {
      agent = [{
        id: extractValue(agentData.id),
        name: extractValue(agentData.name)
      }];
    }

    // Property type and commercial determination
    const propertyTypeCode = extractValue(xmlProperty.property_type) || 'AP';
    const isCommercial = COMMERCIAL_TYPES.has(propertyTypeCode);

    // Amenities processing - optimized
    let amenities = '';
    const rawAmenities = extractValue(xmlProperty.private_amenities) || extractValue(xmlProperty.commercial_amenities);
    if (rawAmenities) {
      amenities = parseAmenities(rawAmenities, isCommercial);
    }

    // Furnished status - optimized
    const furnishedValue = extractValue(xmlProperty.furnished)?.toLowerCase() || '';
    const isFurnished = furnishedValue === 'yes' || furnishedValue === 'partly';
    const isFitted = furnishedValue.includes('partly');

    return {
      reference,
      listingType: extractValue(xmlProperty.offering_type) === 'RR' ? 'Rent' : 'Sale',
      propertyType: PROPERTY_TYPE_MAP[propertyTypeCode] || 'Apartment',
      subCommunity: extractValue(xmlProperty.sub_community) || null,
      community: extractValue(xmlProperty.community) || '',
      region: extractValue(xmlProperty.city) || 'Dubai',
      country: 'UAE',
      agent,
      price,
      currency: 'AED',
      bedrooms: parseIntSafe(xmlProperty.bedroom),
      bathrooms: parseIntSafe(xmlProperty.bathroom),
      propertyStatus: extractValue(xmlProperty.completion_status) === 'completed' ? 'Ready' : 'Off Plan',
      title: extractValue(xmlProperty.title_en) || '',
      description: extractValue(xmlProperty.description_en) || '',
      sqfeetArea: parseIntSafe(xmlProperty.size),
      sqfeetBuiltup: parseIntSafe(xmlProperty.size),
      isExclusive: false,
      amenities,
      isFeatured: false,
      isFitted,
      isFurnished,
      lifestyle: '',
      permit: extractValue(xmlProperty.permit_number) || null,
      brochure: '',
      images,
      development: extractValue(xmlProperty.property_name) || null,
      neighbourhood: extractValue(xmlProperty.sub_community) || extractValue(xmlProperty.community) || null,
      sold: false,
    };
  } catch (error) {
    console.error(`Error mapping property ${reference}:`, error);
    throw new Error(`Failed to map XML property ${reference}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get existing references with caching
 */
async function getExistingReferences(): Promise<Set<string>> {
  const now = Date.now();
  
  // Return cached data if valid
  if (existingReferencesCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return existingReferencesCache;
  }
  
  // Fetch fresh data
  const references = await storage.getAllPropertyReferences();
  existingReferencesCache = new Set(references.map(ref => ref.reference));
  cacheTimestamp = now;
  
  return existingReferencesCache;
}

/**
 * Batch process properties for better performance
 */
async function batchProcessProperties(xmlProperties: any[], batchSize: number = 50): Promise<{
  propertiesToInsert: InsertProperty[];
  processedReferences: string[];
  errors: Array<{ reference: string; error: string }>;
}> {
  const propertiesToInsert: InsertProperty[] = [];
  const processedReferences: string[] = [];
  const errors: Array<{ reference: string; error: string }> = [];
  
  // Get existing references once
  const existingReferences = await getExistingReferences();
  
  // Process in batches to avoid memory issues
  for (let i = 0; i < xmlProperties.length; i += batchSize) {
    const batch = xmlProperties.slice(i, i + batchSize);
    
    for (const xmlProperty of batch) {
      try {
        const reference = extractValue(xmlProperty.reference_number);
        if (!reference) {
          errors.push({ reference: 'unknown', error: 'Missing reference number' });
          continue;
        }
        
        // Skip existing references - this is the key fix
        if (existingReferences.has(reference)) {
          continue;
        }

        const propertyData = mapXmlToPropertySchema(xmlProperty);
        propertiesToInsert.push(propertyData);
        processedReferences.push(reference);
        
        // Add to cache to prevent duplicates within this batch
        existingReferences.add(reference);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown mapping error';
        errors.push({ reference: extractValue(xmlProperty.reference_number) || 'unknown', error: errorMsg });
      }
    }
  }
  
  return { propertiesToInsert, processedReferences, errors };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  // Enable CORS with optimized headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache'); // Disable caching for import endpoint

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (!storage) {
      return res.status(500).json({ message: 'Storage service unavailable' });
    }

    // Get XML data with timeout optimization
    let xmlData: string;
    if (req.method === 'POST' && req.body && typeof req.body === 'string' && req.body.includes('<list')) {
      xmlData = req.body;
    } else {
      const xmlUrl = 'https://zoho.nordstern.ae/property_finder.xml';
      
      try {
        const response = await axios.get(xmlUrl, {
          timeout: 10000, // Increased timeout
          headers: {
            'Accept': 'application/xml, text/xml',
            'User-Agent': 'PropertyImporter/1.0',
            'Accept-Encoding': 'gzip' // Enable compression
          },
          maxRedirects: 5
        });
        xmlData = response.data;
      } catch (error) {
        console.error('Error fetching XML:', error);
        return res.status(500).json({
          error: 'Failed to fetch XML data',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime
        });
      }
    }
    
    // Parse XML with error handling
    let result;
    try {
      result = await XML_PARSER.parseStringPromise(xmlData);
    } catch (parseError) {
      console.error('XML parsing error:', parseError);
      return res.status(400).json({
        error: 'Failed to parse XML data',
        message: parseError instanceof Error ? parseError.message : 'Invalid XML format',
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime
      });
    }
    
    const xmlProperties = result.list?.property || [];
    
    if (!Array.isArray(xmlProperties) || xmlProperties.length === 0) {
      return res.status(200).json({ 
        message: 'No properties found in XML data',
        total: 0,
        processed: 0,
        errors: 0,
        results: [],
        errorDetails: [],
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime
      });
    }

    // Process properties in batches for better performance
    const { propertiesToInsert, processedReferences, errors } = await batchProcessProperties(xmlProperties, 100);

    if (propertiesToInsert.length === 0) {
      return res.status(200).json({
        message: 'No new properties to insert (all properties already exist)',
        total: xmlProperties.length,
        processed: 0,
        errors: errors.length,
        results: [],
        errorDetails: errors,
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime
      });
    }

    // Insert new properties with optimized batch size
    try {
      const { success, errors: insertErrors } = await storage.bulkInsertProperties(propertiesToInsert, 200);
      errors.push(...insertErrors);
      
      // Update cache with new references
      if (existingReferencesCache) {
        processedReferences.slice(0, success).forEach(ref => {
          existingReferencesCache!.add(ref);
        });
      }
      
      const processingTime = Date.now() - startTime;
      return res.status(200).json({
        message: success === propertiesToInsert.length ? 'Import completed successfully' : 'Import completed with some errors',
        total: xmlProperties.length,
        processed: success,
        errors: errors.length,
        results: processedReferences.slice(0, success).map(ref => ({ reference: ref, action: 'created' })),
        errorDetails: errors,
        timestamp: new Date().toISOString(),
        processingTimeMs: processingTime,
        performanceStats: {
          xmlParseTime: `${processingTime}ms`,
          avgProcessingTimePerProperty: `${(processingTime / xmlProperties.length).toFixed(2)}ms`,
          duplicatesSkipped: xmlProperties.length - propertiesToInsert.length - errors.length
        }
      });
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      return res.status(500).json({
        error: 'Failed to insert properties',
        message: dbError instanceof Error ? dbError.message : 'Database error',
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime
      });
    }
  } catch (error) {
    console.error('Import handler error:', error);
    const processingTime = Date.now() - startTime;
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });
  }
}