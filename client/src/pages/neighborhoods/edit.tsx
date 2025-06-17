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

export default function NeighborhoodEditPage() {
  const [match, params] = useRoute("/neighborhoods/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const isNewNeighborhood = !match || params?.id === "new";
  const neighborhoodId = isNewNeighborhood ? null : parseInt(params?.id || "");

  // Fetch neighborhood data if editing
  const { data: neighborhoodData, isLoading: isLoadingNeighborhood } = useQuery({
    queryKey: ['/api/neighborhoods', neighborhoodId],
    enabled: !!neighborhoodId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof neighborhoodFormSchema>>({
    resolver: zodResolver(neighborhoodFormSchema),
    defaultValues,
  });

  // Populate form when neighborhood data is loaded
  useEffect(() => {
    if (neighborhoodData) {
      const formData = { ...neighborhoodData };
      
      // Convert string numbers to actual numbers
      if (typeof formData.availableProperties === 'string') {
        formData.availableProperties = parseInt(formData.availableProperties) || undefined;
      }
      
      form.reset(formData);
    }
  }, [neighborhoodData, form]);

  // Generate URL slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/-+/g, "_");
  };

  // Update URL slug when title changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'title' && value.title && isNewNeighborhood) {
        const slug = generateSlug(value.title as string);
        form.setValue('urlSlug', slug);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, isNewNeighborhood]);

  // Save neighborhood mutation
  const saveMutation = useMutation({
    mutationFn: async (data: NeighborhoodFormValues) => {
      if (isNewNeighborhood) {
        return apiRequest("POST", "/api/neighborhoods", data);
      } else {
        return apiRequest("PUT", `/api/neighborhoods/${neighborhoodId}`, data);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewNeighborhood ? "Neighborhood created" : "Neighborhood updated",
        description: isNewNeighborhood 
          ? "The neighborhood has been successfully created." 
          : "The neighborhood has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/neighborhoods'] });
      navigate("/neighborhoods");
    },
    onError: (error) => {
      console.error("Failed to save neighborhood:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewNeighborhood ? "create" : "update"} neighborhood. Please try again.`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: z.infer<typeof neighborhoodFormSchema>) => {
    saveMutation.mutate(data as NeighborhoodFormValues);
  };

  return (
    <DashLayout
      title={isNewNeighborhood ? "Add New Neighborhood" : "Edit Neighborhood"}
      description={isNewNeighborhood 
        ? "Create a new neighborhood location" 
        : `Editing neighborhood: ${form.watch('title')}`}
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate("/neighborhoods")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Neighborhoods
      </Button>

      {isLoadingNeighborhood ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Enter the basic details for this neighborhood
                </CardDescription>
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
                        <Input placeholder="A Majestic Man-Made Island in the Arabian Gulf" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>
                        A brief tagline or subtitle for the neighborhood
                      </FormDescription>
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
                        <FormDescription>
                          Used for the website URL (automatically generated)
                        </FormDescription>
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
                <CardDescription>
                  Enter detailed information about this neighborhood location
                </CardDescription>
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
                      <FormDescription>
                        Key amenities and attractions in this neighborhood
                      </FormDescription>
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
                      <FormDescription>
                        Number of properties available in this neighborhood
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Neighborhood Details</CardTitle>
                <CardDescription>
                  Additional information about this neighborhood
                </CardDescription>
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
                <CardDescription>
                  Upload images and documents for this neighborhood
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="bannerImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banner Image</FormLabel>
                      <FormControl>
                        <Input placeholder="Image URL..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>
                        URL for the main banner image
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
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
                          onChange={field.onChange}
                          accept="image/*"
                          multiple={true}
                          maxFiles={10}
                        />
                      </FormControl>
                      <FormDescription>
                        Upload up to 10 images of the neighborhood
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="neighbourImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Neighbor Image</FormLabel>
                      <FormControl>
                        <Input placeholder="Image URL..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>
                        URL for the neighboring areas image
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="brochure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brochure</FormLabel>
                      <FormControl>
                        <Input placeholder="Brochure URL..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>
                        URL to a PDF brochure for this neighborhood
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visibility</CardTitle>
                <CardDescription>
                  Control the visibility of this neighborhood
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="showOnFooter"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Show on Footer</FormLabel>
                        <FormDescription>
                          Display this neighborhood in the website footer
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
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
                Save Neighborhood
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}
