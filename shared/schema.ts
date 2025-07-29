import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  profileImage: text("profile_image"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  firstName: true,
  lastName: true,
  profileImage: true,
  isVerified: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRefreshTokenSchema = createInsertSchema(refreshTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;
export type RefreshToken = typeof refreshTokens.$inferSelect;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey(),
  token: varchar("token").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull(),
  listingType: text("listing_type").notNull(),
  propertyType: text("property_type").notNull(),
  subCommunity: text("sub_community"),
  community: text("community").notNull(),
  region: text("region").notNull(),
  country: text("country").notNull(),
  agent: jsonb("agent"),
  price: integer("price").notNull(),
  currency: text("currency").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  propertyStatus: text("property_status"),
  title: text("title").notNull(),
  description: text("description"),
  sqfeetArea: integer("sqfeet_area"),
  sqfeetBuiltup: integer("sqfeet_builtup"),
  isExclusive: boolean("is_exclusive").default(false),
  amenities: text("amenities"),
  isFeatured: boolean("is_featured").default(false),
  isFitted: boolean("is_fitted").default(false),
  isFurnished: boolean("is_furnished").default(false),
  lifestyle: text("lifestyle"),
  permit: text("permit"),
  brochure: text("brochure"),
  images: jsonb("images"),
  isDisabled: boolean("is_disabled-tempered").default(false),
  development: text("development"),
  neighbourhood: text("neighbourhood"),
  sold: boolean("sold").default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

export const neighborhoods = pgTable("neighborhoods", {
  id: serial("id").primaryKey(),
  urlSlug: text("url_slug").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  region: text("region"),
  bannerImage: text("banner_image"),
  description: text("description"),
  locationAttributes: text("location_attributes"),
  address: text("address"),
  availableProperties: integer("available_properties"),
  images: jsonb("images"),
  neighbourImage: text("neighbour_image"),
  neighboursText: text("neighbours_text"),
  propertyOffers: text("property_offers"),
  subtitleBlurb: text("subtitle_blurb"),
  neighbourhoodDetails: text("neighbourhood_details"),
  neighbourhoodExpectation: text("neighbourhood_expectation"),
  brochure: text("brochure"),
  showOnFooter: boolean("show_on_footer").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNeighborhoodSchema = createInsertSchema(neighborhoods).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export type InsertNeighborhood = z.infer<typeof insertNeighborhoodSchema>;
export type Neighborhood = typeof neighborhoods.$inferSelect;

export const developments = pgTable("developments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  area: text("area"),
  propertyType: text("property_type"),
  propertyDescription: text("property_description"),
  price: integer("price"),
  urlSlug: text("url_slug").notNull(),
  images: jsonb("images"),
  maxBedrooms: integer("max_bedrooms"),
  minBedrooms: integer("min_bedrooms"),
  floors: integer("floors"),
  totalUnits: integer("total_units"),
  minArea: integer("min_area"),
  maxArea: integer("max_area"),
  address: text("address"),
  addressDescription: text("address_description"),
  currency: text("currency"),
  amenities: text("amenities"),
  subtitle: text("subtitle"),
  developerLink: text("developer_link"),
  neighbourhoodLink: text("neighbourhood_link"),
  featureOnHomepage: boolean("feature_on_homepage").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDevelopmentSchema = createInsertSchema(developments).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export type InsertDevelopment = z.infer<typeof insertDevelopmentSchema>;
export type Development = typeof developments.$inferSelect;

export const enquiries = pgTable("enquiries", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  message: text("message"),
  name: text("name"),
  phone: text("phone"),
  propertyReference: text("property_reference"),
  subject: text("subject"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEnquirySchema = createInsertSchema(enquiries).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

export type InsertEnquiry = z.infer<typeof insertEnquirySchema>;
export type Enquiry = typeof enquiries.$inferSelect;

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  jobTitle: text("job_title"),
  languages: text("languages"),
  licenseNumber: text("license_number"),
  location: text("location"),
  name: text("name").notNull(),
  headShot: text("head_shot"),
  photo: text("photo"),
  email: text("email").notNull(),
  phone: text("phone"),
  introduction: text("introduction"),
  linkedin: text("linkedin"),
  experience: integer("experience"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  author: text("author"),
  category: text("category"),
  excerpt: text("excerpt"),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  datePublished: text("date_published"),
  readingTime: integer("reading_time"),
  externalId: text("external_id"),
  tileImage: text("tile_image"),
  inlineImages: jsonb("inline_images"),
  bodyStart: text("body_start"),
  bodyEnd: text("body_end"),
  isDisabled: boolean("is_disabled").default(false),
  isFeatured: boolean("is_featured").default(false),
  superFeature: boolean("super_feature").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type Article = typeof articles.$inferSelect;

export const bannerHighlights = pgTable("banner_highlights", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  headline: text("headline").notNull(),
  subheading: text("subheading"),
  cta: text("cta"),
  ctaLink: text("cta_link"),
  image: text("image"),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBannerHighlightSchema = createInsertSchema(bannerHighlights).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export type InsertBannerHighlight = z.infer<typeof insertBannerHighlightSchema>;
export type BannerHighlight = typeof bannerHighlights.$inferSelect;

export const developers = pgTable("developers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  urlSlug: text("url_slug").notNull(),
  country: text("country"),
  establishedSince: text("established_since"),
  logo: text("logo"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDeveloperSchema = createInsertSchema(developers).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export type InsertDeveloper = z.infer<typeof insertDeveloperSchema>;
export type Developer = typeof developers.$inferSelect;

export const sitemap = pgTable("sitemap", {
  id: serial("id").primaryKey(),
  completeUrl: text("complete_url").notNull(),
  linkLabel: text("link_label").notNull(),
  section: text("section"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSitemapSchema = createInsertSchema(sitemap).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});

export type InsertSitemap = z.infer<typeof insertSitemapSchema>;
export type Sitemap = typeof sitemap.$inferSelect;