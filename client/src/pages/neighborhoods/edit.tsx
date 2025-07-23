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
import { NeighborhoodFormValues } from "@/types";
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
const neighborhoodFormSchema = z.object({
  urlSlug: z.string().min(3, "URL slug must be at least 3 characters"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  subtitle: z.string().optional(),
  region: z.string().optional(),
  bannerImage: z.string().optional(),
  description: z.string().optional(),
  locationAttributes: z.string().optional(),
  address: z.string().optional(),
  availableProperties: z.number().int().min(0).optional(),
  images: z.array(z.string()).optional(),
  neighbourImage: z.string().optional(),
  neighboursText: z.string().optional(),
  propertyOffers: z.string().optional(),
  subtitleBlurb: z.string().optional(),
  neighbourhoodDetails: z.string().optional(),
  neighbourhoodExpectation: z.string().optional(),
  brochure: z.string().optional(),
  showOnFooter: z.boolean().optional(),
});

const defaultValues: NeighborhoodFormValues = {
  urlSlug: "",
  title: "",
  subtitle: "",
  region: "Dubai",
  bannerImage: "",
  description: "",
  locationAttributes: "",
  address: "",
  availableProperties: undefined,
  images: [],
  neighbourImage: "",
  neighboursText: "",
  propertyOffers: "",
  subtitleBlurb: "",
  neighbourhoodDetails: "",
  neighbourhoodExpectation: "",
  brochure: "",
  showOnFooter: false,
};

// Image compression options
const bannerCompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.8,
};

