import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema.js";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined. Please set it in your .env file.");
}

// Initialize PostgreSQL client and Drizzle ORM
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

// StorageInterface defines all CRUD operations for the application
export interface IStorage {

  upsertProperties(properties: Partial<schema.InsertProperty>[]): Promise<void>;

  // User operations
  getUser(id: number): Promise<schema.User | undefined>;
  getUserByUsername(username: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;

  // Property operations
  getProperties(): Promise<schema.Property[]>;
  getProperty(id: number): Promise<schema.Property | undefined>;
  getPropertyByReference(reference: string): Promise<schema.Property | undefined>;
  createProperty(property: schema.InsertProperty): Promise<schema.Property>;
  updateProperty(id: number, property: Partial<schema.InsertProperty>): Promise<schema.Property | undefined>;
  deleteProperty(id: number): Promise<boolean>;

  // Neighborhood operations
  getNeighborhoods(): Promise<schema.Neighborhood[]>;
  getNeighborhood(id: number): Promise<schema.Neighborhood | undefined>;
  createNeighborhood(neighborhood: schema.InsertNeighborhood): Promise<schema.Neighborhood>;
  updateNeighborhood(id: number, neighborhood: Partial<schema.InsertNeighborhood>): Promise<schema.Neighborhood | undefined>;
  deleteNeighborhood(id: number): Promise<boolean>;

  // Development operations
  getDevelopments(): Promise<schema.Development[]>;
  getDevelopment(id: number): Promise<schema.Development | undefined>;
  createDevelopment(development: schema.InsertDevelopment): Promise<schema.Development>;
  updateDevelopment(id: number, development: Partial<schema.InsertDevelopment>): Promise<schema.Development | undefined>;
  deleteDevelopment(id: number): Promise<boolean>;

  // Enquiry operations
  getEnquiries(): Promise<schema.Enquiry[]>;
  getEnquiry(id: number): Promise<schema.Enquiry | undefined>;
  createEnquiry(enquiry: schema.InsertEnquiry): Promise<schema.Enquiry>;
  updateEnquiry(id: number, enquiry: Partial<schema.Enquiry>): Promise<schema.Enquiry | undefined>;
  deleteEnquiry(id: number): Promise<boolean>;
  markEnquiryAsRead(id: number): Promise<schema.Enquiry | undefined>;

  // Agent operations
  getAgents(): Promise<schema.Agent[]>;
  getAgent(id: number): Promise<schema.Agent | undefined>;
  createAgent(agent: schema.InsertAgent): Promise<schema.Agent>;
  updateAgent(id: number, agent: Partial<schema.InsertAgent>): Promise<schema.Agent | undefined>;
  deleteAgent(id: number): Promise<boolean>;

  // Article operations
  getArticles(): Promise<schema.Article[]>;
  getArticle(id: number): Promise<schema.Article | undefined>;
  createArticle(article: schema.InsertArticle): Promise<schema.Article>;
  updateArticle(id: number, article: Partial<schema.InsertArticle>): Promise<schema.Article | undefined>;
  deleteArticle(id: number): Promise<boolean>;

  // Banner Highlight operations
  getBannerHighlights(): Promise<schema.BannerHighlight[]>;
  getBannerHighlight(id: number): Promise<schema.BannerHighlight | undefined>;
  createBannerHighlight(bannerHighlight: schema.InsertBannerHighlight): Promise<schema.BannerHighlight>;
  updateBannerHighlight(id: number, bannerHighlight: Partial<schema.InsertBannerHighlight>): Promise<schema.BannerHighlight | undefined>;
  deleteBannerHighlight(id: number): Promise<boolean>;

  // Developer operations
  getDevelopers(): Promise<schema.Developer[]>;
  getDeveloper(id: number): Promise<schema.Developer | undefined>;
  createDeveloper(developer: schema.InsertDeveloper): Promise<schema.Developer>;
  updateDeveloper(id: number, developer: Partial<schema.InsertDeveloper>): Promise<schema.Developer | undefined>;
  deleteDeveloper(id: number): Promise<boolean>;

  // Sitemap operations
  getSitemapEntries(): Promise<schema.Sitemap[]>;
  getSitemapEntry(id: number): Promise<schema.Sitemap | undefined>;
  createSitemapEntry(sitemapEntry: schema.InsertSitemap): Promise<schema.Sitemap>;
  updateSitemapEntry(id: number, sitemapEntry: Partial<schema.InsertSitemap>): Promise<schema.Sitemap | undefined>;
  deleteSitemapEntry(id: number): Promise<boolean>;
}

export class DbStorage implements IStorage {
  constructor() {
    // No in-memory maps needed; database handles persistence
  }

  // User methods
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

  // Property methods
  async getProperties(): Promise<schema.Property[]> {
    return await db.query.properties.findMany();
  }

  async getProperty(id: number): Promise<schema.Property | undefined> {
  console.log('Executing getProperty query for ID:', id, 'with type:', typeof id);
  const property = await db.query.properties.findFirst({ where: eq(schema.properties.id, id) });
  console.log('Query result for ID', id, ':', property);
  return property;
}

  async getPropertyByReference(reference: string): Promise<schema.Property | undefined> {
    return await db.query.properties.findFirst({ where: eq(schema.properties.reference, reference) });
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

  async deleteProperty(id: number): Promise<boolean> {
    const result = await db.delete(schema.properties).where(eq(schema.properties.id, id));
    return result.count > 0;
  }

  async upsertProperties(properties: Partial<schema.InsertProperty>[]): Promise<void> {
    await db.insert(schema.properties).values(properties as schema.InsertProperty[]).onConflictDoUpdate({
      target: schema.properties.reference,
      set: {
        listingType: schema.properties.listingType,
        propertyType: schema.properties.propertyType,
        subCommunity: schema.properties.subCommunity,
        community: schema.properties.community,
        region: schema.properties.region,
        country: schema.properties.country,
        agent: schema.properties.agent,
        price: schema.properties.price,
        currency: schema.properties.currency,
        bedrooms: schema.properties.bedrooms,
        bathrooms: schema.properties.bathrooms,
        propertyStatus: schema.properties.propertyStatus,
        title: schema.properties.title,
        description: schema.properties.description,
        sqfeetArea: schema.properties.sqfeetArea,
        sqfeetBuiltup: schema.properties.sqfeetBuiltup,
        isExclusive: schema.properties.isExclusive,
        amenities: schema.properties.amenities,
        isFeatured: schema.properties.isFeatured,
        isFitted: schema.properties.isFitted,
        isFurnished: schema.properties.isFurnished,
        lifestyle: schema.properties.lifestyle,
        permit: schema.properties.permit,
        brochure: schema.properties.brochure,
        images: schema.properties.images,
        development: schema.properties.development,
        neighbourhood: schema.properties.neighbourhood,
        sold: schema.properties.sold,
      },
    });
  }

  // Neighborhood methods
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

  // Development methods
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

  // Enquiry methods
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

  // Agent methods
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

  // Article methods
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

  // Banner Highlight methods
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

  // Developer methods
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

  // Sitemap methods
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