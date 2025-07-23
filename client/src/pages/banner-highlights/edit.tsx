import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Loader2, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BannerHighlightFormValues } from "@/types";
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
import { supabase } from "@/lib/supabase";
import imageCompression from "browser-image-compression";

// Zod schema for form validation
const bannerFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  headline: z.string().min(3, "Headline must be at least 3 characters"),
  subheading: z.string().optional(),
  cta: z.string().optional(),
  ctaLink: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  image: z.string().optional(),
  isActive: z.boolean().optional(),
});

const defaultValues: BannerHighlightFormValues = {
  title: "",
  headline: "",
  subheading: "",
  cta: "Read More",
  ctaLink: "",
  image: "",
  isActive: true,
};

// Image compression options
const compressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.8,
};

// Custom File Input Component
const CustomFileInput = ({
  label,
  value,
  onChange,
  accept,
  disabled,
  isCompressing,
}: {
  label: string;
  value?: string;
  onChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  isCompressing?: boolean;
}) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onChange(file);
  };

  const handleClear = () => {
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 px-4 py-2 border border-input rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">
          <input
            type="file"
            className="hidden"
            accept={accept}
            onChange={handleFileChange}
            disabled={disabled || isCompressing}
          />
          {isCompressing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {label}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {label}
            </>
          )}
        </label>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={disabled || isCompressing}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {value && (
        <div className="text-sm text-muted-foreground">
          Current: {value.split("/").pop()}
        </div>
      )}
    </div>
  );
};

