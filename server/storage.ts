import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema.js";
import { eq, sql } from "drizzle-orm";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined. Please set it in your .env file.");
}

// Initialize PostgreSQL client and Drizzle ORM
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

export { db };

// StorageInterface defines all CRUD operations
export interface IStorage {
  getAllPropertyReferences(): Promise<{ reference: string }[]>; // Added method
  upsertProperties(properties: Partial<schema.InsertProperty>[]): Promise<{
    success: number;
    errors: Array<{ reference: string; error: string }>;
  }>;
  bulkInsertProperties(properties: schema.InsertProperty[], chunkSize?: number): Promise<{
    success: number;
    errors: Array<{ reference: string; error: string }>;
  }>;
  getUser(id: number): Promise<schema.User | undefined>;
  getUserByUsername(username: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;
  getProperties(): Promise<schema.Property[]>;
  getProperty(id: number): Promise<schema.Property | undefined>;
  getPropertyByReference(reference: string): Promise<schema.Property | undefined>;
  createProperty(property: schema.InsertProperty): Promise<schema.Property>;
  updateProperty(id: number, property: Partial<schema.InsertProperty>): Promise<schema.Property | undefined>;
  updatePropertyByReference(reference: string, property: Partial<schema.InsertProperty>): Promise<schema.Property | undefined>;
  deleteProperty(id: number): Promise<boolean>;
  getNeighborhoods(): Promise<schema.Neighborhood[]>;
  getNeighborhood(id: number): Promise<schema.Neighborhood | undefined>;
  createNeighborhood(neighborhood: schema.InsertNeighborhood): Promise<schema.Neighborhood>;
  updateNeighborhood(id: number, neighborhood: Partial<schema.InsertNeighborhood>): Promise<schema.Neighborhood | undefined>;
  deleteNeighborhood(id: number): Promise<boolean>;
  getDevelopments(): Promise<schema.Development[]>;
  getDevelopment(id: number): Promise<schema.Development | undefined>;
  createDevelopment(development: schema.InsertDevelopment): Promise<schema.Development>;
  updateDevelopment(id: number, development: Partial<schema.InsertDevelopment>): Promise<schema.Development | undefined>;
  deleteDevelopment(id: number): Promise<boolean>;
  getEnquiries(): Promise<schema.Enquiry[]>;
  getEnquiry(id: number): Promise<schema.Enquiry | undefined>;
  createEnquiry(enquiry: schema.InsertEnquiry): Promise<schema.Enquiry>;
  updateEnquiry(id: number, enquiry: Partial<schema.Enquiry>): Promise<schema.Enquiry | undefined>;
  deleteEnquiry(id: number): Promise<boolean>;
  markEnquiryAsRead(id: number): Promise<schema.Enquiry | undefined>;
  getAgents(): Promise<schema.Agent[]>;
  getAgent(id: number): Promise<schema.Agent | undefined>;
  createAgent(agent: schema.InsertAgent): Promise<schema.Agent>;
  updateAgent(id: number, agent: Partial<schema.InsertAgent>): Promise<schema.Agent | undefined>;
  deleteAgent(id: number): Promise<boolean>;
  getArticles(): Promise<schema.Article[]>;
  getArticle(id: number): Promise<schema.Article | undefined>;
  createArticle(article: schema.InsertArticle): Promise<schema.Article>;
  updateArticle(id: number, article: Partial<schema.InsertArticle>): Promise<schema.Article | undefined>;
  deleteArticle(id: number): Promise<boolean>;
  getBannerHighlights(): Promise<schema.BannerHighlight[]>;
  getBannerHighlight(id: number): Promise<schema.BannerHighlight | undefined>;
  createBannerHighlight(bannerHighlight: schema.InsertBannerHighlight): Promise<schema.BannerHighlight>;
  updateBannerHighlight(id: number, bannerHighlight: Partial<schema.InsertBannerHighlight>): Promise<schema.BannerHighlight | undefined>;
  deleteBannerHighlight(id: number): Promise<boolean>;
  getDevelopers(): Promise<schema.Developer[]>;
  getDeveloper(id: number): Promise<schema.Developer | undefined>;
  createDeveloper(developer: schema.InsertDeveloper): Promise<schema.Developer>;
  updateDeveloper(id: number, developer: Partial<schema.InsertDeveloper>): Promise<schema.Developer | undefined>;
  deleteDeveloper(id: number): Promise<boolean>;
  getSitemapEntries(): Promise<schema.Sitemap[]>;
  getSitemapEntry(id: number): Promise<schema.Sitemap | undefined>;
  createSitemapEntry(sitemapEntry: schema.InsertSitemap): Promise<schema.Sitemap>;
  updateSitemapEntry(id: number, sitemapEntry: Partial<schema.InsertSitemap>): Promise<schema.Sitemap | undefined>;
  deleteSitemapEntry(id: number): Promise<boolean>;
}

export class DbStorage implements IStorage {
  constructor() {}

