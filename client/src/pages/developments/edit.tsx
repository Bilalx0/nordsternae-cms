import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { Switch } from "@/components/ui/switch.jsx";
import { FileInput } from "@/components/ui/file-input.jsx";
import { apiRequest, queryClient } from "@/lib/queryClient.js";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast.js";
import { DevelopmentFormValues } from "@/types/index.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.jsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.jsx";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const developmentFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  area: z.string().optional(),
  propertyType: z.string().optional(),
  propertyDescription: z.string().optional(),
  price: z.number().positive().optional(),
  urlSlug: z.string().min(3, "URL slug must be at least 3 characters"),
  images: z.array(z.string()).optional(),
  maxBedrooms: z.number().int().positive().optional(),
  minBedrooms: z.number().int().min(0).optional(),
  floors: z.number().int().min(0).optional(),
  totalUnits: z.number().int().min(0).optional(),
  minArea: z.number().positive().optional(),
  maxArea: z.number().positive().optional(),
  address: z.string().optional(),
  addressDescription: z.string().optional(),
  currency: z.string().optional(),
  amenities: z.string().optional(),
  subtitle: z.string().optional(),
  developerLink: z.string().optional(),
  neighbourhoodLink: z.string().optional(),
  featureOnHomepage: z.boolean().optional(),
});

const defaultValues: DevelopmentFormValues = {
  title: "",
  description: "",
  area: "Dubai",
  propertyType: "",
  propertyDescription: "",
  price: undefined,
  urlSlug: "",
  images: [],
  maxBedrooms: undefined,
  minBedrooms: undefined,
  floors: undefined,
  totalUnits: undefined,
  minArea: undefined,
  maxArea: undefined,
  address: "",
  addressDescription: "",
  currency: "AED",
  amenities: "",
  subtitle: "",
  developerLink: "",
  neighbourhoodLink: "",
  featureOnHomepage: false,
};

