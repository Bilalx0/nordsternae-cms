import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ArticleFormValues } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import imageCompression from "browser-image-compression";
import { supabase } from "@/lib/supabase";

// Zod schema for form validation
const articleFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters"),
  author: z.string().optional(),
  category: z.string().optional(),
  excerpt: z.string().optional(),
  datePublished: z.string().optional(),
  readingTime: z.number().int().min(1).optional(),
  externalId: z.string().optional(),
  tileImage: z.string().optional(),
  inlineImages: z.array(z.string()).optional(),
  bodyStart: z.string().optional(),
  bodyEnd: z.string().optional(),
  isDisabled: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  superFeature: z.boolean().optional(),
});

const defaultValues: ArticleFormValues = {
  title: "",
  slug: "",
  author: "",
  category: "",
  excerpt: "",
  datePublished: new Date().toLocaleDateString("en-CA"), // YYYY-MM-DD format
  readingTime: 5,
  externalId: "",
  tileImage: "",
  inlineImages: [],
  bodyStart: "",
  bodyEnd: "",
  isDisabled: false,
  isFeatured: false,
  superFeature: false,
};

const articleCategories = [
  "Market News",
  "Investment Tips",
  "Property Spotlight",
  "Lifestyle",
  "Developer Insights",
  "Market Trends",
  "Dubai Regulations",
  "Featured Properties",
];

// Image compression options
const tileCompressionOptions = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 800,
  useWebWorker: true,
  initialQuality: 0.8,
};

const inlineCompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.8,
};