  async getAllPropertyReferences(): Promise<{ reference: string }[]> {
    try {
      const result = await db
        .select({ reference: schema.properties.reference })
        .from(schema.properties);
      return result;
    } catch (error) {
      console.error('Error fetching property references:', error);
      throw new Error('Failed to fetch property references');
    }
  }

  async bulkInsertProperties(properties: schema.InsertProperty[], chunkSize: number = 100): Promise<{
    success: number;
    errors: Array<{ reference: string; error: string }>;
  }> {
    if (properties.length === 0) {
      return { success: 0, errors: [] };
    }

    let success = 0;
    const errors: Array<{ reference: string; error: string }> = [];

    // Process in chunks
    for (let i = 0; i < properties.length; i += chunkSize) {
      const chunk = properties.slice(i, i + chunkSize);
      
      try {
        const inserted = await this.insertProperties(chunk);
        success += inserted.length;
      } catch (error) {
        // Fallback to individual inserts for failed chunk
        for (const property of chunk) {
          try {
            await this.createProperty(property);
            success++;
          } catch (individualError) {
            errors.push({
              reference: property.reference || 'unknown',
              error: individualError instanceof Error ? individualError.message : 'Unknown error',
            });
          }
        }
      }
    }

    return { success, errors };
  }

  async upsertProperties(properties: Partial<schema.InsertProperty>[]): Promise<{
    success: number;
    errors: Array<{ reference: string; error: string }>;
  }> {
    if (properties.length === 0) {
      return { success: 0, errors: [] };
    }

    try {
      await this.batchUpsertProperties(properties as schema.InsertProperty[]);
      return { success: properties.length, errors: [] };
    } catch (error) {
      console.log('Batch upsert failed, falling back to individual processing:', error);
      return await this.individualUpsertProperties(properties);
    }
  }

  private async batchUpsertProperties(properties: schema.InsertProperty[]): Promise<void> {
    await db.insert(schema.properties)
      .values(properties)
      .onConflictDoUpdate({
        target: schema.properties.reference,
        set: {
          listingType: sql`excluded.listing_type`,
          propertyType: sql`excluded.property_type`,
          subCommunity: sql`excluded.sub_community`,
          community: sql`excluded.community`,
          region: sql`excluded.region`,
          country: sql`excluded.country`,
          agent: sql`excluded.agent`,
          price: sql`excluded.price`,
          currency: sql`excluded.currency`,
          bedrooms: sql`excluded.bedrooms`,
          bathrooms: sql`excluded.bathrooms`,
          propertyStatus: sql`excluded.property_status`,
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          sqfeetArea: sql`excluded.sqfeet_area`,
          sqfeetBuiltup: sql`excluded.sqfeet_builtup`,
          isExclusive: sql`excluded.is_exclusive`,
          amenities: sql`excluded.amenities`,
          isFeatured: sql`excluded.is_featured`,
          isFitted: sql`excluded.is_fitted`,
          isFurnished: sql`excluded.is_furnished`,
          lifestyle: sql`excluded.lifestyle`,
          permit: sql`excluded.permit`,
          brochure: sql`excluded.brochure`,
          images: sql`excluded.images`,
          development: sql`excluded.development`,
          neighbourhood: sql`excluded.neighbourhood`,
          sold: sql`excluded.sold`,
          updatedAt: sql`NOW()`,
        },
      });
  }

