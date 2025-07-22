import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileInput } from "@/components/ui/file-input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
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
  maxSizeMB: 1, // Maximum file size in MB
  maxWidthOrHeight: 1920, // Maximum width or height
  useWebWorker: true, // Use web worker for better performance
  quality: 0.8, // Image quality (0-1)
};

// Compression options for headshot (smaller since it's used as avatar)
const headshotCompressionOptions = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 800,
  useWebWorker: true,
  quality: 0.8,
};

export default function AgentEditPage() {
  const [match, params] = useRoute("/agents/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [previewImages, setPreviewImages] = useState({
    headShot: "",
    photo: ""
  });
  
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

  // Populate form when agent data is loaded
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

      form.reset(formData);
      
      // Set preview images
      setPreviewImages({
        headShot: agentData.headShot || "",
        photo: agentData.photo || ""
      });
    }
  }, [agentData, form, isNewAgent]);

  // Image compression helper function
  const compressImage = async (file: File, isHeadshot: boolean = false): Promise<string> => {
    try {
      setIsCompressingImage(true);
      
      const options = isHeadshot ? headshotCompressionOptions : compressionOptions;
      const compressedFile = await imageCompression(file, options);
      
      // Convert compressed file to base64 data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedFile);
      });
    } catch (error) {
      console.error('Error compressing image:', error);
      toast({
        title: "Compression Error",
        description: "Failed to compress image. Please try with a different image.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsCompressingImage(false);
    }
  };

  // Enhanced file input handler for headshot
  const handleHeadshotChange = async (file: File | null) => {
    if (!file) {
      form.setValue("headShot", "");
      setPreviewImages(prev => ({ ...prev, headShot: "" }));
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file, true);
      form.setValue("headShot", compressedDataUrl);
      setPreviewImages(prev => ({ ...prev, headShot: compressedDataUrl }));
      
      toast({
        title: "Image Compressed",
        description: `Image compressed successfully. Original: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      });
    } catch (error) {
      // Error already handled in compressImage function
    }
  };

  // Enhanced file input handler for photo
  const handlePhotoChange = async (file: File | null) => {
    if (!file) {
      form.setValue("photo", "");
      setPreviewImages(prev => ({ ...prev, photo: "" }));
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file, false);
      form.setValue("photo", compressedDataUrl);
      setPreviewImages(prev => ({ ...prev, photo: compressedDataUrl }));
      
      toast({
        title: "Image Compressed",
        description: `Image compressed successfully. Original: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      });
    } catch (error) {
      // Error already handled in compressImage function
    }
  };

  // Save agent mutation
  const saveMutation = useMutation({
    mutationFn: async (data: AgentFormValues) => {
      if (isNewAgent) {
        return apiRequest("POST", "/api/agents", data);
      } else {
        return apiRequest("PUT", `/api/agents/${agentId}`, data);
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
        description: `Failed to ${isNewAgent ? "create" : "update"} agent. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof agentFormSchema>) => {
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
                    <Avatar className="h-32 w-32">
                      <AvatarImage 
                        src={previewImages.headShot || form.watch("headShot")} 
                        alt={form.watch("name")} 
                      />
                      <AvatarFallback className="text-2xl">
                        {form.watch("name")?.charAt(0) || "A"}
                      </AvatarFallback>
                    </Avatar>

                    <FormField
                      control={form.control}
                      name="headShot"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel>Profile Picture</FormLabel>
                          <FormControl>
                            <FileInput
                              label={isCompressingImage ? "Compressing..." : "Upload Picture"}
                              value=""
                              onChange={handleHeadshotChange}
                              accept="image/*"
                              disabled={isCompressingImage}
                            />
                          </FormControl>
                          <FormDescription>
                            Images will be automatically compressed for optimal performance
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
                <FormField
                  control={form.control}
                  name="photo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profile Photo (Full Size)</FormLabel>
                      <FormControl>
                        <FileInput
                          label={isCompressingImage ? "Compressing..." : "Upload Photo"}
                          value=""
                          onChange={handlePhotoChange}
                          accept="image/*"
                          disabled={isCompressingImage}
                        />
                      </FormControl>
                      <FormDescription>
                        This full-size photo will be displayed on the agent's profile page. Images are automatically compressed for optimal performance.
                      </FormDescription>
                      {(previewImages.photo || field.value) && (
                        <div className="mt-4">
                          <img
                            src={previewImages.photo || field.value}
                            alt="Profile Photo Preview"
                            className="max-w-xs h-auto rounded-md"
                            onError={() => {
                              toast({
                                title: "Image Preview Error",
                                description: "Unable to display the image preview. Please try uploading a different image.",
                                variant: "destructive",
                              });
                              form.setValue("photo", "");
                              setPreviewImages(prev => ({ ...prev, photo: "" }));
                            }}
                          />
                        </div>
                      )}
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
                onClick={() => navigate("/agents")}
                className="mr-2"
                disabled={isCompressingImage}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending || isCompressingImage}
                className="flex items-center gap-2"
              >
                {saveMutation.isPending || isCompressingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isCompressingImage ? "Compressing..." : "Save Agent"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}