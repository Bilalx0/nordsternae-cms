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
  if (cleanUrl.match(/^https?:\/\/[^\/]+[^\/]$/)) {
    cleanUrl = cleanUrl.replace(/^(https?:\/\/[^\/]+)([^\/])/, '$1/$2');
  }
  
  return cleanUrl;
}

/**
 * Generate a hash of property data for change detection
 */
function generatePropertyHash(property: InsertProperty): string {
  const hashData = {
    listingType: property.listingType,
    propertyType: property.propertyType,
    community: property.community,
    subCommunity: property.subCommunity,
    price: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    sqfeetArea: property.sqfeetArea,
    title: property.title,
    description: property.description,
    propertyStatus: property.propertyStatus,
    amenities: property.amenities,
    isFurnished: property.isFurnished,
    isFitted: property.isFitted,
    images: Array.isArray(property.images) ? property.images.slice(0, 5).join('|') : '', // First 5 images for comparison
    development: property.development,
    permit: property.permit
  };
  
  return JSON.stringify(hashData);
}

/**
 * Map XML property to schema
 */
function mapXmlToPropertySchema(xmlProperty: any): InsertProperty {
  const reference = extractValue(xmlProperty.reference_number) || '';
  
  try {
    // Price extraction
    let price = 0;
    const priceData = xmlProperty.price?.[0] || xmlProperty.price;
    if (priceData?.yearly) {
      price = parseInt(extractValue(priceData.yearly).toString().replace(/\D/g, ''), 10) || 0;
    }

    // Image extraction with proper URL fixing
    let images: string[] = [];
    const photoData = xmlProperty.photo?.[0] || xmlProperty.photo;
    if (photoData?.url) {
      const rawUrls = Array.isArray(photoData.url) ? photoData.url : [photoData.url];
      images = rawUrls
        .filter(Boolean)
        .map((url: string) => fixImageUrl(url))
        .filter((url: string) => url.length > 0);
    }

    // Agent extraction
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

    // Amenities processing
    let amenities = '';
    const rawAmenities = extractValue(xmlProperty.private_amenities) || extractValue(xmlProperty.commercial_amenities);
    if (rawAmenities) {
      amenities = parseAmenities(rawAmenities, isCommercial);
    }

    // Furnished status
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
 * Process properties for full sync (insert, update, delete)
 */
async function fullSyncProperties(xmlProperties: any[]): Promise<{
  propertiesToInsert: InsertProperty[];
  propertiesToUpdate: Array<{ reference: string; data: Partial<InsertProperty> }>;
  referencesToDelete: string[];
  stats: {
    total: number;
    unchanged: number;
    errors: Array<{ reference: string; error: string }>;
  };
}> {
  const propertiesToInsert: InsertProperty[] = [];
  const propertiesToUpdate: Array<{ reference: string; data: Partial<InsertProperty> }> = [];
  const referencesToDelete: string[] = [];
  const errors: Array<{ reference: string; error: string }> = [];
  
  // Get all existing properties from database
  const existingProperties = await storage.getAllPropertyReferences();
  const existingMap = new Map(existingProperties.map(p => [p.reference, p]));
  
  // Track XML references to identify deletions
  const xmlReferences = new Set<string>();
  
  // Process each XML property
  for (const xmlProperty of xmlProperties) {
    try {
      const reference = extractValue(xmlProperty.reference_number);
      if (!reference) {
        errors.push({ reference: 'unknown', error: 'Missing reference number' });
        continue;
      }
      
      xmlReferences.add(reference);
      const propertyData = mapXmlToPropertySchema(xmlProperty);
      
      const existing = existingMap.get(reference);
      
      if (!existing) {
        // New property - insert
        propertiesToInsert.push(propertyData);
      } else {
        // Existing property - check if update needed
        const newHash = generatePropertyHash(propertyData);
        const existingHash = generatePropertyHash(existing as any);
        
        if (newHash !== existingHash) {
          // Data has changed - update
          propertiesToUpdate.push({
            reference,
            data: propertyData
          });
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown mapping error';
      errors.push({ 
        reference: extractValue(xmlProperty.reference_number) || 'unknown', 
        error: errorMsg 
      });
    }
  }
  
  // Find properties to delete (exist in DB but not in XML)
  for (const [reference] of existingMap) {
    if (!xmlReferences.has(reference)) {
      referencesToDelete.push(reference);
    }
  }
  
  return {
    propertiesToInsert,
    propertiesToUpdate,
    referencesToDelete,
    stats: {
      total: xmlProperties.length,
      unchanged: existingMap.size - propertiesToUpdate.length - referencesToDelete.length,
      errors
    }
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache');

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

    // Get XML data
    let xmlData: string;
    if (req.method === 'POST' && req.body && typeof req.body === 'string' && req.body.includes('<list')) {
      xmlData = req.body;
    } else {
      const xmlUrl = 'https://zoho.nordstern.ae/property_finder.xml';
      
      try {
        const response = await axios.get(xmlUrl, {
          timeout: 15000,
          headers: {
            'Accept': 'application/xml, text/xml',
            'User-Agent': 'PropertyImporter/2.0',
            'Accept-Encoding': 'gzip'
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
    
    // Parse XML
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
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime
      });
    }

    // Process full sync
    const syncResult = await fullSyncProperties(xmlProperties);
    
    // Execute database operations
    let insertedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    const operationErrors: Array<{ reference: string; error: string; operation: string }> = [];
    
    // 1. Insert new properties
    if (syncResult.propertiesToInsert.length > 0) {
      try {
        const { success, errors: insertErrors } = await storage.bulkInsertProperties(
          syncResult.propertiesToInsert, 
          200
        );
        insertedCount = success;
        operationErrors.push(...insertErrors.map(e => ({ ...e, operation: 'insert' })));
      } catch (error) {
        console.error('Bulk insert failed:', error);
        operationErrors.push({
          reference: 'bulk',
          error: error instanceof Error ? error.message : 'Bulk insert failed',
          operation: 'insert'
        });
      }
    }
    
    // 2. Update existing properties
    if (syncResult.propertiesToUpdate.length > 0) {
      for (const { reference, data } of syncResult.propertiesToUpdate) {
        try {
          await storage.updatePropertyByReference(reference, data);
          updatedCount++;
        } catch (error) {
          console.error(`Update failed for ${reference}:`, error);
          operationErrors.push({
            reference,
            error: error instanceof Error ? error.message : 'Update failed',
            operation: 'update'
          });
        }
      }
    }
    
    // 3. Delete missing properties
    if (syncResult.referencesToDelete.length > 0) {
      for (const reference of syncResult.referencesToDelete) {
        try {
          const property = await storage.getPropertyByReference(reference);
          if (property) {
            await storage.deleteProperty(property.id);
            deletedCount++;
          }
        } catch (error) {
          console.error(`Delete failed for ${reference}:`, error);
          operationErrors.push({
            reference,
            error: error instanceof Error ? error.message : 'Delete failed',
            operation: 'delete'
          });
        }
      }
    }
    
    const processingTime = Date.now() - startTime;
    const allErrors = [...syncResult.stats.errors, ...operationErrors];
    
    return res.status(200).json({
      message: allErrors.length === 0 ? 'Full sync completed successfully' : 'Full sync completed with some errors',
      sync: {
        inserted: insertedCount,
        updated: updatedCount,
        deleted: deletedCount,
        unchanged: syncResult.stats.unchanged,
        total: syncResult.stats.total
      },
      details: {
        newProperties: syncResult.propertiesToInsert.slice(0, insertedCount).map(p => p.reference),
        updatedProperties: syncResult.propertiesToUpdate.slice(0, updatedCount).map(p => p.reference),
        deletedProperties: syncResult.referencesToDelete.slice(0, deletedCount)
      },
      errors: allErrors.length,
      errorDetails: allErrors,
      timestamp: new Date().toISOString(),
      processingTimeMs: processingTime,
      performanceStats: {
        avgProcessingTimePerProperty: `${(processingTime / syncResult.stats.total).toFixed(2)}ms`,
        operationsPerSecond: ((insertedCount + updatedCount + deletedCount) / (processingTime / 1000)).toFixed(2)
      }
    });
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