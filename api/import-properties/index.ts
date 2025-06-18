import { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage.js';
import { InsertProperty } from '../../shared/schema.js';
import axios from 'axios';
import * as xml2js from 'xml2js';

/**
 * Maps XML property data to the application's property schema
 */
function mapXmlToPropertySchema(xmlProperty: any): Partial<InsertProperty> {
  try {
    // Log entire property for context
    console.log(`Processing property ${xmlProperty.reference_number?.[0] || 'unknown'}`);
    console.log('Raw property structure:', JSON.stringify(xmlProperty, null, 2).substring(0, 1000) + '...');

    // Extract price
    let price = 0;
    const priceData = Array.isArray(xmlProperty.price) ? xmlProperty.price[0] : xmlProperty.price;
    if (priceData?.yearly?.[0]) {
      const rawPrice = priceData.yearly[0].replace(/\s/g, '');
      price = parseInt(rawPrice);
      if (isNaN(price)) {
        console.warn(`Invalid price value for property ${xmlProperty.reference_number?.[0] || 'unknown'}: ${rawPrice}`);
        price = 0;
      }
    } else {
      console.warn(`Missing or invalid price for property ${xmlProperty.reference_number?.[0] || 'unknown'}`);
    }
    console.log('Extracted price:', price);

    // Extract images with detailed logging
    let images: string[] = [];
    console.log('Photo raw:', JSON.stringify(xmlProperty.photo, null, 2));
    let photoData = xmlProperty.photo;
    if (Array.isArray(xmlProperty.photo)) {
      console.log(`Photo is array, length: ${xmlProperty.photo.length}`);
      photoData = xmlProperty.photo.length > 0 ? xmlProperty.photo[0] : null;
    }
    console.log('Photo data after array check:', JSON.stringify(photoData, null, 2));
    if (photoData && photoData.url) {
      const rawUrls = Array.isArray(photoData.url) ? photoData.url : [photoData.url];
      console.log('Raw URLs:', rawUrls);
      images = rawUrls
        .filter((url: any) => {
          const isValid = url && typeof url === 'string';
          if (!isValid) console.warn(`Invalid URL filtered out for property ${xmlProperty.reference_number?.[0] || 'unknown'}: ${JSON.stringify(url)}`);
          return isValid;
        })
        .map((url: string) => {
          const cleaned = url.trim().replace(/[`'"\\/]/g, '');
          console.log(`Cleaned URL for property ${xmlProperty.reference_number?.[0] || 'unknown'}: ${cleaned}`);
          return cleaned;
        });
    } else {
      console.warn(`No valid photo or photo.url for property ${xmlProperty.reference_number?.[0] || 'unknown'}`);
    }
    console.log('Extracted images:', images);

    // Extract agent
    let agent = null;
    if (xmlProperty.agent) {
      const agentData = Array.isArray(xmlProperty.agent) ? xmlProperty.agent[0] : xmlProperty.agent;
      agent = [{
        id: agentData?.id?.[0] || '',
        name: agentData?.name?.[0] || ''
      }];
    }
    console.log('Extracted agent:', agent);

    // Determine property type and amenities
    const isCommercial = ['OF', 'RE', 'WH', 'FA'].includes(xmlProperty.property_type?.[0]);
    let amenities = xmlProperty.private_amenities?.[0] || '';
    if (!amenities) {
      if (isCommercial) {
        amenities = 'Security,Maintenance,Lobby in Building';
      } else {
        const propertyType = xmlProperty.property_type?.[0] || 'AP';
        if (propertyType === 'AP' || propertyType === 'PH') {
          amenities = 'Balcony,Built in wardrobes,Central air conditioning,Covered parking';
        } else if (propertyType === 'VH' || propertyType === 'TH') {
          amenities = 'Private Garden,Built in wardrobes,Central air conditioning,Covered parking';
        }
      }
    }

    return {
      reference: xmlProperty.reference_number?.[0] || '',
      listingType: xmlProperty.offering_type?.[0] === 'RR' ? 'Rent' : 'Sale',
      propertyType: mapPropertyType(xmlProperty.property_type?.[0] || 'AP'),
      subCommunity: xmlProperty.sub_community?.[0] || '',
      community: xmlProperty.community?.[0] || '',
      region: xmlProperty.city?.[0] || 'Dubai',
      country: 'UAE',
      agent,
      price,
      currency: 'AED',
      bedrooms: xmlProperty.bedroom?.[0] ? parseInt(xmlProperty.bedroom[0]) : null,
      bathrooms: xmlProperty.bathroom?.[0] ? parseInt(xmlProperty.bathroom[0]) : null,
      propertyStatus: xmlProperty.completion_status?.[0] === 'completed' ? 'Ready' : 'Off Plan',
      title: xmlProperty.title_en?.[0] || '',
      description: xmlProperty.description_en?.[0] || '',
      sqfeetArea: xmlProperty.size?.[0] ? parseInt(xmlProperty.size[0]) : null,
      sqfeetBuiltup: xmlProperty.size?.[0] ? parseInt(xmlProperty.size[0]) : null,
      isExclusive: false,
      amenities,
      isFeatured: false,
      isFitted: xmlProperty.furnished?.[0]?.includes('Partly') || false,
      isFurnished: xmlProperty.furnished?.[0]?.includes('Fully') || false,
      lifestyle: '',
      permit: xmlProperty.permit_number?.[0] || '',
      brochure: '',
      images,
      development: xmlProperty.property_name?.[0] || '',
      neighbourhood: xmlProperty.sub_community?.[0] || xmlProperty.community?.[0] || '',
      sold: false,
    };
  } catch (error) {
    console.error('Error mapping XML property:', error);
    throw new Error(`Failed
      to map XML property: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Maps property type codes to full property type names
 */
function mapPropertyType(typeCode: string): string {
  const typeMap: Record<string, string> = {
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
  
  return typeMap[typeCode] || 'Apartment';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== IMPORT PROPERTIES API HANDLER START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Storage available:', !!storage);

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Allow both GET and POST requests for this endpoint
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    if (!storage) {
      return res.status(500).json({ message: 'Storage service unavailable' });
    }

    // For testing, allow passing XML data directly in the request body
    let xmlData;
    if (req.method === 'POST' && req.body && typeof req.body === 'string' && req.body.includes('<list')) {
      console.log('Using XML data from request body');
      xmlData = req.body;
    } else {
      // Fetch XML data from the URL
      const xmlUrl = 'https://zoho.nordstern.ae/property_finder.xml';
      console.log(`Fetching XML data from ${xmlUrl}...`);
      
      try {
        const response = await axios.get(xmlUrl);
        xmlData = response.data;
      } catch (error) {
        console.error('Error fetching XML data:', error);
        return res.status(500).json({
          error: 'Failed to fetch XML data',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Parse XML to JSON
    const parser = new xml2js.Parser({ explicitArray: true, trim: true });
    
    try {
      const result = await parser.parseStringPromise(xmlData);
      console.log('XML parsed successfully, structure:', Object.keys(result));
      
      // Extract properties array from the parsed XML
      // The structure is <list><property>...</property>...</list>
      const xmlProperties = result.list?.property || [];
      
      if (!Array.isArray(xmlProperties) || xmlProperties.length === 0) {
        console.error('No properties found in XML data. XML structure:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
        return res.status(404).json({ message: 'No properties found in XML data' });
      }
      
      console.log(`Found ${xmlProperties.length} properties in XML data`);
      
      // Process each property
      const importResults = [];
      const errors = [];
      
      for (const xmlProperty of xmlProperties) {
        try {
          // Map XML property to our schema
          const propertyData = mapXmlToPropertySchema(xmlProperty);
          
          // Use reference_number as the reference
          const reference = xmlProperty.reference_number?.[0];
          if (!reference) {
            throw new Error('Property missing reference number');
          }
          
          // Check if property with this reference already exists
          const existingProperty = await storage.getPropertyByReference(reference);
          
          if (existingProperty) {
            // Update existing property
            const updatedProperty = await storage.updateProperty(existingProperty.id, propertyData);
            importResults.push({
              reference: reference,
              action: 'updated',
              id: existingProperty.id
            });
          } else {
            // Create new property
            const newProperty = await storage.createProperty(propertyData as any);
            importResults.push({
              reference: reference,
              action: 'created',
              id: newProperty.id
            });
          }
        } catch (error) {
          console.error('Error processing property:', error);
          errors.push({
            reference: xmlProperty.reference_number?.[0] || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      // Return import results
      return res.status(200).json({
        message: 'Import completed',
        total: xmlProperties.length,
        processed: importResults.length,
        errors: errors.length,
        results: importResults,
        errorDetails: errors
      });
    } catch (parseError) {
      console.error('Error parsing XML:', parseError);
      return res.status(400).json({
        error: 'Failed to parse XML data',
        message: parseError instanceof Error ? parseError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Import handler error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}