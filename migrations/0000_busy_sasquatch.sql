CREATE TABLE "agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_title" text,
	"languages" text,
	"license_number" text,
	"location" text,
	"name" text NOT NULL,
	"head_shot" text,
	"photo" text,
	"email" text NOT NULL,
	"phone" text,
	"introduction" text,
	"linkedin" text,
	"experience" integer,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"author" text,
	"category" text,
	"excerpt" text,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"date_published" text,
	"reading_time" integer,
	"external_id" text,
	"tile_image" text,
	"inline_images" jsonb,
	"body_start" text,
	"body_end" text,
	"is_disabled" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"super_feature" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "banner_highlights" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"headline" text NOT NULL,
	"subheading" text,
	"cta" text,
	"cta_link" text,
	"image" text,
	"is_active" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "developers" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url_slug" text NOT NULL,
	"country" text,
	"established_since" text,
	"logo" text,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "developments" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"area" text,
	"property_type" text,
	"property_description" text,
	"price" integer,
	"url_slug" text NOT NULL,
	"images" jsonb,
	"max_bedrooms" integer,
	"min_bedrooms" integer,
	"floors" integer,
	"total_units" integer,
	"min_area" integer,
	"max_area" integer,
	"address" text,
	"address_description" text,
	"currency" text,
	"amenities" text,
	"subtitle" text,
	"developer_link" text,
	"neighbourhood_link" text,
	"feature_on_homepage" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"message" text,
	"name" text,
	"phone" text,
	"property_reference" text,
	"subject" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "neighborhoods" (
	"id" serial PRIMARY KEY NOT NULL,
	"url_slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"region" text,
	"banner_image" text,
	"description" text,
	"location_attributes" text,
	"address" text,
	"available_properties" integer,
	"images" jsonb,
	"neighbour_image" text,
	"neighbours_text" text,
	"property_offers" text,
	"subtitle_blurb" text,
	"neighbourhood_details" text,
	"neighbourhood_expectation" text,
	"brochure" text,
	"show_on_footer" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"listing_type" text NOT NULL,
	"property_type" text NOT NULL,
	"sub_community" text,
	"community" text NOT NULL,
	"region" text NOT NULL,
	"country" text NOT NULL,
	"agent" jsonb,
	"price" integer NOT NULL,
	"currency" text NOT NULL,
	"bedrooms" integer,
	"bathrooms" integer,
	"property_status" text,
	"title" text NOT NULL,
	"description" text,
	"sqfeet_area" integer,
	"sqfeet_builtup" integer,
	"is_exclusive" boolean DEFAULT false,
	"amenities" text,
	"is_featured" boolean DEFAULT false,
	"is_fitted" boolean DEFAULT false,
	"is_furnished" boolean DEFAULT false,
	"lifestyle" text,
	"permit" text,
	"brochure" text,
	"images" jsonb,
	"is_disabled" boolean DEFAULT false,
	"development" text,
	"neighbourhood" text,
	"sold" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sitemap" (
	"id" serial PRIMARY KEY NOT NULL,
	"complete_url" text NOT NULL,
	"link_label" text NOT NULL,
	"section" text,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
