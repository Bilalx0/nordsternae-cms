// Type definitions for the admin dashboard

// Table column definition type
export type SortDirection = 'asc' | 'desc' | undefined;

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: string;
  cell?: (props: { row: { original: T } }) => React.ReactNode;
  enableSorting?: boolean;
  enableFiltering?: boolean;
}

// Sidebar navigation item type
export interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

// Status badge type
export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'default';

// Filter type for data tables
export interface Filter {
  id: string;
  value: string;
  operator?: string;
}

// Property form type
export interface PropertyFormValues {
  reference: string;
  listingType: string;
  propertyType: string;
  subCommunity?: string;
  community: string;
  region: string;
  country: string;
  agent?: { id: string; name: string }[];
  price: number;
  currency: string;
  bedrooms?: number;
  bathrooms?: number;
  propertyStatus?: string;
  title: string;
  description?: string;
  sqfeetArea?: number;
  sqfeetBuiltup?: number;
  isExclusive?: boolean;
  amenities?: string;
  isFeatured?: boolean;
  isFitted?: boolean;
  isFurnished?: boolean;
  lifestyle?: string;
  permit?: string;
  brochure?: string;
  images?: string[];
  isDisabled?: boolean;
  development?: string;
  neighbourhood?: string;
  sold?: boolean;
}

// Neighborhood form type
export interface NeighborhoodFormValues {
  urlSlug: string;
  title: string;
  subtitle?: string;
  region?: string;
  bannerImage?: string;
  description?: string;
  locationAttributes?: string;
  address?: string;
  availableProperties?: number;
  images?: string[];
  neighbourImage?: string;
  neighboursText?: string;
  propertyOffers?: string;
  subtitleBlurb?: string;
  neighbourhoodDetails?: string;
  neighbourhoodExpectation?: string;
  brochure?: string;
  showOnFooter?: boolean;
}

// Development form type
export interface DevelopmentFormValues {
  title: string;
  description?: string;
  area?: string;
  propertyType?: string;
  propertyDescription?: string;
  price?: number;
  urlSlug: string;
  images?: string[];
  maxBedrooms?: number;
  minBedrooms?: number;
  floors?: number;
  totalUnits?: number;
  minArea?: number;
  maxArea?: number;
  address?: string;
  addressDescription?: string;
  currency?: string;
  amenities?: string;
  subtitle?: string;
  developerLink?: string;
  neighbourhoodLink?: string;
  featureOnHomepage?: boolean;
}

// Enquiry form type
export interface EnquiryFormValues {
  email: string;
  message?: string;
  name?: string;
  phone?: string;
  propertyReference?: string;
  subject?: string;
}

// Agent form type
export interface AgentFormValues {
  jobTitle?: string;
  languages?: string;
  licenseNumber?: string;
  location?: string;
  name: string;
  headShot?: string;
  photo?: string;
  email: string;
  phone?: string;
  introduction?: string;
  linkedin?: string;
  experience?: number;
}

// Article form type
export interface ArticleFormValues {
  author?: string;
  category?: string;
  excerpt?: string;
  slug: string;
  title: string;
  datePublished?: string;
  readingTime?: number;
  externalId?: string;
  tileImage?: string;
  inlineImages?: string[];
  bodyStart?: string;
  bodyEnd?: string;
  isDisabled?: boolean;
  isFeatured?: boolean;
  superFeature?: boolean;
}

// Banner Highlight form type
export interface BannerHighlightFormValues {
  title: string;
  headline: string;
  subheading?: string;
  cta?: string;
  ctaLink?: string;
  image?: string;
  isActive?: boolean;
}

// Developer form type
export interface DeveloperFormValues {
  title: string;
  description?: string;
  urlSlug: string;
  country?: string;
  establishedSince?: string;
  logo?: string;
}

// Sitemap entry form type
export interface SitemapFormValues {
  completeUrl: string;
  linkLabel: string;
  section?: string;
}

// File upload response
export interface FileUploadResponse {
  url: string;
  filename: string;
}

// Dashboard statistics
export interface DashboardStats {
  totalProperties: number;
  totalEnquiries: number;
  totalAgents: number;
  totalArticles: number;
  recentEnquiries: any[];
  featuredProperties: any[];
}