// FileInput Component
const FileInput = ({
  label,
  value,
  onChange,
  accept,
  multiple = false,
  maxFiles = 1,
  disabled = false,
  isCompressing = false,
}: {
  label: string;
  value?: string | string[];
  onChange: (value: string | string[] | null) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  isCompressing?: boolean;
}) => {
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const compressAndUpload = async (file: File): Promise<string> => {
    try {
      console.log(`Original image size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

      // Compress the image
      const options = label.includes("Tile Image") ? tileCompressionOptions : inlineCompressionOptions;
      const compressedFile = await imageCompression(file, options);
      console.log(`Compressed image size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

      toast({
        title: "Image Compressed",
        description: `File size reduced from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
      });

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const bucket = "article-images";
      const fileName = `${bucket}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, compressedFile, {
          contentType: compressedFile.type,
          upsert: false,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      console.log(`Uploaded image URL:`, publicUrl);

      toast({
        title: "Upload Successful",
        description: "Image uploaded successfully",
      });

      return publicUrl;
    } catch (error) {
      console.error("Failed to process image:", error);
      toast({
        title: "Upload Failed",
        description: `Failed to upload image: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const limitedFiles = fileArray.slice(0, maxFiles);

    if (multiple) {
      const urls: string[] = [];
      for (const file of limitedFiles) {
        try {
          const url = await compressAndUpload(file);
          urls.push(url);
        } catch (error) {
          console.error("Failed to upload file:", error);
        }
      }
      onChange(urls);
    } else {
      try {
        const url = await compressAndUpload(limitedFiles[0]);
        onChange(url);
      } catch (error) {
        console.error("Failed to upload file:", error);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled || isCompressing) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleClear = () => {
    onChange(null);
  };

  const currentValue = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        } ${disabled || isCompressing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && !isCompressing && document.getElementById(`file-input-${label}`)?.click()}
      >
        <input
          id={`file-input-${label}`}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          disabled={disabled || isCompressing}
        />
        <div className="flex flex-col items-center gap-2">
          {isCompressing ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Compressing and uploading...</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">
                Drag and drop or click to browse
              </p>
            </>
          )}
        </div>
      </div>
      {currentValue.length > 0 && (
        <div className="space-y-2">
          {currentValue.map((val, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate">
                  {val.split("/").pop() || "Uploaded image"}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={disabled || isCompressing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function ArticleEditPage() {
  const [match, params] = useRoute("/articles/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const isNewArticle = !match || params?.id === "new";
  const articleId = isNewArticle ? null : parseInt(params?.id || "");
  const [isCompressing, setIsCompressing] = useState({
    tileImage: false,
    inlineImages: false,
  });
  const [tileImagePreview, setTileImagePreview] = useState<string | null>(null);
  const [inlineImagesPreview, setInlineImagesPreview] = useState<string[]>([]);

  // Fetch article data if editing
  const { data: articleData, isLoading: isLoadingArticle } = useQuery({
    queryKey: ["/api/articles", articleId],
    queryFn: async () => {
      return apiRequest("GET", `/api/articles/${articleId}`);
    },
    enabled: !!articleId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof articleFormSchema>>({
    resolver: zodResolver(articleFormSchema),
    defaultValues,
  });

  // Populate form and preview when article data is loaded
  useEffect(() => {
    if (articleData && !isNewArticle) {
      const formData: ArticleFormValues = {
        title: articleData.title || "",
        slug: articleData.slug || "",
        author: articleData.author || "",
        category: articleData.category || "",
        excerpt: articleData.excerpt || "",
        datePublished: articleData.datePublished
          ? new Date(articleData.datePublished).toLocaleDateString("en-CA")
          : "",
        readingTime:
          typeof articleData.readingTime === "string"
            ? parseInt(articleData.readingTime) || 5
            : articleData.readingTime || 5,
        externalId: articleData.externalId || "",
        tileImage: articleData.tileImage || "",
        inlineImages: Array.isArray(articleData.inlineImages)
          ? articleData.inlineImages
          : articleData.inlineImages
          ? [articleData.inlineImages]
          : [],
        bodyStart: articleData.bodyStart || "",
        bodyEnd: articleData.bodyEnd || "",
        isDisabled: !!articleData.isDisabled,
        isFeatured: !!articleData.isFeatured,
        superFeature: !!articleData.superFeature,
      };
      console.log("Populating form with data:", formData);
      form.reset(formData);
      setTileImagePreview(articleData.tileImage || null);
      setInlineImagesPreview(
        Array.isArray(articleData.inlineImages)
          ? articleData.inlineImages
          : articleData.inlineImages
          ? [articleData.inlineImages]
          : []
      );
    }
  }, [articleData, form, isNewArticle]);

  // Generate slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  // Update slug when title changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "title" && value.title && isNewArticle) {
        const slug = generateSlug(value.title as string);
        form.setValue("slug", slug);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, isNewArticle]);

  // Handle file changes
  const handleTileImageChange = async (value: string | string[] | null) => {
    if (!value) {
      form.setValue("tileImage", "");
      setTileImagePreview(null);
      return;
    }
    setIsCompressing((prev) => ({ ...prev, tileImage: true }));
    const url = Array.isArray(value) ? value[0] : value;
    form.setValue("tileImage", url);
    setTileImagePreview(url);
    setIsCompressing((prev) => ({ ...prev, tileImage: false }));
  };

  const handleInlineImagesChange = async (value: string | string[] | null) => {
    if (!value) {
      form.setValue("inlineImages", []);
      setInlineImagesPreview([]);
      return;
    }
    setIsCompressing((prev) => ({ ...prev, inlineImages: true }));
    const urls = Array.isArray(value) ? value : [value];
    form.setValue("inlineImages", urls);
    setInlineImagesPreview(urls);
    setIsCompressing((prev) => ({ ...prev, inlineImages: false }));
  };

  // Handle image removal
  const handleRemoveTileImage = () => {
    form.setValue("tileImage", "");
    setTileImagePreview(null);
  };

  const handleRemoveInlineImage = (index: number) => {
    const updatedImages = form.getValues("inlineImages")?.filter((_, i) => i !== index) || [];
    const updatedPreviews = inlineImagesPreview.filter((_, i) => i !== index);
    form.setValue("inlineImages", updatedImages);
    setInlineImagesPreview(updatedPreviews);
  };

  // Save article mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ArticleFormValues) => {
      const cleanData = {
        ...data,
        tileImage: data.tileImage || "",
        inlineImages: data.inlineImages || [],
      };

      console.log("Submitting clean data:", cleanData);
      console.log("Tile Image URL:", cleanData.tileImage);
      console.log("Inline Images URLs:", cleanData.inlineImages);

      if (isNewArticle) {
        return apiRequest("POST", "/api/articles", cleanData);
      } else {
        return apiRequest("PUT", `/api/articles/${articleId}`, cleanData);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewArticle ? "Article created" : "Article updated",
        description: isNewArticle
          ? "The article has been successfully created."
          : "The article has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      navigate("/articles");
    },
    onError: (error) => {
      console.error("Failed to save article:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewArticle ? "create" : "update"} article: ${error.message || "Please try again"}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof articleFormSchema>) => {
    console.log("Form data before submission:", data);
    if (data.tileImage && data.tileImage.startsWith("data:")) {
      toast({
        title: "Error",
        description: "Please wait for tile image upload to complete",
        variant: "destructive",
      });
      return;
    }
    if (data.inlineImages?.some((url) => url.startsWith("data:"))) {
      toast({
        title: "Error",
        description: "Please wait for all inline images to upload",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(data as ArticleFormValues);
  };

  return (
    <DashLayout
      title={isNewArticle ? "Add New Article" : "Edit Article"}
      description={
        isNewArticle
          ? "Create a new blog article"
          : `Editing article: ${form.watch("title") || "Loading..."}`
      }
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate("/articles")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Articles
      </Button>

      {isLoadingArticle && !isNewArticle ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading article data...</span>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Article Information</CardTitle>
                <CardDescription>Enter the basic details for this article</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Article Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Palm Jebel Ali vs. Palm Jumeirah: A Battle for Supremacy"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL Slug</FormLabel>
                        <FormControl>
                          <Input placeholder="palm-jebel-ali-vs-palm-jumeirah" {...field} />
                        </FormControl>
                        <FormDescription>Used for the article URL (automatically generated)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="externalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>External ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Optional external reference ID"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="author"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Author</FormLabel>
                        <FormControl>
                          <Input placeholder="Karen Lamperti" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {articleCategories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="readingTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reading Time (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="5"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="datePublished"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Publication Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="excerpt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Excerpt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Short summary of the article..."
                          rows={3}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>A brief excerpt that will appear in article listings</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Article Content</CardTitle>
                <CardDescription>Enter the main content for this article</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="bodyStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body Start</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="First part of the article content..."
                          rows={10}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>The beginning of the article content (supports HTML)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bodyEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body End</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Second part of the article content..."
                          rows={10}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>The end of the article content (supports HTML)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Images</CardTitle>
                <CardDescription>Upload images for this article</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tileImagePreview && (
                  <div className="relative mb-4">
                    <img
                      src={tileImagePreview}
                      alt="Tile Image Preview"
                      className="w-full max-w-xs h-auto object-cover rounded-md border"
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 hover:opacity-100 transition-opacity"
                      onClick={handleRemoveTileImage}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="tileImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tile Image</FormLabel>
                      <FormControl>
                        <FileInput
                          label="Upload Tile Image"
                          value={field.value}
                          onChange={handleTileImageChange}
                          accept="image/*"
                          disabled={isCompressing.tileImage}
                          isCompressing={isCompressing.tileImage}
                        />
                      </FormControl>
                      <FormDescription>
                        The main thumbnail image for this article, compressed and uploaded to Supabase
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {inlineImagesPreview.length > 0 && (
                  <div className="mb-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {inlineImagesPreview.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Inline Image ${index + 1}`}
                            className="w-full h-32 object-cover rounded-md border"
                          />
                          <button
                            type="button"
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveInlineImage(index)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="inlineImages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inline Images</FormLabel>
                      <FormControl>
                        <FileInput
                          label="Upload Inline Images"
                          value={field.value}
                          onChange={handleInlineImagesChange}
                          accept="image/*"
                          multiple={true}
                          maxFiles={10}
                          disabled={isCompressing.inlineImages}
                          isCompressing={isCompressing.inlineImages}
                        />
                      </FormControl>
                      <FormDescription>
                        Images for article content, compressed and uploaded to Supabase (up to 10)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Publication Settings</CardTitle>
                <CardDescription>Control how this article appears on the website</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Featured Article</FormLabel>
                          <FormDescription>Highlight this article on the blog page</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="superFeature"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Super Feature</FormLabel>
                          <FormDescription>Display as a large featured article on the home page</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isDisabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Disable Article</FormLabel>
                          <FormDescription>Hide this article from the website</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/articles")}
                className="mr-2"
                disabled={Object.values(isCompressing).some((v) => v)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending || Object.values(isCompressing).some((v) => v)}
                className="flex items-center gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Article
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}