import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../shared/schema.js';
import { v2 as cloudinary } from 'cloudinary';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined. Please set it in your .env file.');
}

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  throw new Error('Cloudinary credentials are not defined. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.');
}

// Initialize PostgreSQL client and Drizzle ORM
const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Utility function for Cloudinary upload
const uploadToCloudinary = (buffer: Buffer, folder = 'profiles'): Promise<any> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: folder,
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto:good' },
        ],
      },
      (error, result) => {
        if (error) reject(error);
        else if (result) resolve(result);
        else reject(new Error('Cloudinary upload failed'));
      }
    ).end(buffer);
  });
};

// Storage interface (partial implementation for authentication)
export interface IStorage {
  // User operations
  getUser(id: number): Promise<schema.User | undefined>;
  getUserByUsername(username: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;
  updateUser(id: number, user: Partial<schema.InsertUser>): Promise<schema.User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  updatePassword(id: number, newPassword: string): Promise<boolean>;

  // Refresh token operations
  createRefreshToken(userId: number, token: string): Promise<void>;
  getRefreshToken(token: string): Promise<schema.RefreshToken | undefined>;
  updateRefreshToken(oldToken: string, newToken: string): Promise<boolean>;
  deleteRefreshToken(token: string): Promise<boolean>;
  deleteAllRefreshTokens(userId: number): Promise<void>;

  // Profile image operations
  uploadProfileImage(userId: number, buffer: Buffer): Promise<string>;
  deleteProfileImage(userId: number): Promise<boolean>;

  // Property operations (from original IStorage)
  upsertProperties(properties: Partial<schema.InsertProperty>[]): Promise<void>;
  getProperties(): Promise<schema.Property[]>;
  getProperty(id: number): Promise<schema.Property | undefined>;
  getPropertyByReference(reference: string): Promise<schema.Property | undefined>;
  createProperty(property: schema.InsertProperty): Promise<schema.Property>;
  updateProperty(id: number, property: Partial<schema.InsertProperty>): Promise<schema.Property | undefined>;
  deleteProperty(id: number): Promise<boolean>;

  // Other operations (implement as needed)
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
  constructor() {
    // Initialize storage (Drizzle ORM client is already set up)
  }

  // User methods
  async getUser(id: number): Promise<schema.User | undefined> {
    try {
      return await db.query.users.findFirst({ where: eq(schema.users.id, id) });
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      throw new Error('Failed to fetch user');
    }
  }

  async getUserByUsername(username: string): Promise<schema.User | undefined> {
    try {
      return await db.query.users.findFirst({ where: eq(schema.users.email, username.toLowerCase()) });
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw new Error('Failed to fetch user');
    }
  }

  async createUser(user: schema.InsertUser): Promise<schema.User> {
    try {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      const [newUser] = await db
        .insert(schema.users)
        .values({
          ...user,
          email: user.email.toLowerCase(),
          password: hashedPassword,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        })
        .returning();
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: number, user: Partial<schema.InsertUser>): Promise<schema.User | undefined> {
    try {
      const [updatedUser] = await db
        .update(schema.users)
        .set({ ...user, updatedAt: new Date() })
        .where(eq(schema.users.id, id))
        .returning();
      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.users).where(eq(schema.users.id, id));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  async updatePassword(id: number, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      const [result] = await db
        .update(schema.users)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(eq(schema.users.id, id))
        .returning();
      return !!result;
    } catch (error) {
      console.error('Error updating password:', error);
      throw new Error('Failed to update password');
    }
  }

  // Refresh token methods
  async createRefreshToken(userId: number, token: string): Promise<void> {
    try {
      await db
        .insert(schema.refreshTokens)
        .values({
          userId,
          token,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });
    } catch (error) {
      console.error('Error creating refresh token:', error);
      throw new Error('Failed to create refresh token');
    }
  }

  async getRefreshToken(token: string): Promise<schema.RefreshToken | undefined> {
    try {
      return await db.query.refreshTokens.findFirst({ where: eq(schema.refreshTokens.token, token) });
    } catch (error) {
      console.error('Error fetching refresh token:', error);
      throw new Error('Failed to fetch refresh token');
    }
  }

  async updateRefreshToken(oldToken: string, newToken: string): Promise<boolean> {
    try {
      const [result] = await db
        .update(schema.refreshTokens)
        .set({
          token: newToken,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .where(eq(schema.refreshTokens.token, oldToken))
        .returning();
      return !!result;
    } catch (error) {
      console.error('Error updating refresh token:', error);
      throw new Error('Failed to update refresh token');
    }
  }

  async deleteRefreshToken(token: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, token));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting refresh token:', error);
      throw new Error('Failed to delete refresh token');
    }
  }

  async deleteAllRefreshTokens(userId: number): Promise<void> {
    try {
      await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.userId, userId));
    } catch (error) {
      console.error('Error deleting all refresh tokens:', error);
      throw new Error('Failed to delete refresh tokens');
    }
  }

  // Profile image methods
  async uploadProfileImage(userId: number, buffer: Buffer): Promise<string> {
    try {
      // Get current user to check for existing image
      const user = await this.getUser(userId);
      if (user?.profileImage) {
        try {
          const publicId = user.profileImage.split('/').pop()?.split('.')[0];
          if (publicId) await cloudinary.uploader.destroy(`profiles/${publicId}`);
        } catch (deleteError) {
          console.log('Error deleting old image:', deleteError);
        }
      }

      // Upload new image to Cloudinary
      const result = await uploadToCloudinary(buffer);
      await db
        .update(schema.users)
        .set({ profileImage: result.secure_url, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
      return result.secure_url;
    } catch (error) {
      console.error('Error uploading profile image:', error);
      throw new Error('Failed to upload profile image');
    }
  }

  async deleteProfileImage(userId: number): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      if (!user?.profileImage) return false;

      try {
        const publicId = user.profileImage.split('/').pop()?.split('.')[0];
        if (publicId) await cloudinary.uploader.destroy(`profiles/${publicId}`);
      } catch (deleteError) {
        console.log('Error deleting profile image:', deleteError);
      }

      await db
        .update(schema.users)
        .set({ profileImage: null, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
      return true;
    } catch (error) {
      console.error('Error deleting profile image:', error);
      throw new Error('Failed to delete profile image');
    }
  }

  // Property methods (from original storage.ts)
  async upsertProperties(properties: Partial<schema.InsertProperty>[]): Promise<void> {
    try {
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
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error upserting properties:', error);
      throw new Error('Failed to upsert properties');
    }
  }

  async getProperties(): Promise<schema.Property[]> {
    try {
      return await db.query.properties.findMany();
    } catch (error) {
      console.error('Error fetching properties:', error);
      throw new Error('Failed to fetch properties');
    }
  }

  async getProperty(id: number): Promise<schema.Property | undefined> {
    try {
      console.log('Executing getProperty query for ID:', id, 'with type:', typeof id);
      const property = await db.query.properties.findFirst({ where: eq(schema.properties.id, id) });
      console.log('Query result for ID', id, ':', property);
      return property;
    } catch (error) {
      console.error('Error fetching property:', error);
      throw new Error('Failed to fetch property');
    }
  }

  async getPropertyByReference(reference: string): Promise<schema.Property | undefined> {
    try {
      return await db.query.properties.findFirst({ where: eq(schema.properties.reference, reference) });
    } catch (error) {
      console.error('Error fetching property by reference:', error);
      throw new Error('Failed to fetch property');
    }
  }

  async createProperty(property: schema.InsertProperty): Promise<schema.Property> {
    try {
      const [newProperty] = await db
        .insert(schema.properties)
        .values({ ...property, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return newProperty;
    } catch (error) {
      console.error('Error creating property:', error);
      throw new Error('Failed to create property');
    }
  }

  async updateProperty(id: number, property: Partial<schema.InsertProperty>): Promise<schema.Property | undefined> {
    try {
      const [updatedProperty] = await db
        .update(schema.properties)
        .set({ ...property, updatedAt: new Date() })
        .where(eq(schema.properties.id, id))
        .returning();
      return updatedProperty;
    } catch (error) {
      console.error('Error updating property:', error);
      throw new Error('Failed to update property');
    }
  }

  async deleteProperty(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.properties).where(eq(schema.properties.id, id));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting property:', error);
      throw new Error('Failed to delete property');
    }
  }

  // Placeholder methods for other entities (implement as needed)
  async getNeighborhoods(): Promise<schema.Neighborhood[]> {
    try {
      return await db.query.neighborhoods.findMany();
    } catch (error) {
      console.error('Error fetching neighborhoods:', error);
      throw new Error('Failed to fetch neighborhoods');
    }
  }

  async getNeighborhood(id: number): Promise<schema.Neighborhood | undefined> {
    try {
      return await db.query.neighborhoods.findFirst({ where: eq(schema.neighborhoods.id, id) });
    } catch (error) {
      console.error('Error fetching neighborhood:', error);
      throw new Error('Failed to fetch neighborhood');
    }
  }

  async createNeighborhood(neighborhood: schema.InsertNeighborhood): Promise<schema.Neighborhood> {
    try {
      const [newNeighborhood] = await db
        .insert(schema.neighborhoods)
        .values({ ...neighborhood, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return newNeighborhood;
    } catch (error) {
      console.error('Error creating neighborhood:', error);
      throw new Error('Failed to create neighborhood');
    }
  }

  async updateNeighborhood(id: number, neighborhood: Partial<schema.InsertNeighborhood>): Promise<schema.Neighborhood | undefined> {
    try {
      const [updatedNeighborhood] = await db
        .update(schema.neighborhoods)
        .set({ ...neighborhood, updatedAt: new Date() })
        .where(eq(schema.neighborhoods.id, id))
        .returning();
      return updatedNeighborhood;
    } catch (error) {
      console.error('Error updating neighborhood:', error);
      throw new Error('Failed to update neighborhood');
    }
  }

  async deleteNeighborhood(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.neighborhoods).where(eq(schema.neighborhoods.id, id));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting neighborhood:', error);
      throw new Error('Failed to delete neighborhood');
    }
  }

  async getDevelopments(): Promise<schema.Development[]> {
    try {
      return await db.query.developments.findMany();
    } catch (error) {
      console.error('Error fetching developments:', error);
      throw new Error('Failed to fetch developments');
    }
  }

  async getDevelopment(id: number): Promise<schema.Development | undefined> {
    try {
      return await db.query.developments.findFirst({ where: eq(schema.developments.id, id) });
    } catch (error) {
      console.error('Error fetching development:', error);
      throw new Error('Failed to fetch development');
    }
  }

  async createDevelopment(development: schema.InsertDevelopment): Promise<schema.Development> {
    try {
      const [newDevelopment] = await db
        .insert(schema.developments)
        .values({ ...development, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return newDevelopment;
    } catch (error) {
      console.error('Error creating development:', error);
      throw new Error('Failed to create development');
    }
  }

  async updateDevelopment(id: number, development: Partial<schema.InsertDevelopment>): Promise<schema.Development | undefined> {
    try {
      const [updatedDevelopment] = await db
        .update(schema.developments)
        .set({ ...development, updatedAt: new Date() })
        .where(eq(schema.developments.id, id))
        .returning();
      return updatedDevelopment;
    } catch (error) {
      console.error('Error updating development:', error);
      throw new Error('Failed to update development');
    }
  }

  async deleteDevelopment(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.developments).where(eq(schema.developments.id, id));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting development:', error);
      throw new Error('Failed to delete development');
    }
  }

  async getEnquiries(): Promise<schema.Enquiry[]> {
    try {
      return await db.query.enquiries.findMany();
    } catch (error) {
      console.error('Error fetching enquiries:', error);
      throw new Error('Failed to fetch enquiries');
    }
  }

  async getEnquiry(id: number): Promise<schema.Enquiry | undefined> {
    try {
      return await db.query.enquiries.findFirst({ where: eq(schema.enquiries.id, id) });
    } catch (error) {
      console.error('Error fetching enquiry:', error);
      throw new Error('Failed to fetch enquiry');
    }
  }

  async createEnquiry(enquiry: schema.InsertEnquiry): Promise<schema.Enquiry> {
    try {
      const [newEnquiry] = await db
        .insert(schema.enquiries)
        .values({ ...enquiry })
        .returning();
      return newEnquiry;
    } catch (error) {
      console.error('Error creating enquiry:', error);
      throw new Error('Failed to create enquiry');
    }
  }

  async updateEnquiry(id: number, enquiry: Partial<schema.Enquiry>): Promise<schema.Enquiry | undefined> {
    try {
      const [updatedEnquiry] = await db
        .update(schema.enquiries)
        .set({ ...enquiry })
        .where(eq(schema.enquiries.id, id))
        .returning();
      return updatedEnquiry;
    } catch (error) {
      console.error('Error updating enquiry:', error);
      throw new Error('Failed to update enquiry');
    }
  }

  async deleteEnquiry(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.enquiries).where(eq(schema.enquiries.id, id));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting enquiry:', error);
      throw new Error('Failed to delete enquiry');
    }
  }

  async markEnquiryAsRead(id: number): Promise<schema.Enquiry | undefined> {
    try {
      const [updatedEnquiry] = await db
        .update(schema.enquiries)
        .set({ isRead: true })
        .where(eq(schema.enquiries.id, id))
        .returning();
      return updatedEnquiry;
    } catch (error) {
      console.error('Error marking enquiry as read:', error);
      throw new Error('Failed to mark enquiry as read');
    }
  }

  async getAgents(): Promise<schema.Agent[]> {
    try {
      return await db.query.agents.findMany();
    } catch (error) {
      console.error('Error fetching agents:', error);
      throw new Error('Failed to fetch agents');
    }
  }

  async getAgent(id: number): Promise<schema.Agent | undefined> {
    try {
      return await db.query.agents.findFirst({ where: eq(schema.agents.id, id) });
    } catch (error) {
      console.error('Error fetching agent:', error);
      throw new Error('Failed to fetch agent');
    }
  }

  async createAgent(agent: schema.InsertAgent): Promise<schema.Agent> {
    try {
      const [newAgent] = await db
        .insert(schema.agents)
        .values({ ...agent, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return newAgent;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw new Error('Failed to create agent');
    }
  }

  async updateAgent(id: number, agent: Partial<schema.InsertAgent>): Promise<schema.Agent | undefined> {
    try {
      const [updatedAgent] = await db
        .update(schema.agents)
        .set({ ...agent, updatedAt: new Date() })
        .where(eq(schema.agents.id, id))
        .returning();
      return updatedAgent;
    } catch (error) {
      console.error('Error updating agent:', error);
      throw new Error('Failed to update agent');
    }
  }

  async deleteAgent(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.agents).where(eq(schema.agents.id, id));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting agent:', error);
      throw new Error('Failed to delete agent');
    }
  }

  async getArticles(): Promise<schema.Article[]> {
    try {
      return await db.query.articles.findMany();
    } catch (error) {
      console.error('Error fetching articles:', error);
      throw new Error('Failed to fetch articles');
    }
  }

  async getArticle(id: number): Promise<schema.Article | undefined> {
    try {
      return await db.query.articles.findFirst({ where: eq(schema.articles.id, id) });
    } catch (error) {
      console.error('Error fetching article:', error);
      throw new Error('Failed to fetch article');
    }
  }

  async createArticle(article: schema.InsertArticle): Promise<schema.Article> {
    try {
      const [newArticle] = await db
        .insert(schema.articles)
        .values({ ...article, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return newArticle;
    } catch (error) {
      console.error('Error creating article:', error);
      throw new Error('Failed to create article');
    }
  }

  async updateArticle(id: number, article: Partial<schema.InsertArticle>): Promise<schema.Article | undefined> {
    try {
      const [updatedArticle] = await db
        .update(schema.articles)
        .set({ ...article, updatedAt: new Date() })
        .where(eq(schema.articles.id, id))
        .returning();
      return updatedArticle;
    } catch (error) {
      console.error('Error updating article:', error);
      throw new Error('Failed to update article');
    }
  }

  async deleteArticle(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.articles).where(eq(schema.articles.id, id));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting article:', error);
      throw new Error('Failed to delete article');
    }
  }

  async getBannerHighlights(): Promise<schema.BannerHighlight[]> {
    try {
      return await db.query.bannerHighlights.findMany();
    } catch (error) {
      console.error('Error fetching banner highlights:', error);
      throw new Error('Failed to fetch banner highlights');
    }
  }

  async getBannerHighlight(id: number): Promise<schema.BannerHighlight | undefined> {
    try {
      return await db.query.bannerHighlights.findFirst({ where: eq(schema.bannerHighlights.id, id) });
    } catch (error) {
      console.error('Error fetching banner highlight:', error);
      throw new Error('Failed to fetch banner highlight');
    }
  }

  async createBannerHighlight(bannerHighlight: schema.InsertBannerHighlight): Promise<schema.BannerHighlight> {
    try {
      const [newBannerHighlight] = await db
        .insert(schema.bannerHighlights)
        .values({ ...bannerHighlight, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return newBannerHighlight;
    } catch (error) {
      console.error('Error creating banner highlight:', error);
      throw new Error('Failed to create banner highlight');
    }
  }

  async updateBannerHighlight(id: number, bannerHighlight: Partial<schema.InsertBannerHighlight>): Promise<schema.BannerHighlight | undefined> {
    try {
      const [updatedBannerHighlight] = await db
        .update(schema.bannerHighlights)
        .set({ ...bannerHighlight, updatedAt: new Date() })
        .where(eq(schema.bannerHighlights.id, id))
        .returning();
      return updatedBannerHighlight;
    } catch (error) {
      console.error('Error updating banner highlight:', error);
      throw new Error('Failed to update banner highlight');
    }
  }

  async deleteBannerHighlight(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.bannerHighlights).where(eq(schema.bannerHighlights.id, id));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting banner highlight:', error);
      throw new Error('Failed to delete banner highlight');
    }
  }

  async getDevelopers(): Promise<schema.Developer[]> {
    try {
      return await db.query.developers.findMany();
    } catch (error) {
      console.error('Error fetching developers:', error);
      throw new Error('Failed to fetch developers');
    }
  }

  async getDeveloper(id: number): Promise<schema.Developer | undefined> {
    try {
      return await db.query.developers.findFirst({ where: eq(schema.developers.id, id) });
    } catch (error) {
      console.error('Error fetching developer:', error);
      throw new Error('Failed to fetch developer');
    }
  }

  async createDeveloper(developer: schema.InsertDeveloper): Promise<schema.Developer> {
    try {
      const [newDeveloper] = await db
        .insert(schema.developers)
        .values({ ...developer, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return newDeveloper;
    } catch (error) {
      console.error('Error creating developer:', error);
      throw new Error('Failed to create developer');
    }
  }

  async updateDeveloper(id: number, developer: Partial<schema.InsertDeveloper>): Promise<schema.Developer | undefined> {
    try {
      const [updatedDeveloper] = await db
        .update(schema.developers)
        .set({ ...developer, updatedAt: new Date() })
        .where(eq(schema.developers.id, id))
        .returning();
      return updatedDeveloper;
    } catch (error) {
      console.error('Error updating developer:', error);
      throw new Error('Failed to update developer');
    }
  }

  async deleteDeveloper(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.developers).where(eq(schema.developers.id, id));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting developer:', error);
      throw new Error('Failed to delete developer');
    }
  }

  async getSitemapEntries(): Promise<schema.Sitemap[]> {
    try {
      return await db.query.sitemap.findMany();
    } catch (error) {
      console.error('Error fetching sitemap entries:', error);
      throw new Error('Failed to fetch sitemap entries');
    }
  }

  async getSitemapEntry(id: number): Promise<schema.Sitemap | undefined> {
    try {
      return await db.query.sitemap.findFirst({ where: eq(schema.sitemap.id, id) });
    } catch (error) {
      console.error('Error fetching sitemap entry:', error);
      throw new Error('Failed to fetch sitemap entry');
    }
  }

  async createSitemapEntry(sitemapEntry: schema.InsertSitemap): Promise<schema.Sitemap> {
    try {
      const [newSitemapEntry] = await db
        .insert(schema.sitemap)
        .values({ ...sitemapEntry, createdAt: new Date(), updatedAt: new Date() })
        .returning();
      return newSitemapEntry;
    } catch (error) {
      console.error('Error creating sitemap entry:', error);
      throw new Error('Failed to create sitemap entry');
    }
  }

  async updateSitemapEntry(id: number, sitemapEntry: Partial<schema.InsertSitemap>): Promise<schema.Sitemap | undefined> {
    try {
      const [updatedSitemapEntry] = await db
        .update(schema.sitemap)
        .set({ ...sitemapEntry, updatedAt: new Date() })
        .where(eq(schema.sitemap.id, id))
        .returning();
      return updatedSitemapEntry;
    } catch (error) {
      console.error('Error updating sitemap entry:', error);
      throw new Error('Failed to update sitemap entry');
    }
  }

  async deleteSitemapEntry(id: number): Promise<boolean> {
    try {
      const result = await db.delete(schema.sitemap).where(eq(schema.sitemap.id, id));
      return result.count > 0;
    } catch (error) {
      console.error('Error deleting sitemap entry:', error);
      throw new Error('Failed to delete sitemap entry');
    }
  }
}

export const storage = new DbStorage();