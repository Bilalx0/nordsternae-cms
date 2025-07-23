import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DeveloperFormValues } from "@/types";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import imageCompression from "browser-image-compression";
import { supabase } from "@/lib/supabase";

// Zod schema for form validation
const developerFormSchema = z.object({
  title: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().optional(),
  urlSlug: z.string().min(3, "URL slug must be at least 3 characters"),
  country: z.string().optional(),
  establishedSince: z.string().optional(),
  logo: z.string().optional(),
});

const defaultValues: DeveloperFormValues = {
  title: "",
  description: "",
  urlSlug: "",
  country: "United Arab Emirates",
  establishedSince: "",
  logo: "",
};

// Image compression options for logo
const logoCompressionOptions = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 800,
  useWebWorker: true,
  initialQuality: 0.8,
};

// FileInput Component (same as AgentEditPage and BannerHighlightEditPage)
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
      const compressedFile = await imageCompression(file, logoCompressionOptions);
      console.log(`Compressed image size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

      toast({
        title: "Image Compressed",
        description: `File size reduced from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
      });

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const bucket = "developer-images";
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

  const currentValue = Array.isArray(value) ? value[0] : value;

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
      {currentValue && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm truncate">
              {currentValue.split("/").pop() || "Uploaded image"}
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

export default function DeveloperEditPage() {
  const [match, params] = useRoute("/developers/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isCompressing, setIsCompressing] = useState(false);
  const isNewDeveloper = !match || params?.id === "new";
  const developerId = isNewDeveloper ? null : parseInt(params?.id || "");

  // Fetch developer data if editing
  const { data: developerData, isLoading: isLoadingDeveloper } = useQuery({
    queryKey: ["/api/developers", developerId],
    queryFn: async () => {
      return apiRequest("GET", `/api/developers/${developerId}`);
    },
    enabled: !!developerId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof developerFormSchema>>({
    resolver: zodResolver(developerFormSchema),
    defaultValues,
  });

  // Populate form when developer data is loaded
  useEffect(() => {
    if (developerData && !isNewDeveloper) {
      const formData: DeveloperFormValues = {
        title: developerData.title || "",
        description: developerData.description || "",
        urlSlug: developerData.urlSlug || "",
        country: developerData.country || "United Arab Emirates",
        establishedSince: developerData.establishedSince || "",
        logo: developerData.logo || "",
      };
      console.log("Populating form with data:", formData);
      form.reset(formData);
    }
  }, [developerData, form, isNewDeveloper]);

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
      if (name === "title" && value.title && isNewDeveloper) {
        const slug = generateSlug(value.title as string);
        form.setValue("urlSlug", slug);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, isNewDeveloper]);

  // Handle logo file selection with compression and upload
  const handleLogoChange = async (value: string | string[] | null) => {
    if (!value) {
      form.setValue("logo", "");
      return;
    }
    setIsCompressing(true);
    const url = Array.isArray(value) ? value[0] : value;
    form.setValue("logo", url);
    setIsCompressing(false);
  };

  // Save developer mutation
  const saveMutation = useMutation({
    mutationFn: async (data: DeveloperFormValues) => {
      const cleanData = {
        ...data,
        logo: data.logo || "",
      };

      console.log("Submitting clean data:", cleanData);
      console.log("Logo URL:", cleanData.logo);

      if (isNewDeveloper) {
        return apiRequest("POST", "/api/developers", cleanData);
      } else {
        return apiRequest("PUT", `/api/developers/${developerId}`, cleanData);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewDeveloper ? "Developer created" : "Developer updated",
        description: isNewDeveloper
          ? "The developer has been successfully created."
          : "The developer has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/developers"] });
      navigate("/developers");
    },
    onError: (error) => {
      console.error("Failed to save developer:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewDeveloper ? "create" : "update"} developer: ${error.message || "Please try again"}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof developerFormSchema>) => {
    console.log("Form data before submission:", data);
    if (data.logo && data.logo.startsWith("data:")) {
      toast({
        title: "Error",
        description: "Please wait for logo upload to complete",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(data as DeveloperFormValues);
  };

  const logoValue = form.watch("logo");

  return (
    <DashLayout
      title={isNewDeveloper ? "Add New Developer" : "Edit Developer"}
      description={
        isNewDeveloper
          ? "Create a new real estate developer"
          : `Editing developer: ${form.watch("title") || "Loading..."}`
      }
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate("/developers")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Developers
      </Button>

      {isLoadingDeveloper && !isNewDeveloper ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading developer data...</span>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Developer Information</CardTitle>
                <CardDescription>Enter the details for this developer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-8 items-start">
                  <div className="w-full max-w-xs flex flex-col items-center space-y-4">
                    <div className="relative">
                      <Avatar className="h-32 w-32">
                        <AvatarImage src={logoValue || ""} alt={form.watch("title")} />
                        <AvatarFallback className="text-2xl">
                          {form.watch("title")?.charAt(0) || "D"}
                        </AvatarFallback>
                      </Avatar>
                      {isCompressing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="logo"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel>Logo</FormLabel>
                          <FormControl>
                            <FileInput
                              label="Upload Logo"
                              value={field.value}
                              onChange={handleLogoChange}
                              accept="image/*"
                              disabled={isCompressing}
                              isCompressing={isCompressing}
                            />
                          </FormControl>
                          <FormDescription>
                            Images will be compressed and uploaded to Supabase storage
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex-1 space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Developer Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Samana Developers" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="United Arab Emirates"
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
                        name="establishedSince"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Established Since</FormLabel>
                            <FormControl>
                              <Input placeholder="2014" {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="urlSlug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL Slug</FormLabel>
                          <FormControl>
                            <Input placeholder="samana_developers" {...field} />
                          </FormControl>
                          <FormDescription>Used for the website URL (automatically generated)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter information about the developer..."
                          rows={6}
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

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/developers")}
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
                Save Developer
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}