const neighborCompressionOptions = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 800,
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
      // Determine bucket and compression
      const isImage = accept?.includes("image/*");
      const bucket = isImage ? "neighborhood-images" : "neighborhoods-brochure";
      let fileToUpload = file;

      if (isImage) {
        console.log(`Original image size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        const options = label.includes("Neighbor Image") ? neighborCompressionOptions : bannerCompressionOptions;
        fileToUpload = await imageCompression(file, options);
        console.log(`Compressed image size: ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);

        toast({
          title: "Image Compressed",
          description: `File size reduced from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`,
        });
      }

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${bucket}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, fileToUpload, {
          contentType: fileToUpload.type,
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
      console.log(`Uploaded file URL:`, publicUrl);

      toast({
        title: "Upload Successful",
        description: `${isImage ? "Image" : "File"} uploaded successfully`,
      });

      return publicUrl;
    } catch (error) {
      console.error("Failed to process file:", error);
      toast({
        title: "Upload Failed",
        description: `Failed to upload ${accept?.includes("image/*") ? "image" : "file"}: ${error instanceof Error ? error.message : "Unknown error"}`,
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
                  {val.split("/").pop() || "Uploaded file"}
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

export default function NeighborhoodEditPage() {
  const [match, params] = useRoute("/neighborhoods/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const isNewNeighborhood = !match || params?.id === "new";
  const neighborhoodId = isNewNeighborhood ? null : parseInt(params?.id || "");
  const [isCompressing, setIsCompressing] = useState({
    bannerImage: false,
    images: false,
    neighbourImage: false,
    brochure: false,
  });

  // Fetch neighborhood data if editing
  const { data: neighborhoodData, isLoading: isLoadingNeighborhood } = useQuery({
    queryKey: ["/api/neighborhoods", neighborhoodId],
    queryFn: async () => {
      return apiRequest("GET", `/api/neighborhoods/${neighborhoodId}`);
    },
    enabled: !!neighborhoodId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof neighborhoodFormSchema>>({
    resolver: zodResolver(neighborhoodFormSchema),
    defaultValues,
  });

  // Populate form when neighborhood data is loaded
  useEffect(() => {
    if (neighborhoodData && !isNewNeighborhood) {
      const formData: NeighborhoodFormValues = {
        urlSlug: neighborhoodData.urlSlug || "",
        title: neighborhoodData.title || "",
        subtitle: neighborhoodData.subtitle || "",
        region: neighborhoodData.region || "Dubai",
        bannerImage: neighborhoodData.bannerImage || "",
        description: neighborhoodData.description || "",
        locationAttributes: neighborhoodData.locationAttributes || "",
        address: neighborhoodData.address || "",
        availableProperties:
          typeof neighborhoodData.availableProperties === "string"
            ? parseInt(neighborhoodData.availableProperties) || undefined
            : neighborhoodData.availableProperties || undefined,
        images: Array.isArray(neighborhoodData.images)
          ? neighborhoodData.images
          : neighborhoodData.images
          ? [neighborhoodData.images]
          : [],
        neighbourImage: neighborhoodData.neighbourImage || "",
        neighboursText: neighborhoodData.neighboursText || "",
        propertyOffers: neighborhoodData.propertyOffers || "",
        subtitleBlurb: neighborhoodData.subtitleBlurb || "",
        neighbourhoodDetails: neighborhoodData.neighbourhoodDetails || "",
        neighbourhoodExpectation: neighborhoodData.neighbourhoodExpectation || "",
        brochure: neighborhoodData.brochure || "",
        showOnFooter: !!neighborhoodData.showOnFooter,
      };
      console.log("Populating form with data:", formData);
      form.reset(formData);
    }
  }, [neighborhoodData, form, isNewNeighborhood]);

  // Generate URL slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/-+/g, "_")
      .trim();
  };

  // Update URL slug when title changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "title" && value.title && isNewNeighborhood) {
        const slug = generateSlug(value.title as string);
        form.setValue("urlSlug", slug);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, isNewNeighborhood]);

  // Handle file changes with Supabase deletion
  const handleBannerImageChange = async (value: string | string[] | null) => {
    if (!value) {
      if (form.getValues("bannerImage")) {
        const fileName = form.getValues("bannerImage").split("/").pop();
        if (fileName) {
          await supabase.storage.from("neighborhood-images").remove([fileName]);
        }
      }
      form.setValue("bannerImage", "");
      return;
    }
    setIsCompressing((prev) => ({ ...prev, bannerImage: true }));
    const url = Array.isArray(value) ? value[0] : value;
    form.setValue("bannerImage", url);
    setIsCompressing((prev) => ({ ...prev, bannerImage: false }));
  };

  const handleImagesChange = async (value: string | string[] | null) => {
    if (!value) {
      if (form.getValues("images")?.length) {
        const fileNames = form.getValues("images")!.map((url) => url.split("/").pop()).filter(Boolean);
        if (fileNames.length) {
          await supabase.storage.from("neighborhood-images").remove(fileNames as string[]);
        }
      }
      form.setValue("images", []);
      return;
    }
    setIsCompressing((prev) => ({ ...prev, images: true }));
    const urls = Array.isArray(value) ? value : [value];
    form.setValue("images", urls);
    setIsCompressing((prev) => ({ ...prev, images: false }));
  };

  const handleNeighbourImageChange = async (value: string | string[] | null) => {
    if (!value) {
      if (form.getValues("neighbourImage")) {
        const fileName = form.getValues("neighbourImage").split("/").pop();
        if (fileName) {
          await supabase.storage.from("neighborhood-images").remove([fileName]);
        }
      }
      form.setValue("neighbourImage", "");
      return;
    }
    setIsCompressing((prev) => ({ ...prev, neighbourImage: true }));
    const url = Array.isArray(value) ? value[0] : value;
    form.setValue("neighbourImage", url);
    setIsCompressing((prev) => ({ ...prev, neighbourImage: false }));
  };

  const handleBrochureChange = async (value: string | string[] | null) => {
    if (!value) {
      if (form.getValues("brochure")) {
        const fileName = form.getValues("brochure").split("/").pop();
        if (fileName) {
          await supabase.storage.from("neighborhoods-brochure").remove([fileName]);
        }
      }
      form.setValue("brochure", "");
      return;
    }
    setIsCompressing((prev) => ({ ...prev, brochure: true }));
    const url = Array.isArray(value) ? value[0] : value;
    form.setValue("brochure", url);
    setIsCompressing((prev) => ({ ...prev, brochure: false }));
  };

  // Handler for removing individual images
  const handleRemoveImage = async (index: number) => {
    const currentImages = form.getValues("images") || [];
    const fileName = currentImages[index]?.split("/").pop();
    if (fileName) {
      await supabase.storage.from("neighborhood-images").remove([fileName]);
    }
    const updatedImages = currentImages.filter((_, i) => i !== index);
    form.setValue("images", updatedImages);
  };

  // Save neighborhood mutation
  const saveMutation = useMutation({
    mutationFn: async (data: NeighborhoodFormValues) => {
      const cleanData = {
        ...data,
        bannerImage: data.bannerImage || "",
        images: data.images || [],
        neighbourImage: data.neighbourImage || "",
        brochure: data.brochure || "",
      };

      console.log("Submitting clean data:", cleanData);
      console.log("Banner Image URL:", cleanData.bannerImage);
      console.log("Images URLs:", cleanData.images);
      console.log("Neighbour Image URL:", cleanData.neighbourImage);
      console.log("Brochure URL:", cleanData.brochure);

      if (isNewNeighborhood) {
        return apiRequest("POST", "/api/neighborhoods", cleanData);
      } else {
        return apiRequest("PUT", `/api/neighborhoods/${neighborhoodId}`, cleanData);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewNeighborhood ? "Neighborhood created" : "Neighborhood updated",
        description: isNewNeighborhood
          ? "The neighborhood has been successfully created."
          : "The neighborhood has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/neighborhoods"] });
      navigate("/neighborhoods");
    },
    onError: (error) => {
      console.error("Failed to save neighborhood:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewNeighborhood ? "create" : "update"} neighborhood: ${error.message || "Please try again"}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof neighborhoodFormSchema>) => {
    console.log("Form data before submission:", data);
    if (data.bannerImage && data.bannerImage.startsWith("data:")) {
      toast({
        title: "Error",
        description: "Please wait for banner image upload to complete",
        variant: "destructive",
      });
      return;
    }
    if (data.images?.some((url) => url.startsWith("data:"))) {
      toast({
        title: "Error",
        description: "Please wait for all neighborhood images to upload",
        variant: "destructive",
      });
      return;
    }
    if (data.neighbourImage && data.neighbourImage.startsWith("data:")) {
      toast({
        title: "Error",
        description: "Please wait for neighbor image upload to complete",
        variant: "destructive",
      });
      return;
    }
    if (data.brochure && data.brochure.startsWith("data:")) {
      toast({
        title: "Error",
        description: "Please wait for brochure upload to complete",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(data as NeighborhoodFormValues);
  };

  const bannerImageValue = form.watch("bannerImage");
  const imagesValue = form.watch("images") || [];
  const neighbourImageValue = form.watch("neighbourImage");
  const brochureValue = form.watch("brochure");

  return (
    <DashLayout
      title={isNewNeighborhood ? "Add New Neighborhood" : "Edit Neighborhood"}
      description={
        isNewNeighborhood
          ? "Create a new neighborhood location"
          : `Editing neighborhood: ${form.watch("title") || "Loading..."}`
      }
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate("/neighborhoods")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Neighborhoods
      </Button>

      {isLoadingNeighborhood && !isNewNeighborhood ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading neighborhood data...</span>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Enter the basic details for this neighborhood</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Neighborhood Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Palm Jumeirah" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subtitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtitle</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="A Majestic Man-Made Island in the Arabian Gulf"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>A brief tagline or subtitle for the neighborhood</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="urlSlug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL Slug</FormLabel>
                        <FormControl>
                          <Input placeholder="palm_jumeirah" {...field} />
                        </FormControl>
                        <FormDescription>Used for the website URL (automatically generated)</FormDescription>
                        <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input placeholder="Dubai" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter neighborhood description..."
                        rows={6}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subtitleBlurb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtitle Blurb</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Short description to appear under the subtitle..."
                        rows={3}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location Details</CardTitle>
              <CardDescription>Enter detailed information about this neighborhood location</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Palm Jumeirah, Dubai, UAE" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationAttributes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location Attributes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Schools, Beaches, Shopping Centers, etc."
                        rows={3}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>Key amenities and attractions in this neighborhood</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="availableProperties"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Properties</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="100"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>Number of properties available in this neighborhood</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Neighborhood Details</CardTitle>
              <CardDescription>Additional information about this neighborhood</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="neighbourhoodDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neighborhood Details</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed information about the neighborhood..."
                        rows={6}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="neighbourhoodExpectation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neighborhood Expectations</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What residents can expect living here..."
                        rows={4}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="neighboursText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neighbors Text</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Information about neighboring areas..."
                        rows={4}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="propertyOffers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Offers</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Special property offers in this neighborhood..."
                        rows={4}
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
              <CardDescription>Upload images and documents for this neighborhood</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {bannerImageValue && (
                <div className="relative group mb-4">
                  <img
                    src={bannerImageValue}
                    alt="Banner Preview"
                    className="w-full max-w-md h-auto object-cover rounded-md border"
                  />
                  {!isCompressing.bannerImage && (
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => form.setValue("bannerImage", "")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              <FormField
                control={form.control}
                name="bannerImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banner Image</FormLabel>
                    <FormControl>
                      <FileInput
                        label="Upload Banner Image"
                        value={field.value}
                        onChange={handleBannerImageChange}
                        accept="image/*"
                        disabled={isCompressing.bannerImage}
                        isCompressing={isCompressing.bannerImage}
                      />
                    </FormControl>
                    <FormDescription>
                      Images will be compressed and uploaded to Supabase storage
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {imagesValue.length > 0 && (
                <div className="mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {imagesValue.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Neighborhood Image ${index + 1}`}
                          className="w-full h-32 object-cover rounded-md border"
                        />
                        {!isCompressing.images && (
                          <button
                            type="button"
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveImage(index)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neighborhood Images</FormLabel>
                    <FormControl>
                      <FileInput
                        label="Upload Images"
                        value={field.value}
                        onChange={handleImagesChange}
                        accept="image/*"
                        multiple={true}
                        maxFiles={10}
                        disabled={isCompressing.images}
                        isCompressing={isCompressing.images}
                      />
                    </FormControl>
                    <FormDescription>
                      Upload up to 10 images of the neighborhood, compressed and stored in Supabase
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {neighbourImageValue && (
                <div className="relative group mb-4">
                  <img
                    src={neighbourImageValue}
                    alt="Neighbor Image Preview"
                    className="w-full max-w-xs h-auto object-cover rounded-md border"
                  />
                  {!isCompressing.neighbourImage && (
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => form.setValue("neighbourImage", "")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              <FormField
                control={form.control}
                name="neighbourImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Neighbor Image</FormLabel>
                    <FormControl>
                      <FileInput
                        label="Upload Neighbor Image"
                        value={field.value}
                        onChange={handleNeighbourImageChange}
                        accept="image/*"
                        disabled={isCompressing.neighbourImage}
                        isCompressing={isCompressing.neighbourImage}
                      />
                    </FormControl>
                    <FormDescription>
                      Image for the neighboring areas, compressed and stored in Supabase
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {brochureValue && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate">
                      {brochureValue.split("/").pop() || "Uploaded brochure"}
                    </span>
                  </div>
                </div>
              )}
              <FormField
                control={form.control}
                name="brochure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brochure</FormLabel>
                    <FormControl>
                      <FileInput
                        label="Upload Brochure"
                        value={field.value}
                        onChange={handleBrochureChange}
                        accept="application/pdf"
                        disabled={isCompressing.brochure}
                        isCompressing={isCompressing.brochure}
                      />
                    </FormControl>
                    <FormDescription>PDF brochure uploaded to Supabase storage</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visibility</CardTitle>
              <CardDescription>Control the visibility of this neighborhood</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="showOnFooter"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Show on Footer</FormLabel>
                      <FormDescription>Display this neighborhood in the website footer</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/neighborhoods")}
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
              Save Neighborhood
            </Button>
          </div>
        </form>
      </Form>
    )}
  </DashLayout>
);
}