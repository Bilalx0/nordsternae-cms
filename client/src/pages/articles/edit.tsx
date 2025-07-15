import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FileInput } from "@/components/ui/file-input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
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

export default function ArticleEditPage() {
  const [match, params] = useRoute("/articles/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const isNewArticle = !match || params?.id === "new";
  const articleId = isNewArticle ? null : parseInt(params?.id || "");

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

  // Populate form when article data is loaded
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

      form.reset(formData);
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

  // Save article mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ArticleFormValues) => {
      if (isNewArticle) {
        return apiRequest("POST", "/api/articles", data);
      } else {
        return apiRequest("PUT", `/api/articles/${articleId}`, data);
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
        description: `Failed to ${isNewArticle ? "create" : "update"} article. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof articleFormSchema>) => {
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
                <FormField
                  control={form.control}
                  name="tileImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tile Image URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/image.jpg"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>The main thumbnail image for this article</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inlineImages"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inline Images</FormLabel>
                      <FormControl>
                        <FileInput
                          label="Upload Images"
                          value={field.value}
                          onChange={field.onChange}
                          accept="image/*"
                          multiple={true}
                          maxFiles={10}
                        />
                      </FormControl>
                      <FormDescription>Images that will be used within the article content</FormDescription>
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
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
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