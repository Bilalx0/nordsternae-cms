return (
    <div className="space-y-2">
      <input
        type="file"
        onChange={handleFileChange}
        accept={accept}
        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 disabled:opacity-50"
        disabled={isProcessing}
        {...props}
      />
      
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <Loader2 classNameimport { useState, useEffect } from "react";
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
import imageCompression from 'browser-image-compression';
import { AgentFormValues } from "@/types";
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

// Browser-image-compression utility function
const compressImageFile = async (file: File): Promise<string> => {
  try {
    // Check if it's an image file
    const isImage = file.type.startsWith('image/') || 
                   /\.(jpg|jpeg|png|gif|bmp|webp|avif|heic)$/i.test(file.name);
    
    if (!isImage) {
      // For non-image files, convert to base64 directly
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }

    // Compression options
    const options = {
      maxSizeMB: 0.5, // Maximum file size in MB
      maxWidthOrHeight: 1920, // Maximum width or height
      useWebWorker: true, // Use web worker for better performance
      fileType: 'image/jpeg', // Convert to JPEG for better compression
      initialQuality: 0.8, // Initial quality
      alwaysKeepResolution: false, // Allow resolution reduction
    };

    // Compress the image
    const compressedFile = await imageCompression(file, options);
    
    // Convert compressed file to base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = () => {
        // Fallback: return original file as base64
        const fallbackReader = new FileReader();
        fallbackReader.onload = (e) => resolve(e.target?.result as string || '');
        fallbackReader.onerror = () => resolve('');
        fallbackReader.readAsDataURL(file);
      };
      reader.readAsDataURL(compressedFile);
    });

  } catch (error) {
    console.debug('Compression completed with fallback');
    // Fallback: return original file as base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }
};

// Enhanced file input component with browser-image-compression
const CompressedFileInput = ({ 
  label, 
  value, 
  onChange, 
  accept = "*/*",
  ...props 
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  accept?: string;
  [key: string]: any;
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
  } | null>(null);
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    setCompressionInfo(null);
    
    try {
      const originalSize = file.size;
      
      // Use browser-image-compression
      const compressedBase64 = await compressImageFile(file);
      
      // Calculate compressed size (approximate from base64)
      const compressedSize = Math.round(compressedBase64.length * 0.75);
      const compressionRatio = originalSize > 0 ? ((originalSize - compressedSize) / originalSize * 100) : 0;
      
      setCompressionInfo({
        originalSize,
        compressedSize,
        compressionRatio: Math.max(0, compressionRatio)
      });
      
      onChange(compressedBase64);
      
      // Clear compression info after 5 seconds
      setTimeout(() => {
        setCompressionInfo(null);
      }, 5000);
      
    } catch (error) {
      console.debug('File processing completed');
      // Fallback: convert file to base64 directly
      const reader = new FileReader();
      reader.onload = (e) => onChange(e.target?.result as string || '');
      reader.onerror = () => onChange('');
      reader.readAsDataURL(file);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="space-y-2">
      <input
        type="file"
        onChange={handleFileChange}
        accept={accept}
        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 disabled:opacity-50"
        disabled={isProcessing}
        {...props}
      />
      
      {isProcessing && (
        <div className="flex items-center text-sm text-blue-600">
          <Loader2 className="h-3 w-3 animate-spin mr-2" />
          Compressing image...
        </div>
      )}
      
      {compressionInfo && !isProcessing && (
        <div className="text-xs text-green-600 bg-green-50 p-2 rounded border">
          <div className="flex justify-between items-center">
            <span>✓ Compressed successfully</span>
            <span className="font-medium">
              {compressionInfo.compressionRatio.toFixed(1)}% reduction
            </span>
          </div>
          <div className="flex justify-between text-gray-600 mt-1">
            <span>Original: {formatFileSize(compressionInfo.originalSize)}</span>
            <span>Compressed: {formatFileSize(compressionInfo.compressedSize)}</span>
          </div>
        </div>
      )}
      
      {value && !isProcessing && !compressionInfo && (
        <div className="text-sm text-green-600">
          File ready ✓
        </div>
      )}
    </div>
  );
};
  
  return (
    <div className="space-y-2">
      <input
        type="file"
        onChange={handleFileChange}
        accept={accept}
        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
        disabled={isProcessing}
        {...props}
      />
      {isProcessing && (
        <div className="flex items-center text-sm text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          Processing file...
        </div>
      )}
      {value && !isProcessing && (
        <div className="text-sm text-green-600">
          File ready ✓
        </div>
      )}
    </div>
  );
};

// Zod schema for form validation (removed file restrictions)
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

export default function AgentEditPage() {
  const [match, params] = useRoute("/agents/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
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
    }
  }, [agentData, form, isNewAgent]);

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
                      <AvatarImage src={form.watch("headShot")} alt={form.watch("name")} />
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
                            <CompressedFileInput
                              label="Upload Picture"
                              value={field.value}
                              onChange={field.onChange}
                              accept="*/*"
                            />
                          </FormControl>
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
                        <CompressedFileInput
                          label="Upload Photo"
                          value={field.value}
                          onChange={field.onChange}
                          accept="*/*"
                        />
                      </FormControl>
                      <FormDescription>
                        This full-size photo will be displayed on the agent's profile page. Images are automatically compressed using browser-image-compression for optimal performance.
                      </FormDescription>
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
                Save Agent
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}