export default function BannerHighlightEditPage() {
  const [match, params] = useRoute("/banner-highlights/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const isNewBanner = !match || params?.id === "new";
  const bannerId = isNewBanner ? null : parseInt(params?.id || "");

  // Fetch banner data if editing
  const { data: bannerData, isLoading: isLoadingBanner } = useQuery({
    queryKey: ["/api/banner-highlights", bannerId],
    queryFn: async () => {
      return apiRequest("GET", `/api/banner-highlights/${bannerId}`);
    },
    enabled: !!bannerId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof bannerFormSchema>>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues,
  });

  // Populate form and preview when banner data is loaded
  useEffect(() => {
    if (bannerData && !isNewBanner) {
      const formData: BannerHighlightFormValues = {
        title: bannerData.title || "",
        headline: bannerData.headline || "",
        subheading: bannerData.subheading || "",
        cta: bannerData.cta || "Read More",
        ctaLink: bannerData.ctaLink || "",
        image: bannerData.image || "",
        isActive: !!bannerData.isActive,
      };
      console.log("Populating form with data:", formData);
      form.reset(formData);
      setPreviewImage(formData.image || null);
    }
  }, [bannerData, form, isNewBanner]);

  // Update preview when image field changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "image") {
        console.log("Image field changed, updating preview:", value.image);
        setPreviewImage(value.image || null);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Compress and upload to Supabase Storage
  const compressAndUploadToStorage = async (file: File): Promise<string> => {
    try {
      setIsCompressing(true);
      console.log(`Original image size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

      // Compress the image
      const compressedFile = await imageCompression(file, compressionOptions);
      console.log(`Compressed image size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

      toast({
        title: "Image Compressed",
        description: `File size reduced from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
      });

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `banner-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("banner-images")
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
        .from("banner-images")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      console.log(`Uploaded image URL:`, publicUrl);

      toast({
        title: "Upload Successful",
        description: "Banner image uploaded successfully",
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
    } finally {
      setIsCompressing(false);
    }
  };

  // Handle image file selection
  const handleImageChange = async (file: File | null) => {
    if (!file) {
      form.setValue("image", "");
      setPreviewImage(null);
      console.log("Image cleared, preview reset");
      return;
    }

    try {
      const url = await compressAndUploadToStorage(file);
      form.setValue("image", url);
      setPreviewImage(url);
      console.log(`Image URL set and preview updated: ${url}`);
    } catch (error) {
      console.error("Image upload error:", error);
    }
  };

  // Save banner mutation
  const saveMutation = useMutation({
    mutationFn: async (data: BannerHighlightFormValues) => {
      const cleanData = {
        ...data,
        image: data.image || "",
      };

      console.log("Submitting clean data:", cleanData);
      console.log("Image URL:", cleanData.image);

      if (isNewBanner) {
        return apiRequest("POST", "/api/banner-highlights", cleanData);
      } else {
        return apiRequest("PUT", `/api/banner-highlights/${bannerId}`, cleanData);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewBanner ? "Banner created" : "Banner updated",
        description: isNewBanner
          ? "The banner highlight has been successfully created."
          : "The banner highlight has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/banner-highlights"] });
      navigate("/banner-highlights");
    },
    onError: (error) => {
      console.error("Failed to save banner:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewBanner ? "create" : "update"} banner: ${error.message || "Please try again"}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof bannerFormSchema>) => {
    console.log("Form data before submission:", data);
    if (data.image && data.image.startsWith("data:")) {
      toast({
        title: "Error",
        description: "Please wait for image upload to complete",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(data as BannerHighlightFormValues);
  };

  return (
    <DashLayout
      title={isNewBanner ? "Add New Banner Highlight" : "Edit Banner Highlight"}
      description={
        isNewBanner
          ? "Create a new promotional banner"
          : `Editing banner: ${form.watch("title") || "Loading..."}`
      }
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate("/banner-highlights")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Banner Highlights
      </Button>

      {isLoadingBanner && !isNewBanner ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading banner data...</span>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Banner Information</CardTitle>
                    <CardDescription>Enter the details for this banner highlight</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Discover World's First" {...field} />
                          </FormControl>
                          <FormDescription>Internal reference title for this banner</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="headline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Headline</FormLabel>
                          <FormControl>
                            <Input placeholder="Chedi Private Residences" {...field} />
                          </FormControl>
                          <FormDescription>The main headline displayed on the banner</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subheading"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subheading</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="A Remarkable Collection Of Branded Residences"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>Secondary text displayed under the headline</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="cta"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CTA Button Text</FormLabel>
                            <FormControl>
                              <Input placeholder="Read More" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="ctaLink"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CTA Button Link</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="https://nordstern.ae/article/..."
                                {...field}
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
                      name="image"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banner Image</FormLabel>
                          <FormControl>
                            <CustomFileInput
                              label={isCompressing ? "Compressing..." : "Upload Banner Image"}
                              value={field.value}
                              onChange={handleImageChange}
                              accept="image/*"
                              disabled={isCompressing}
                              isCompressing={isCompressing}
                            />
                          </FormControl>
                          <FormDescription>
                            Images will be compressed and uploaded to Supabase storage
                          </FormDescription>
                          <FormMessage />
                          {isCompressing && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Compressing and uploading image...
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Visibility Settings</CardTitle>
                    <CardDescription>Control when and how this banner appears</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active</FormLabel>
                            <FormDescription>Display this banner on the website</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="md:col-span-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Banner Preview</CardTitle>
                    <CardDescription>How the banner will look on the website</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md overflow-hidden bg-gray-100 mb-4 aspect-[16/9]">
                      {previewImage ? (
                        <img
                          src={previewImage}
                          alt="Banner Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          No image preview available
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 p-4 border rounded-md bg-white">
                      <h3 className="text-lg font-bold">
                        {form.watch("headline") || "Headline"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {form.watch("subheading") || "Subheading text will appear here"}
                      </p>
                      <div className="mt-4">
                        <span className="inline-block px-4 py-2 bg-primary text-white text-sm font-medium rounded">
                          {form.watch("cta") || "Read More"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/banner-highlights")}
                className="mr-2"
                disabled={isCompressing}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending || isCompressing}
                className="flex items-center gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Banner
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}