import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema.js";
import { eq, sql } from "drizzle-orm";
import * as dotenv from "dotenv";
import Redis from "ioredis";
import CircuitBreaker from "opossum";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined. Please set it in your .env file.");
}

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Initialize PostgreSQL client with pooling
const client = postgres(process.env.DATABASE_URL, {
  max: 10, // Max connections
  min: 2,  // Min connections
  idle_timeout: 30, // Close idle connections after 30s
  onnotice: () => {}, // Suppress notices
  connection: {
    application_name: "property-api",
  },
});

// Health check and retry logic
async function checkConnection() {
  try {
    await client`SELECT 1`;
    console.log("Database connection established");
  } catch (error) {
    console.error("Database connection failed:", error);
    throw error;
  }
}

checkConnection().catch(() => process.exit(1));

// Initialize Drizzle ORM
const db = drizzle(client, { schema });

// Circuit breaker configuration
const breakerOptions = {
  timeout: 5000, // 5s timeout
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const breaker = new CircuitBreaker(async (fn: () => Promise<any>) => fn(), breakerOptions);

async function queryWithBreaker<T>(fn: () => Promise<T>): Promise<T> {
  return breaker.fire(fn);
}

export const queryWithBreaker = async <T>(fn: () => Promise<T>): Promise<T> => {
  const breaker = new CircuitBreaker(fn, breakerOptions);
  return breaker.fire();
};


// StorageInterface defines all CRUD operations
export interface IStorage {
  getAllPropertyReferences(): Promise<{ reference: string }[]>;
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
  getProperties(page?: number, pageSize?: number, filters?: Record<string, string | number>): Promise<
    schema.Property[]
  >;
  getProperty(id: number): Promise<schema.Property | undefined>;
  getPropertyByReference(reference: string): Promise<schema.Property | undefined>;
  createProperty(property: schema.InsertProperty): Promise<schema.Property>;
  updateProperty(id: number, property: Partial<schema.InsertProperty>): Promise  Partial<schema.InsertProperty>;
  updatePropertyByReference(reference: string, property: Partial<schema.InsertProperty>): Promise<
    schema.Property | undefined
  >;
  deleteProperty(id: number): Promise<boolean>;
  getNeighborhoods(): Promise<schema.Neighborhood[]>;
  getNeighborhood(id: number): Promise<schema.Neighborhood | undefined>;
  createNeighborhood(neighborhood: schema.InsertNeighborhood): Promise<schema.Neighborhood>;
  updateNeighborhood(id: number, neighborhood: Partial<schema.InsertNeighborhood>): Promise<
    schema.Neighborhood | undefined
  >;
  deleteNeighborhood(id: number): Promise<boolean>;
  getDevelopments(): Promise<schema.Development[]>;
  getDevelopment(id: number): Promise<schema.Development | undefined>;
  createDevelopment(development: schema.InsertDevelopment): Promise<schema.Development>;
  updateDevelopment(id: number, development: Partial<schema.InsertDevelopment>): Promise<
    schema.Development | undefined
  >;
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
  updateBannerHighlight(id: number, bannerHighlight: Partial<schema.InsertBannerHighlight>): Promise<
    schema.BannerHighlight | undefined
  >;
  deleteBannerHighlight(id: number): Promise<boolean>;
  getDevelopers(): Promise<schema.Developer[]>;
  getDeveloper(id: number): Promise<schema.Developer | undefined>;
  createDeveloper(developer: schema.InsertDeveloper): Promise<schema.Developer>;
  updateDeveloper(id: number, developer: Partial<schema.InsertDeveloper>): Promise<
    schema.Developer | undefined
  >;
  deleteDeveloper(id: number): Promise<boolean>;
  getSitemapEntries(): Promise<schema.Sitemap[]>;
  getSitemapEntry(id: number): Promise<schema.Sitemap | undefined>;
  createSitemapEntry(sitemapEntry: schema.InsertSitemap): Promise<schema.Sitemap>;
  updateSitemapEntry(id: number, sitemapEntry: Partial<schema.InsertSitemap>): Promise<
    schema.Sitemap | undefined
  >;
  deleteSitemapEntry(id: number): Promise<boolean>;
}

export class DbStorage implements IStorage {
  constructor() {}

  async getAllPropertyReferences(): Promise<{ reference: string }[]> {
    return queryWithBreaker(async () => {
      const cacheKey = "property_references";
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const start = Date.now();
      const result = await db
        .select({ reference: schema.properties.reference })
        .from(schema.properties)
        .limit(1000); // Cap results to prevent overload
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getAllPropertyReferences took ${duration}ms`);
      }

      await redis.set(cacheKey, JSON.stringify(result), "EX", 300); // 5 min TTL
      return result;
    });
  }

  async bulkInsertProperties(
    properties: schema.InsertProperty[],
    chunkSize: number = 100
  ): Promise<{
    success: number;
    errors: Array<{ reference: string; error: string }>;
  }> {
    if (properties.length === 0) {
      return { success: 0, errors: [] };
    }

    return queryWithBreaker(async () => {
      let success = 0;
      const errors: Array<{ reference: string; error: string }> = [];

      await db.transaction(async (tx) => {
        for (let i = 0; i < properties.length; i += chunkSize) {
          const chunk = properties.slice(i, i + chunkSize);
          try {
            await tx.insert(schema.properties).values(chunk).returning();
            success += chunk.length;
          } catch (error) {
            for (const property of chunk) {
              try {
                await tx.insert(schema.properties).values(property).returning();
                success++;
              } catch (individualError) {
                errors.push({
                  reference: property.reference || "unknown",
                  error:
                    individualError instanceof Error
                      ? individualError.message
                      : "Unknown error",
                });
              }
            }
          }
        }
      });

      await redis.del("property_references"); // Invalidate cache
      await redis.del("properties_list"); // Invalidate properties cache
      return { success, errors };
    });
  }

  async upsertProperties(
    properties: Partial<schema.InsertProperty>[]
  ): Promise<{
    success: number;
    errors: Array<{ reference: string; error: string }>;
  }> {
    if (properties.length === 0) {
      return { success: 0, errors: [] };
    }

    return queryWithBreaker(async () => {
      let success = 0;
      const errors: Array<{ reference: string; error: string }> = [];

      await db.transaction(async (tx) => {
        // Fetch existing references in one query
        const existingRefs = new Set(
          (
            await tx
              .select({ reference: schema.properties.reference })
              .from(schema.properties)
              .where(
                sql`${schema.properties.reference} IN (${properties
                  .map((p) => p.reference)
                  .filter(Boolean)})`
              )
          ).map((r) => r.reference)
        );

        const toInsert: schema.InsertProperty[] = [];
        const toUpdate: schema.InsertProperty[] = [];

        for (const property of properties as schema.InsertProperty[]) {
          if (!property.reference) {
            errors.push({ reference: "unknown", error: "Missing reference field" });
            continue;
          }
          if (existingRefs.has(property.reference)) {
            toUpdate.push({ ...property, updatedAt: new Date() });
          } else {
            toInsert.push(property);
          }
        }

        if (toInsert.length > 0) {
          try {
            await tx.insert(schema.properties).values(toInsert);
            success += toInsert.length;
          } catch (error) {
            errors.push(
              ...toInsert.map((p) => ({
                reference: p.reference,
                error: error instanceof Error ? error.message : "Insert failed",
              }))
            );
          }
        }

        if (toUpdate.length > 0) {
          for (const property of toUpdate) {
            try {
              await tx
                .insert(schema.properties)
                .values(property)
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
              success++;
            } catch (error) {
              errors.push({
                reference: property.reference,
                error: error instanceof Error ? error.message : "Update failed",
              });
            }
          }
        }
      });

      await redis.del("property_references"); // Invalidate cache
      await redis.del("properties_list"); // Invalidate properties cache
      return { success, errors };
    });
  }

  async upsertSingleProperty(property: schema.InsertProperty): Promise<schema.Property> {
    return queryWithBreaker(async () => {
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
    });
  }

  async getUser(id: number): Promise<schema.User | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getUser took ${duration}ms`);
      }
      return result;
    });
  }

  async getUserByUsername(username: string): Promise<schema.User | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getUserByUsername took ${duration}ms`);
      }
      return result;
    });
  }

  async createUser(user: schema.InsertUser): Promise<schema.User> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [newUser] = await db
        .insert(schema.users)
        .values({ ...user, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: createUser took ${duration}ms`);
      }
      return newUser;
    });
  }

  async getProperties(
    page: number = 1,
    pageSize: number = 50,
    filters: Record<string, string | number> = {}
  ): Promise<schema.Property[]> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const cacheKey = `properties:${page}:${pageSize}:${JSON.stringify(filters)}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      let query = db
        .select({
          id: schema.properties.id,
          reference: schema.properties.reference,
          listingType: schema.properties.listingType,
          price: schema.properties.price,
          bedrooms: schema.properties.bedrooms,
          bathrooms: schema.properties.bathrooms,
          propertyStatus: schema.properties.propertyStatus,
          updatedAt: schema.properties.updatedAt,
        })
        .from(schema.properties);

      for (const [key, value] of Object.entries(filters)) {
        if (typeof value === "string") {
          query = query.where(sql`${schema.properties[key]} ILIKE ${`%${value}%`}`);
        } else if (typeof value === "number") {
          query = query.where(eq(schema.properties[key], value));
        }
      }

      const result = await query.limit(pageSize).offset((page - 1) * pageSize);
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getProperties took ${duration}ms`);
      }

      await redis.set(cacheKey, JSON.stringify(result), "EX", 300); // 5 min TTL
      return result;
    });
  }

  async getProperty(id: number): Promise<schema.Property | undefined> {
    return queryWithBreaker(async () => {
      console.log("Executing getProperty query for ID:", id, "with type:", typeof id);
      const start = Date.now();
      const property = await db.query.properties.findFirst({
        where: eq(schema.properties.id, id),
      });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getProperty took ${duration}ms`);
      }
      console.log("Query result for ID", id, ":", property);
      return property;
    });
  }

  async getPropertyByReference(reference: string): Promise<schema.Property | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const property = await db.query.properties.findFirst({
        where: eq(schema.properties.reference, reference),
      });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getPropertyByReference took ${duration}ms`);
      }
      return property;
    });
  }

  async createProperty(property: schema.InsertProperty): Promise<schema.Property> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [newProperty] = await db
        .insert(schema.properties)
        .values(property)
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: createProperty took ${duration}ms`);
      }
      await redis.del("property_references"); // Invalidate cache
      await redis.del("properties_list"); // Invalidate properties cache
      return newProperty;
    });
  }

  async updateProperty(
    id: number,
    property: Partial<schema.InsertProperty>
  ): Promise<schema.Property | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedProperty] = await db
        .update(schema.properties)
        .set({ ...property, updatedAt: new Date() })
        .where(eq(schema.properties.id, id))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: updateProperty took ${duration}ms`);
      }
      await redis.del("properties_list"); // Invalidate cache
      return updatedProperty;
    });
  }

  async updatePropertyByReference(
    reference: string,
    property: Partial<schema.InsertProperty>
  ): Promise<schema.Property | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedProperty] = await db
        .update(schema.properties)
        .set({ ...property, updatedAt: new Date() })
        .where(eq(schema.properties.reference, reference))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: updatePropertyByReference took ${duration}ms`);
      }
      await redis.del("properties_list"); // Invalidate cache
      return updatedProperty;
    });
  }

  async deleteProperty(id: number): Promise<boolean> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.delete(schema.properties).where(eq(schema.properties.id, id));
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: deleteProperty took ${duration}ms`);
      }
      await redis.del("properties_list"); // Invalidate cache
      return result.count > 0;
    });
  }

  async getNeighborhoods(): Promise<schema.Neighborhood[]> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.neighborhoods.findMany();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getNeighborhoods took ${duration}ms`);
      }
      return result;
    });
  }

  async getNeighborhood(id: number): Promise<schema.Neighborhood | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.neighborhoods.findFirst({
        where: eq(schema.neighborhoods.id, id),
      });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getNeighborhood took ${duration}ms`);
      }
      return result;
    });
  }

  async createNeighborhood(neighborhood: schema.InsertNeighborhood): Promise<schema.Neighborhood> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [newNeighborhood] = await db
        .insert(schema.neighborhoods)
        .values(neighborhood)
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: createNeighborhood took ${duration}ms`);
      }
      return newNeighborhood;
    });
  }

  async updateNeighborhood(
    id: number,
    neighborhood: Partial<schema.InsertNeighborhood>
  ): Promise<schema.Neighborhood | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedNeighborhood] = await db
        .update(schema.neighborhoods)
        .set({ ...neighborhood, updatedAt: new Date() })
        .where(eq(schema.neighborhoods.id, id))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: updateNeighborhood took ${duration}ms`);
      }
      return updatedNeighborhood;
    });
  }

  async deleteNeighborhood(id: number): Promise<boolean> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.delete(schema.neighborhoods).where(eq(schema.neighborhoods.id, id));
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: deleteNeighborhood took ${duration}ms`);
      }
      return result.count > 0;
    });
  }

  async getDevelopments(): Promise<schema.Development[]> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.developments.findMany();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getDevelopments took ${duration}ms`);
      }
      return result;
    });
  }

  async getDevelopment(id: number): Promise<schema.Development | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.developments.findFirst({
        where: eq(schema.developments.id, id),
      });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getDevelopment took ${duration}ms`);
      }
      return result;
    });
  }

  async createDevelopment(development: schema.InsertDevelopment): Promise<schema.Development> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [newDevelopment] = await db
        .insert(schema.developments)
        .values(development)
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: createDevelopment took ${duration}ms`);
      }
      return newDevelopment;
    });
  }

  async updateDevelopment(
    id: number,
    development: Partial<schema.InsertDevelopment>
  ): Promise<schema.Development | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedDevelopment] = await db
        .update(schema.developments)
        .set({ ...development, updatedAt: new Date() })
        .where(eq(schema.developments.id, id))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: updateDevelopment took ${duration}ms`);
      }
      return updatedDevelopment;
    });
  }

  async deleteDevelopment(id: number): Promise<boolean> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.delete(schema.developments).where(eq(schema.developments.id, id));
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: deleteDevelopment took ${duration}ms`);
      }
      return result.count > 0;
    });
  }

  async getEnquiries(): Promise<schema.Enquiry[]> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.enquiries.findMany();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getEnquiries took ${duration}ms`);
      }
      return result;
    });
  }

  async getEnquiry(id: number): Promise<schema.Enquiry | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.enquiries.findFirst({
        where: eq(schema.enquiries.id, id),
      });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getEnquiry took ${duration}ms`);
      }
      return result;
    });
  }

  async createEnquiry(enquiry: schema.InsertEnquiry): Promise<schema.Enquiry> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [newEnquiry] = await db.insert(schema.enquiries).values(enquiry).returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: createEnquiry took ${duration}ms`);
      }
      return newEnquiry;
    });
  }

  async updateEnquiry(
    id: number,
    enquiry: Partial<schema.Enquiry>
  ): Promise<schema.Enquiry | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedEnquiry] = await db
        .update(schema.enquiries)
        .set(enquiry)
        .where(eq(schema.enquiries.id, id))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: updateEnquiry took ${duration}ms`);
      }
      return updatedEnquiry;
    });
  }

  async deleteEnquiry(id: number): Promise<boolean> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.delete(schema.enquiries).where(eq(schema.enquiries.id, id));
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: deleteEnquiry took ${duration}ms`);
      }
      return result.count > 0;
    });
  }

  async markEnquiryAsRead(id: number): Promise<schema.Enquiry | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedEnquiry] = await db
        .update(schema.enquiries)
        .set({ isRead: true })
        .where(eq(schema.enquiries.id, id))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: markEnquiryAsRead took ${duration}ms`);
      }
      return updatedEnquiry;
    });
  }

  async getAgents(): Promise<schema.Agent[]> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.agents.findMany();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getAgents took ${duration}ms`);
      }
      return result;
    });
  }

  async getAgent(id: number): Promise<schema.Agent | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.agents.findFirst({ where: eq(schema.agents.id, id) });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getAgent took ${duration}ms`);
      }
      return result;
    });
  }

  async createAgent(agent: schema.InsertAgent): Promise<schema.Agent> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [newAgent] = await db.insert(schema.agents).values(agent).returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: createAgent took ${duration}ms`);
      }
      return newAgent;
    });
  }

  async updateAgent(id: number, agent: Partial<schema.InsertAgent>): Promise<schema.Agent | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedAgent] = await db
        .update(schema.agents)
        .set({ ...agent, updatedAt: new Date() })
        .where(eq(schema.agents.id, id))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: updateAgent took ${duration}ms`);
      }
      return updatedAgent;
    });
  }

  async deleteAgent(id: number): Promise<boolean> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.delete(schema.agents).where(eq(schema.agents.id, id));
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: deleteAgent took ${duration}ms`);
      }
      return result.count > 0;
    });
  }

  async getArticles(): Promise<schema.Article[]> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.articles.findMany();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getArticles took ${duration}ms`);
      }
      return result;
    });
  }

  async getArticle(id: number): Promise<schema.Article | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.articles.findFirst({ where: eq(schema.articles.id, id) });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getArticle took ${duration}ms`);
      }
      return result;
    });
  }

  async createArticle(article: schema.InsertArticle): Promise<schema.Article> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [newArticle] = await db.insert(schema.articles).values(article).returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: createArticle took ${duration}ms`);
      }
      return newArticle;
    });
  }

  async updateArticle(
    id: number,
    article: Partial<schema.InsertArticle>
  ): Promise<schema.Article | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedArticle] = await db
        .update(schema.articles)
        .set({ ...article, updatedAt: new Date() })
        .where(eq(schema.articles.id, id))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: updateArticle took ${duration}ms`);
      }
      return updatedArticle;
    });
  }

  async deleteArticle(id: number): Promise<boolean> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.delete(schema.articles).where(eq(schema.articles.id, id));
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: deleteArticle took ${duration}ms`);
      }
      return result.count > 0;
    });
  }

  async getBannerHighlights(): Promise<schema.BannerHighlight[]> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.bannerHighlights.findMany();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getBannerHighlights took ${duration}ms`);
      }
      return result;
    });
  }

  async getBannerHighlight(id: number): Promise<schema.BannerHighlight | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.bannerHighlights.findFirst({
        where: eq(schema.bannerHighlights.id, id),
      });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getBannerHighlight took ${duration}ms`);
      }
      return result;
    });
  }

  async createBannerHighlight(
    bannerHighlight: schema.InsertBannerHighlight
  ): Promise<schema.BannerHighlight> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [newBannerHighlight] = await db
        .insert(schema.bannerHighlights)
        .values(bannerHighlight)
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: createBannerHighlight took ${duration}ms`);
      }
      return newBannerHighlight;
    });
  }

  async updateBannerHighlight(
    id: number,
    bannerHighlight: Partial<schema.InsertBannerHighlight>
  ): Promise<schema.BannerHighlight | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedBannerHighlight] = await db
        .update(schema.bannerHighlights)
        .set({ ...bannerHighlight, updatedAt: new Date() })
        .where(eq(schema.bannerHighlights.id, id))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: updateBannerHighlight took ${duration}ms`);
      }
      return updatedBannerHighlight;
    });
  }

  async deleteBannerHighlight(id: number): Promise<boolean> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.delete(schema.bannerHighlights).where(
        eq(schema.bannerHighlights.id, id)
      );
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: deleteBannerHighlight took ${duration}ms`);
      }
      return result.count > 0;
    });
  }

  async getDevelopers(): Promise<schema.Developer[]> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.developers.findMany();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getDevelopers took ${duration}ms`);
      }
      return result;
    });
  }

  async getDeveloper(id: number): Promise<schema.Developer | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.developers.findFirst({
        where: eq(schema.developers.id, id),
      });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getDeveloper took ${duration}ms`);
      }
      return result;
    });
  }

  async createDeveloper(developer: schema.InsertDeveloper): Promise<schema.Developer> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [newDeveloper] = await db.insert(schema.developers).values(developer).returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: createDeveloper took ${duration}ms`);
      }
      return newDeveloper;
    });
  }

  async updateDeveloper(
    id: number,
    developer: Partial<schema.InsertDeveloper>
  ): Promise<schema.Developer | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedDeveloper] = await db
        .update(schema.developers)
        .set({ ...developer, updatedAt: new Date() })
        .where(eq(schema.developers.id, id))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: updateDeveloper took ${duration}ms`);
      }
      return updatedDeveloper;
    });
  }

  async deleteDeveloper(id: number): Promise<boolean> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.delete(schema.developers).where(eq(schema.developers.id, id));
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: deleteDeveloper took ${duration}ms`);
      }
      return result.count > 0;
    });
  }

  async getSitemapEntries(): Promise<schema.Sitemap[]> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.sitemap.findMany();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getSitemapEntries took ${duration}ms`);
      }
      return result;
    });
  }

  async getSitemapEntry(id: number): Promise<schema.Sitemap | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.query.sitemap.findFirst({ where: eq(schema.sitemap.id, id) });
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: getSitemapEntry took ${duration}ms`);
      }
      return result;
    });
  }

  async createSitemapEntry(sitemapEntry: schema.InsertSitemap): Promise<schema.Sitemap> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [newSitemapEntry] = await db
        .insert(schema.sitemap)
        .values(sitemapEntry)
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: createSitemapEntry took ${duration}ms`);
      }
      return newSitemapEntry;
    });
  }

  async updateSitemapEntry(
    id: number,
    sitemapEntry: Partial<schema.InsertSitemap>
  ): Promise<schema.Sitemap | undefined> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const [updatedSitemapEntry] = await db
        .update(schema.sitemap)
        .set({ ...sitemapEntry, updatedAt: new Date() })
        .where(eq(schema.sitemap.id, id))
        .returning();
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: updateSitemapEntry took ${duration}ms`);
      }
      return updatedSitemapEntry;
    });
  }

  async deleteSitemapEntry(id: number): Promise<boolean> {
    return queryWithBreaker(async () => {
      const start = Date.now();
      const result = await db.delete(schema.sitemap).where(eq(schema.sitemap.id, id));
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.warn(`Slow query detected: deleteSitemapEntry took ${duration}ms`);
      }
      return result.count > 0;
    });
  }
}

export const storage = new DbStorage();