export default function DevelopmentEditPage() {
  const [_, navigate] = useLocation();
  const [match, params] = useRoute("/developments/:id");
  const { toast } = useToast();
  const isNewDevelopment = !match || params?.id === "new";
  const developmentId = isNewDevelopment ? null : parseInt(params?.id || "");

  // Fetch developers for the dropdown
  const { data: developers = [] } = useQuery({
    queryKey: ["/api/developers"],
    queryFn: async () => {
      return apiRequest("GET", "/api/developers");
    },
  });

  // Fetch neighborhoods for the dropdown
  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["/api/neighborhoods"],
    queryFn: async () => {
      return apiRequest("GET", "/api/neighborhoods");
    },
  });

  // Fetch development data if editing
  const { data: developmentData, isLoading: isLoadingDevelopment } = useQuery({
    queryKey: ["/api/developments", developmentId],
    queryFn: async () => {
      return apiRequest("GET", `/api/developments/${developmentId}`);
    },
    enabled: !!developmentId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof developmentFormSchema>>({
    resolver: zodResolver(developmentFormSchema),
    defaultValues,
  });

  // Populate form when development data is loaded
  useEffect(() => {
    if (developmentData && !isNewDevelopment) {
      const formData: DevelopmentFormValues = {
        title: developmentData.title || "",
        description: developmentData.description || "",
        area: developmentData.area || "Dubai",
        propertyType: developmentData.propertyType || "",
        propertyDescription: developmentData.propertyDescription || "",
        price:
          typeof developmentData.price === "string"
            ? parseFloat(developmentData.price) || undefined
            : developmentData.price || undefined,
        urlSlug: developmentData.urlSlug || "",
        images: Array.isArray(developmentData.images)
          ? developmentData.images
          : developmentData.images
          ? [developmentData.images]
          : [],
        maxBedrooms:
          typeof developmentData.maxBedrooms === "string"
            ? parseInt(developmentData.maxBedrooms) || undefined
            : developmentData.maxBedrooms || undefined,
        minBedrooms:
          typeof developmentData.minBedrooms === "string"
            ? parseInt(developmentData.minBedrooms) || undefined
            : developmentData.minBedrooms || undefined,
        floors:
          typeof developmentData.floors === "string"
            ? parseInt(developmentData.floors) || undefined
            : developmentData.floors || undefined,
        totalUnits:
          typeof developmentData.totalUnits === "string"
            ? parseInt(developmentData.totalUnits) || undefined
            : developmentData.totalUnits || undefined,
        minArea:
          typeof developmentData.minArea === "string"
            ? parseInt(developmentData.minArea) || undefined
            : developmentData.minArea || undefined,
        maxArea:
          typeof developmentData.maxArea === "string"
            ? parseInt(developmentData.maxArea) || undefined
            : developmentData.maxArea || undefined,
        address: developmentData.address || "",
        addressDescription: developmentData.addressDescription || "",
        currency: developmentData.currency || "AED",
        amenities: developmentData.amenities || "",
        subtitle: developmentData.subtitle || "",
        developerLink: developmentData.developerLink || "",
        neighbourhoodLink: developmentData.neighbourhoodLink || "",
        featureOnHomepage: !!developmentData.featureOnHomepage,
      };

      form.reset(formData);
    }
  }, [developmentData, form, isNewDevelopment]);

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
      if (name === "title" && value.title && isNewDevelopment) {
        const slug = generateSlug(value.title as string);
        form.setValue("urlSlug", slug);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, isNewDevelopment]);

  // Save development mutation
  const saveMutation = useMutation({
    mutationFn: async (data: DevelopmentFormValues) => {
      if (isNewDevelopment) {
        return apiRequest("POST", "/api/developments", data);
      } else {
        return apiRequest("PUT", `/api/developments/${developmentId}`, data);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewDevelopment ? "Development created" : "Development updated",
        description: isNewDevelopment
          ? "The development has been successfully created."
          : "The development has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/developments"] });
      navigate("/developments");
    },
    onError: (error) => {
      console.error("Failed to save development:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewDevelopment ? "create" : "update"} development. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof developmentFormSchema>) => {
    saveMutation.mutate(data as DevelopmentFormValues);
  };

  return (
    <DashLayout
      title={isNewDevelopment ? "Add New Development" : "Edit Development"}
      description={
        isNewDevelopment
          ? "Create a new development project"
          : `Editing development: ${form.watch("title") || "Loading..."}`
      }
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate("/developments")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Developments
      </Button>

      {isLoadingDevelopment && !isNewDevelopment ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading development data...</span>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Enter the basic details for this development</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Development Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Bayz 101" {...field} />
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
                        <Input placeholder="By Danube Properties" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>A brief tagline or subtitle for the development</FormDescription>
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
                          <Input placeholder="bayz_101" {...field} />
                        </FormControl>
                        <FormDescription>Used for the website URL (automatically generated)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="area"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Area</FormLabel>
                        <FormControl>
                          <Input placeholder="Business Bay, Dubai" {...field} value={field.value || ""} />
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
                          placeholder="Enter development description..."
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

            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
                <CardDescription>Enter information about the properties in this development</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <FormControl>
                          <Input placeholder="Apartments" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="propertyDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Description</FormLabel>
                        <FormControl>
                          <Input placeholder="1-4 Beds" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Starting Price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1750000"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "AED"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="AED">AED</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="totalUnits"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Units</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="500"
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

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="minBedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min. Bedrooms</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxBedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max. Bedrooms</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="4"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="minArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min. Area (sq ft)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="800"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max. Area (sq ft)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="2500"
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
                  name="floors"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Floors</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="50"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
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
                <CardTitle>Location</CardTitle>
                <CardDescription>Enter location details for this development</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Business Bay, Dubai, UAE" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="addressDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional location details..."
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
                <CardTitle>Amenities</CardTitle>
                <CardDescription>Enter amenities available in this development</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="amenities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amenities</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Walk-in wardrobes, Secure parking, Concierge Service..."
                          rows={4}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>Enter amenities as a comma-separated list</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Media</CardTitle>
                <CardDescription>Upload images for this development</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="images"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Development Images</FormLabel>
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
                      <FormDescription>Upload up to 10 images of the development</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Related Links</CardTitle>
                <CardDescription>Connect this development to related entities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="developerLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Developer</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a developer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {(developers as Array<{ id: number; urlSlug: string; title: string }>).map(
                            (developer) => (
                              <SelectItem key={developer.id} value={developer.urlSlug}>
                                {developer.title}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>Link to the developer of this project</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="neighbourhoodLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Neighborhood</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a neighborhood" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {(neighborhoods as Array<{ id: number; urlSlug: string; title: string }>).map(
                            (neighborhood) => (
                              <SelectItem key={neighborhood.id} value={neighborhood.urlSlug}>
                                {neighborhood.title}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>Link to the neighborhood where this development is located</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visibility</CardTitle>
                <CardDescription>Control the visibility and promotion of this development</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="featureOnHomepage"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Featured Development</FormLabel>
                        <FormDescription>Feature this development on the homepage</FormDescription>
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
                onClick={() => navigate("/developments")}
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
                Save Development
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}