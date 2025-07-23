import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Loader2, Upload, X, Image as ImageIcon } from "lucide-react"; // Import ImageIcon
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

// Re-designed FileInput Component for consistency with agent's page
const FileInput = ({
  label,
  value,
  onChange,
  accept,
  disabled = false,
  isCompressing = false,
}: {
  label: string;
  value?: string;
  onChange: (value: string | null) => void;
  accept?: string;
  disabled?: boolean;
  isCompressing?: boolean;
}) => {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    // Create a temporary Blob URL for immediate preview
    const tempUrl = URL.createObjectURL(file);
    onChange(tempUrl); // Pass the temp URL to the form field for immediate display

    // Now, call the actual upload function
    // The parent component will handle the compression and real URL update
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

  const currentValue = value; // Single value for banner image

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

      {currentValue && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            {/* Display filename, or 'Uploaded image' if it's a blob URL */}
            <span className="text-sm truncate">
              {currentValue.startsWith("blob:") ? "New Image" : (currentValue.split("/").pop() || "Uploaded image")}
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
      )}
    </div>
  );
};

export default function BannerHighlightEditPage() {
  const [match, params] = useRoute("/banner-highlights/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
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

  // Populate form and set preview when banner data is loaded
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
    }
  }, [bannerData, form, isNewBanner]);

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
  const handleImageChange = async (value: string | null) => {
    if (!value) {
      // User cleared the image
      form.setValue("image", "");
      return;
    }

    // If it's a blob URL (temporary preview from FileInput)
    if (value.startsWith("blob:")) {
      // Revoke the old blob URL if it exists
      const currentImageValue = form.getValues("image");
      if (currentImageValue && currentImageValue.startsWith("blob:")) {
        URL.revokeObjectURL(currentImageValue);
      }
      
      form.setValue("image", value); // Set the temporary URL for immediate preview
      
      // Convert blob URL back to File object to upload
      try {
        const response = await fetch(value);
        const blob = await response.blob();
        // You might need to infer the file name/type if not available in blob directly
        const fileName = `temp-upload-${Date.now()}.jpeg`; // Or extract from response headers if possible
        const fileType = blob.type || 'image/jpeg';
        const file = new File([blob], fileName, { type: fileType });
        
        const uploadedUrl = await compressAndUploadToStorage(file);
        form.setValue("image", uploadedUrl); // Update with the actual Supabase URL
        URL.revokeObjectURL(value); // Revoke the temporary URL
      } catch (error) {
        console.error("Error converting blob to file or uploading:", error);
        form.setValue("image", ""); // Clear on error
      }
    } else {
      // It's a direct URL (from existing data or a re-set)
      form.setValue("image", value);
    }
  };

  const onSubmit = (data: z.infer<typeof bannerFormSchema>) => {
    console.log("Form data before submission:", data);
    if (isCompressing) {
      toast({
        title: "Error",
        description: "Please wait for image upload to complete before saving.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(data as BannerHighlightFormValues);
  };

  const imageValue = form.watch("image");

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
                            <FileInput
                              label="Upload Banner Image"
                              value={field.value}
                              onChange={(url) => {
                                // If a file was selected, `handleImageChange` will handle the upload.
                                // If the value is null (cleared), `handleImageChange` will also handle it.
                                // If it's a URL (from initial load), no action needed here.
                                if (url === null || url.startsWith("blob:")) {
                                  handleImageChange(url);
                                } else {
                                  field.onChange(url); // Set the URL directly if it's not a new file
                                }
                              }}
                              accept="image/*"
                              disabled={isCompressing}
                              isCompressing={isCompressing}
                            />
                          </FormControl>
                          <FormDescription>
                            Images will be compressed and uploaded to Supabase storage. For best results, use high-resolution images.
                          </FormDescription>
                          <FormMessage />
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
                    <div className="rounded-md overflow-hidden bg-gray-100 mb-4 aspect-[16/9] border">
                      {imageValue ? ( // Use imageValue from form.watch
                        <img
                          src={imageValue}
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