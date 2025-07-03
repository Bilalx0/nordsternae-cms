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

// Property type mapping
const PROPERTY_TYPE_MAP: Record<string, string> = {
  'AP': 'Apartment',
  'VH': 'Villa', 
  'TH': 'Townhouse',
  'PH': 'Penthouse',
  'OF': 'Office',
  'RE': 'Retail',
  'WH': 'Warehouse',
  'PL': 'Plot',
  'FA': 'Factory'
};

const COMMERCIAL_TYPES = new Set(['OF', 'RE', 'WH', 'FA']);

// Default amenities
const DEFAULT_AMENITIES = {
  commercial: 'Security,Maintenance,Lobby in Building',
  apartment: 'Balcony,Built in wardrobes,Central air conditioning,Covered parking',
  villa: 'Private Garden,Built in wardrobes,Central air conditioning,Covered parking'
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
 * Map XML property to schema
 */
function mapXmlToPropertySchema(xmlProperty: any): InsertProperty {
  const reference = extractValue(xmlProperty.reference_number) || '';
  
  try {
    // Price extraction
    let price = 0;
    const priceData = Array.isArray(xmlProperty.price) ? xmlProperty.price[0] : xmlProperty.price;
    if (priceData?.yearly) {
      const rawPrice = extractValue(priceData.yearly).toString().replace(/\s/g, '');
      price = parseInt(rawPrice, 10) || 0;
    }

    // Image extraction
    let images: string[] = [];
    const photoData = Array.isArray(xmlProperty.photo) 
      ? (xmlProperty.photo.length > 0 ? xmlProperty.photo[0] : null)
      : xmlProperty.photo;
    
    if (photoData?.url) {
      const rawUrls = Array.isArray(photoData.url) ? photoData.url : [photoData.url];
      images = rawUrls
        .filter((url: string) => url && typeof url === 'string')
        .map((url: string) => url.trim().replace(/[`'"\\/]/g, ''));
    }

    // Agent extraction
    let agent = null;
    if (xmlProperty.agent) {
      const agentData = Array.isArray(xmlProperty.agent) ? xmlProperty.agent[0] : xmlProperty.agent;
      agent = [{
        id: extractValue(agentData?.id),
        name: extractValue(agentData?.name)
      }];
    }

    // Amenities determination
    const propertyTypeCode = extractValue(xmlProperty.property_type) || 'AP';
    const isCommercial = COMMERCIAL_TYPES.has(propertyTypeCode);
    let amenities = extractValue(xmlProperty.private_amenities);
    
    if (!amenities) {
      if (isCommercial) {
        amenities = DEFAULT_AMENITIES.commercial;
      } else if (propertyTypeCode === 'VH' || propertyTypeCode === 'TH') {
        amenities = DEFAULT_AMENITIES.villa;
      } else {
        amenities = DEFAULT_AMENITIES.apartment;
      }
    }

    // Furnished status
    const furnishedValue = extractValue(xmlProperty.furnished)?.toLowerCase() || '';
    // Normalize Furnished to boolean (true for "yes" or "partly", false for "no" or empty)
    const Furnished = furnishedValue === 'yes' || furnishedValue === 'partly' ? true : false;
    // isFitted is true if the property is partly furnished
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
      isFurnished: Furnished,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

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
          timeout: 5000,
          headers: {
            'Accept': 'application/xml, text/xml',
            'User-Agent': 'PropertyImporter/1.0'
          }
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
        total: 0,
        processed: 0,
        errors: 0,
        results: [],
        errorDetails: [],
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime
      });
    }
    
    // Fetch existing references
    let existingReferences: Set<string>;
    try {
      const references = await storage.getAllPropertyReferences();
      existingReferences = new Set(references.map(ref => ref.reference));
    } catch (dbError) {
      console.error('Error fetching references:', dbError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch existing property references',
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime
      });
    }

    // Process properties
    const propertiesToInsert: InsertProperty[] = [];
    const processedReferences: string[] = [];
    const errors: Array<{ reference: string; error: string }> = [];
    
    for (const xmlProperty of xmlProperties) {
      try {
        const reference = extractValue(xmlProperty.reference_number);
        if (!reference) {
          errors.push({ reference: 'unknown', error: 'Missing reference number' });
          continue;
        }
        
        // Skip existing references
        if (existingReferences.has(reference)) {
          continue;
        }

        const propertyData = mapXmlToPropertySchema(xmlProperty);
        propertiesToInsert.push(propertyData);
        processedReferences.push(reference);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown mapping error';
        errors.push({ reference: extractValue(xmlProperty.reference_number) || 'unknown', error: errorMsg });
        console.error('Property mapping error:', errorMsg);
      }
    }

    if (propertiesToInsert.length === 0) {
      return res.status(200).json({
        message: 'No new properties to insert',
        total: xmlProperties.length,
        processed: 0,
        errors: errors.length,
        results: [],
        errorDetails: errors,
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime
      });
    }

    // Insert new properties
    try {
      const { success, errors: insertErrors } = await storage.bulkInsertProperties(propertiesToInsert, 100);
      errors.push(...insertErrors);
      
      const processingTime = Date.now() - startTime;
      return res.status(200).json({
        message: success === propertiesToInsert.length ? 'Import completed successfully' : 'Import completed with some errors',
        total: xmlProperties.length,
        processed: success,
        errors: errors.length,
        results: processedReferences.slice(0, success).map(ref => ({ reference: ref, action: 'created' })),
        errorDetails: errors,
        timestamp: new Date().toISOString(),
        processingTimeMs: processingTime
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