  private async individualUpsertProperties(properties: Partial<schema.InsertProperty>[]): Promise<{
    success: number;
    errors: Array<{ reference: string; error: string }>;
  }> {
    let success = 0;
    const errors: Array<{ reference: string; error: string }> = [];

    for (const property of properties) {
      try {
        if (!property.reference) {
          errors.push({ reference: 'unknown', error: 'Missing reference field' });
          continue;
        }

        await this.upsertSingleProperty(property as schema.InsertProperty);
        success++;
      } catch (error) {
        errors.push({
          reference: property.reference || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { success, errors };
  }

  async upsertSingleProperty(property: schema.InsertProperty): Promise<schema.Property> {
    const existing = await this.getPropertyByReference(property.reference);
    if (existing) {
      const updated = await this.updatePropertyByReference(property.reference, {
        ...property,
        updatedAt: new Date(),
      });
      if (!updated) {
        throw new Error(`Failed to update property with reference: ${property.reference}`);
      }
      return updated;
    } else {
      return await this.createProperty(property);
    }
  }

  async getUser(id: number): Promise<schema.User | undefined> {
    return await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  }

  async getUserByUsername(username: string): Promise<schema.User | undefined> {
    return await db.query.users.findFirst({ where: eq(schema.users.username, username) });
  }

  async createUser(user: schema.InsertUser): Promise<schema.User> {
    const [newUser] = await db
      .insert(schema.users)
      .values({ ...user, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return newUser;
  }

  async getProperties(): Promise<schema.Property[]> {
    return await db.query.properties.findMany();
  }

  async getProperty(id: number): Promise<schema.Property | undefined> {
    console.log('Executing getProperty query for ID:', id, 'with type:', typeof id);
    const property = await db.query.properties.findFirst({ 
      where: eq(schema.properties.id, id) 
    });
    console.log('Query result for ID', id, ':', property);
    return property;
  }

  async getPropertyByReference(reference: string): Promise<schema.Property | undefined> {
    return await db.query.properties.findFirst({ 
      where: eq(schema.properties.reference, reference) 
    });
  }

  async createProperty(property: schema.InsertProperty): Promise<schema.Property> {
    const [newProperty] = await db
      .insert(schema.properties)
      .values(property)
      .returning();
    return newProperty;
  }

  async updateProperty(id: number, property: Partial<schema.InsertProperty>): Promise<schema.Property | undefined> {
    const [updatedProperty] = await db
      .update(schema.properties)
      .set({ ...property, updatedAt: new Date() })
      .where(eq(schema.properties.id, id))
      .returning();
    return updatedProperty;
  }

  async updatePropertyByReference(reference: string, property: Partial<schema.InsertProperty>): Promise<schema.Property | undefined> {
    const [updatedProperty] = await db
      .update(schema.properties)
      .set({ ...property, updatedAt: new Date() })
      .where(eq(schema.properties.reference, reference))
      .returning();
    return updatedProperty;
  }

  async deleteProperty(id: number): Promise<boolean> {
    const result = await db.delete(schema.properties).where(eq(schema.properties.id, id));
    return result.count > 0;
  }

  async getNeighborhoods(): Promise<schema.Neighborhood[]> {
    return await db.query.neighborhoods.findMany();
  }

  async getNeighborhood(id: number): Promise<schema.Neighborhood | undefined> {
    return await db.query.neighborhoods.findFirst({ where: eq(schema.neighborhoods.id, id) });
  }

  async createNeighborhood(neighborhood: schema.InsertNeighborhood): Promise<schema.Neighborhood> {
    const [newNeighborhood] = await db
      .insert(schema.neighborhoods)
      .values(neighborhood)
      .returning();
    return newNeighborhood;
  }

  async updateNeighborhood(id: number, neighborhood: Partial<schema.InsertNeighborhood>): Promise<schema.Neighborhood | undefined> {
    const [updatedNeighborhood] = await db
      .update(schema.neighborhoods)
      .set({ ...neighborhood, updatedAt: new Date() })
      .where(eq(schema.neighborhoods.id, id))
      .returning();
    return updatedNeighborhood;
  }

  async deleteNeighborhood(id: number): Promise<boolean> {
    const result = await db.delete(schema.neighborhoods).where(eq(schema.neighborhoods.id, id));
    return result.count > 0;
  }

  async getDevelopments(): Promise<schema.Development[]> {
    return await db.query.developments.findMany();
  }

  async getDevelopment(id: number): Promise<schema.Development | undefined> {
    return await db.query.developments.findFirst({ where: eq(schema.developments.id, id) });
  }

  async createDevelopment(development: schema.InsertDevelopment): Promise<schema.Development> {
    const [newDevelopment] = await db
      .insert(schema.developments)
      .values(development)
      .returning();
    return newDevelopment;
  }

  async updateDevelopment(id: number, development: Partial<schema.InsertDevelopment>): Promise<schema.Development | undefined> {
    const [updatedDevelopment] = await db
      .update(schema.developments)
      .set({ ...development, updatedAt: new Date() })
      .where(eq(schema.developments.id, id))
      .returning();
    return updatedDevelopment;
  }

  async deleteDevelopment(id: number): Promise<boolean> {
    const result = await db.delete(schema.developments).where(eq(schema.developments.id, id));
    return result.count > 0;
  }

  async getEnquiries(): Promise<schema.Enquiry[]> {
    return await db.query.enquiries.findMany();
  }

  async getEnquiry(id: number): Promise<schema.Enquiry | undefined> {
    return await db.query.enquiries.findFirst({ where: eq(schema.enquiries.id, id) });
  }

  async createEnquiry(enquiry: schema.InsertEnquiry): Promise<schema.Enquiry> {
    const [newEnquiry] = await db
      .insert(schema.enquiries)
      .values(enquiry)
      .returning();
    return newEnquiry;
  }

  async updateEnquiry(id: number, enquiry: Partial<schema.Enquiry>): Promise<schema.Enquiry | undefined> {
    const [updatedEnquiry] = await db
      .update(schema.enquiries)
      .set(enquiry)
      .where(eq(schema.enquiries.id, id))
      .returning();
    return updatedEnquiry;
  }

  async deleteEnquiry(id: number): Promise<boolean> {
    const result = await db.delete(schema.enquiries).where(eq(schema.enquiries.id, id));
    return result.count > 0;
  }

  async markEnquiryAsRead(id: number): Promise<schema.Enquiry | undefined> {
    const [updatedEnquiry] = await db
      .update(schema.enquiries)
      .set({ isRead: true })
      .where(eq(schema.enquiries.id, id))
      .returning();
    return updatedEnquiry;
  }

  async getAgents(): Promise<schema.Agent[]> {
    return await db.query.agents.findMany();
  }

  async getAgent(id: number): Promise<schema.Agent | undefined> {
    return await db.query.agents.findFirst({ where: eq(schema.agents.id, id) });
  }

  async createAgent(agent: schema.InsertAgent): Promise<schema.Agent> {
    const [newAgent] = await db
      .insert(schema.agents)
      .values(agent)
      .returning();
    return newAgent;
  }

  async updateAgent(id: number, agent: Partial<schema.InsertAgent>): Promise<schema.Agent | undefined> {
    const [updatedAgent] = await db
      .update(schema.agents)
      .set({ ...agent, updatedAt: new Date() })
      .where(eq(schema.agents.id, id))
      .returning();
    return updatedAgent;
  }

  async deleteAgent(id: number): Promise<boolean> {
    const result = await db.delete(schema.agents).where(eq(schema.agents.id, id));
    return result.count > 0;
  }

  async getArticles(): Promise<schema.Article[]> {
    return await db.query.articles.findMany();
  }

  async getArticle(id: number): Promise<schema.Article | undefined> {
    return await db.query.articles.findFirst({ where: eq(schema.articles.id, id) });
  }

  async createArticle(article: schema.InsertArticle): Promise<schema.Article> {
    const [newArticle] = await db
      .insert(schema.articles)
      .values(article)
      .returning();
    return newArticle;
  }

  async updateArticle(id: number, article: Partial<schema.InsertArticle>): Promise<schema.Article | undefined> {
    const [updatedArticle] = await db
      .update(schema.articles)
      .set({ ...article, updatedAt: new Date() })
      .where(eq(schema.articles.id, id))
      .returning();
    return updatedArticle;
  }

  async deleteArticle(id: number): Promise<boolean> {
    const result = await db.delete(schema.articles).where(eq(schema.articles.id, id));
    return result.count > 0;
  }

  async getBannerHighlights(): Promise<schema.BannerHighlight[]> {
    return await db.query.bannerHighlights.findMany();
  }

  async getBannerHighlight(id: number): Promise<schema.BannerHighlight | undefined> {
    return await db.query.bannerHighlights.findFirst({ where: eq(schema.bannerHighlights.id, id) });
  }

  async createBannerHighlight(bannerHighlight: schema.InsertBannerHighlight): Promise<schema.BannerHighlight> {
    const [newBannerHighlight] = await db
      .insert(schema.bannerHighlights)
      .values(bannerHighlight)
      .returning();
    return newBannerHighlight;
  }

  async updateBannerHighlight(id: number, bannerHighlight: Partial<schema.InsertBannerHighlight>): Promise<schema.BannerHighlight | undefined> {
    const [updatedBannerHighlight] = await db
      .update(schema.bannerHighlights)
      .set({ ...bannerHighlight, updatedAt: new Date() })
      .where(eq(schema.bannerHighlights.id, id))
      .returning();
    return updatedBannerHighlight;
  }

  async deleteBannerHighlight(id: number): Promise<boolean> {
    const result = await db.delete(schema.bannerHighlights).where(eq(schema.bannerHighlights.id, id));
    return result.count > 0;
  }

  async getDevelopers(): Promise<schema.Developer[]> {
    return await db.query.developers.findMany();
  }

  async getDeveloper(id: number): Promise<schema.Developer | undefined> {
    return await db.query.developers.findFirst({ where: eq(schema.developers.id, id) });
  }

  async createDeveloper(developer: schema.InsertDeveloper): Promise<schema.Developer> {
    const [newDeveloper] = await db
      .insert(schema.developers)
      .values(developer)
      .returning();
    return newDeveloper;
  }

  async updateDeveloper(id: number, developer: Partial<schema.InsertDeveloper>): Promise<schema.Developer | undefined> {
    const [updatedDeveloper] = await db
      .update(schema.developers)
      .set({ ...developer, updatedAt: new Date() })
      .where(eq(schema.developers.id, id))
      .returning();
    return updatedDeveloper;
  }

  async deleteDeveloper(id: number): Promise<boolean> {
    const result = await db.delete(schema.developers).where(eq(schema.developers.id, id));
    return result.count > 0;
  }

  async getSitemapEntries(): Promise<schema.Sitemap[]> {
    return await db.query.sitemap.findMany();
  }

  async getSitemapEntry(id: number): Promise<schema.Sitemap | undefined> {
    return await db.query.sitemap.findFirst({ where: eq(schema.sitemap.id, id) });
  }

  async createSitemapEntry(sitemapEntry: schema.InsertSitemap): Promise<schema.Sitemap> {
    const [newSitemapEntry] = await db
      .insert(schema.sitemap)
      .values(sitemapEntry)
      .returning();
    return newSitemapEntry;
  }

  async updateSitemapEntry(id: number, sitemapEntry: Partial<schema.InsertSitemap>): Promise<schema.Sitemap | undefined> {
    const [updatedSitemapEntry] = await db
      .update(schema.sitemap)
      .set({ ...sitemapEntry, updatedAt: new Date() })
      .where(eq(schema.sitemap.id, id))
      .returning();
    return updatedSitemapEntry;
  }

  async deleteSitemapEntry(id: number): Promise<boolean> {
    const result = await db.delete(schema.sitemap).where(eq(schema.sitemap.id, id));
    return result.count > 0;
  }
}

export const storage = new DbStorage();