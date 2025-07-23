import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Loader2, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AgentFormValues } from "@/types";
import imageCompression from "browser-image-compression";
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
import { supabase } from "@/lib/supabase";

// Zod schema for form validation
const agentFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  licenseNumber: z.string().optional(),
  location: z.string().optional(),
  languages: z.string().optional(),
  experience: z.number().int().min(0).optional(),
  introduction: z.string().optional(),
  linkedin: z.string().url("Invalid LinkedIn URL").optional().or(z.literal("")),
  headShot: z.string().optional(),
  photo: z.string().optional(),
});

const defaultValues: AgentFormValues = {
  name: "",
  email: "",
  phone: "",
  jobTitle: "Property Advisor",
  licenseNumber: "",
  location: "Head Office",
  languages: "English",
  experience: 0,
  introduction: "",
  linkedin: "",
  headShot: "",
  photo: "",
};

// Image compression options
const compressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.8,
};

const headshotCompressionOptions = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 800,
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

export default function AgentEditPage() {
  const [match, params] = useRoute("/agents/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isCompressing, setIsCompressing] = useState<{ headShot: boolean; photo: boolean }>({
    headShot: false,
    photo: false,
  });
  const [headShotPreview, setHeadShotPreview] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const isNewAgent = !match || params?.id === "new";
  const agentId = isNewAgent ? null : parseInt(params?.id || "");

  // Fetch agent data if editing
  const { data: agentData, isLoading: isLoadingAgent } = useQuery({
    queryKey: ["/api/agents", agentId],
    queryFn: async () => {
      return apiRequest("GET", `/api/agents/${agentId}`);
    },
    enabled: !!agentId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof agentFormSchema>>({
    resolver: zodResolver(agentFormSchema),
    defaultValues,
  });

  // Populate form and previews when agent data is loaded
  useEffect(() => {
    if (agentData && !isNewAgent) {
      const formData: AgentFormValues = {
        name: agentData.name || "",
        email: agentData.email || "",
        phone: agentData.phone || "",
        jobTitle: agentData.jobTitle || "Property Advisor",
        licenseNumber: agentData.licenseNumber || "",
        location: agentData.location || "Head Office",
        languages: agentData.languages || "English",
        experience:
          typeof agentData.experience === "string"
            ? parseInt(agentData.experience) || 0
            : agentData.experience || 0,
        introduction: agentData.introduction || "",
        linkedin: agentData.linkedin || "",
        headShot: agentData.headShot || "",
        photo: agentData.photo || "",
      };
      console.log("Populating form with data:", formData);
      form.reset(formData);
      setHeadShotPreview(formData.headShot || null);
      setPhotoPreview(formData.photo || null);
    }
  }, [agentData, form, isNewAgent]);

  // Update previews when form image fields change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "headShot") {
        setHeadShotPreview(value.headShot || null);
      }
      if (name === "photo") {
        setPhotoPreview(value.photo || null);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Compress and upload to Supabase Storage
  const compressAndUploadToStorage = async (
    file: File,
    options: typeof compressionOptions,
    fieldType: "headShot" | "photo"
  ): Promise<string> => {
    try {
      setIsCompressing((prev) => ({ ...prev, [fieldType]: true }));
      console.log(`Original ${fieldType} size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

      // Compress the image
      const compressedFile = await imageCompression(file, options);
      console.log(`Compressed ${fieldType} size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);

      toast({
        title: "Image Compressed",
        description: `File size reduced from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`,
      });

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${fieldType}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("agents-image")
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
        .from("agents-image")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      console.log(`Uploaded ${fieldType} URL:`, publicUrl);

      toast({
        title: "Upload Successful",
        description: `${fieldType} uploaded successfully`,
      });

      return publicUrl;
    } catch (error) {
      console.error(`Failed to process ${fieldType}:`, error);
      toast({
        title: "Upload Failed",
        description: `Failed to upload ${fieldType}: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsCompressing((prev) => ({ ...prev, [fieldType]: false }));
    }
  };

  // Handle headshot file selection
  const handleHeadshotChange = async (file: File | null) => {
    if (!file) {
      form.setValue("headShot", "");
      setHeadShotPreview(null);
      return;
    }

    try {
      const url = await compressAndUploadToStorage(file, headshotCompressionOptions, "headShot");
      form.setValue("headShot", url);
      setHeadShotPreview(url);
      console.log(`Headshot URL set and preview updated: ${url}`);
    } catch (error) {
      console.error("Headshot upload error:", error);
    }
  };

  // Handle photo file selection
  const handlePhotoChange = async (file: File | null) => {
    if (!file) {
      form.setValue("photo", "");
      setPhotoPreview(null);
      return;
    }

    try {
      const url = await compressAndUploadToStorage(file, compressionOptions, "photo");
      form.setValue("photo", url);
      setPhotoPreview(url);
      console.log(`Photo URL set and preview updated: ${url}`);
    } catch (error) {
      console.error("Photo upload error:", error);
    }
  };

  // Save agent mutation
  const saveMutation = useMutation({
    mutationFn: async (data: AgentFormValues) => {
      const cleanData = {
        ...data,
        headShot: data.headShot || "",
        photo: data.photo || "",
      };

      console.log("Submitting clean data:", cleanData);
      console.log("HeadShot URL:", cleanData.headShot);
      console.log("Photo URL:", cleanData.photo);

      if (isNewAgent) {
        return apiRequest("POST", "/api/agents", cleanData);
      } else {
        return apiRequest("PUT", `/api/agents/${agentId}`, cleanData);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewAgent ? "Agent created" : "Agent updated",
        description: isNewAgent
          ? "The agent has been successfully created."
          : "The agent has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      navigate("/agents");
    },
    onError: (error) => {
      console.error("Failed to save agent:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewAgent ? "create" : "update"} agent: ${error.message || "Please try again"}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof agentFormSchema>) => {
    console.log("Form data before submission:", data);
    if (data.headShot && data.headShot.startsWith("data:")) {
      toast({
        title: "Error",
        description: "Please wait for headshot upload to complete",
        variant: "destructive",
      });
      return;
    }
    if (data.photo && data.photo.startsWith("data:")) {
      toast({
        title: "Error",
        description: "Please wait for photo upload to complete",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(data as AgentFormValues);
  };

  return (
    <DashLayout
      title={isNewAgent ? "Add New Agent" : "Edit Agent"}
      description={
        isNewAgent ? "Create a new agent profile" : `Editing agent: ${form.watch("name") || "Loading..."}`
      }
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate("/agents")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Agents
      </Button>

      {isLoadingAgent && !isNewAgent ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading agent data...</span>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Enter the agent's basic information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-8 items-start">
                  <div className="w-full max-w-xs flex flex-col items-center space-y-4">
                    <div className="relative">
                      <Avatar className="h-32 w-32">
                        <AvatarImage src={headShotPreview || ""} alt={form.watch("name")} />
                        <AvatarFallback className="text-2xl">
                          {form.watch("name")?.charAt(0) || "A"}
                        </AvatarFallback>
                      </Avatar>
                      {isCompressing.headShot && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </div>
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="headShot"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel>Profile Picture</FormLabel>
                          <FormControl>
                            <CustomFileInput
                              label={isCompressing.headShot ? "Compressing..." : "Upload Picture"}
                              value={field.value}
                              onChange={handleHeadshotChange}
                              accept="image/*"
                              disabled={isCompressing.headShot}
                              isCompressing={isCompressing.headShot}
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
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@nordstern.ae" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="+971 50 123 4567"
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
                      name="linkedin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LinkedIn Profile</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://www.linkedin.com/in/username"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>LinkedIn profile URL of the agent</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Professional Details</CardTitle>
                <CardDescription>Enter the agent's professional information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Property Advisor"
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
                    name="licenseNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="License Number"
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
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Head Office"
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
                    name="languages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Languages</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="English, Arabic, etc."
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
                    name="experience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Experience (years)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="5"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
                  name="introduction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Introduction</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="A brief professional introduction for the agent..."
                          rows={6}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>This text will be displayed on the agent's profile page</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Media</CardTitle>
                <CardDescription>Upload additional images and media for the agent</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Full-size profile photo"
                      className="w-full max-w-md h-auto object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-full max-w-md h-48 flex items-center justify-center bg-gray-100 rounded-md text-gray-400">
                      No photo preview available
                    </div>
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="photo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profile Photo (Full Size)</FormLabel>
                      <FormControl>
                        <CustomFileInput
                          label={isCompressing.photo ? "Compressing..." : "Upload Photo"}
                          value={field.value}
                          onChange={handlePhotoChange}
                          accept="image/*"
                          disabled={isCompressing.photo}
                          isCompressing={isCompressing.photo}
                        />
                      </FormControl>
                      <FormDescription>
                        This full-size photo will be uploaded to Supabase storage and displayed on the agent's profile page.
                      </FormDescription>
                      <FormMessage />
                      {isCompressing.photo && (
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

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/agents")}
                className="mr-2"
                disabled={isCompressing.headShot || isCompressing.photo}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending || isCompressing.headShot || isCompressing.photo}
                className="flex items-center gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Agent
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}