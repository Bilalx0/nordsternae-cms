import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import { Switch } from "@/components/ui/switch.jsx";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import { FileInput } from "@/components/ui/file-input.jsx";
import { apiRequest, queryClient } from "@/lib/queryClient.js";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast.js";
import { PropertyFormValues } from "@/types/index.js";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select.jsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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

const propertyFormSchema = z.object({
  reference: z.string().min(3, "Reference must be at least 3 characters"),
  listingType: z.string(),
  propertyType: z.string(),
  subCommunity: z.string().optional(),
  community: z.string(),
  region: z.string(),
  country: z.string(),
  agent: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  price: z.number().positive("Price must be a positive number"),
  currency: z.string(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().int().optional(),
  propertyStatus: z.string().optional(),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().optional(),
  sqfeetArea: z.number().positive().optional(),
  sqfeetBuiltup: z.number().positive().optional(),
  isExclusive: z.boolean().optional(),
  amenities: z.string().optional(),
  isFeatured: z.boolean().optional(),
  isFitted: z.boolean().optional(),
  isFurnished: z.boolean().optional(),
  lifestyle: z.string().optional(),
  permit: z.string().optional(),
  brochure: z.string().optional(),
  images: z.array(z.string()).optional(),
  isDisabled: z.boolean().optional(),
  development: z.string().optional(),
  neighbourhood: z.string().optional(),
  sold: z.boolean().optional()
});

const defaultValues: PropertyFormValues = {
  reference: "",
  listingType: "sale",
  propertyType: "villa",
  subCommunity: "",
  community: "",
  region: "Dubai",
  country: "AE",
  agent: [],
  price: 0,
  currency: "AED",
  bedrooms: undefined,
  bathrooms: undefined,
  propertyStatus: "Off Plan",
  title: "",
  description: "",
  sqfeetArea: undefined,
  sqfeetBuiltup: undefined,
  isExclusive: false,
  amenities: "",
  isFeatured: false,
  isFitted: false,
  isFurnished: false,
  lifestyle: "",
  permit: "",
  brochure: "",
  images: [],
  isDisabled: false,
  development: "",
  neighbourhood: "",
  sold: false
};

const amenitiesList = [
  "Balcony", "BBQ area", "Built in wardrobes", "Central air conditioning",
  "Covered parking", "Fully fitted kitchen", "Private Gym", "Private Jacuzzi",
  "Kitchen Appliances", "Maids Room", "Pets allowed", "Private Garden",
  "Private Pool", "Sauna", "Steam room", "Study", "Sea/Water view",
  "Security", "Maintenance", "Within a Compound", "Indoor swimming pool",
  "Golf view", "Terrace", "Concierge Service", "Spa", "Maid Service",
  "Walk-in Closet", "Heating", "Children's Play Area", "Lobby in Building",
  "Children's Pool"
];

export default function PropertyEditPage() {
  const [match, params] = useRoute("/properties/:id");
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const isNewProperty = !match || params?.id === "new";
  const propertyId = isNewProperty ? null : parseInt(params?.id || "");

  // Fetch agents for the dropdown
  const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: ['/api/agents'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/agents");
      console.log("Fetched agents:", response);
      return response;
    }
  });

  // Fetch property data if editing
  const { data: propertyData, isLoading: isLoadingProperty } = useQuery({
    queryKey: ['/api/properties', propertyId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/properties/${propertyId}`);
      console.log("Fetched property data:", response);
      return response;
    },
    enabled: !!propertyId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof propertyFormSchema>>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues,
  });

  // Populate form when property data is loaded
  useEffect(() => {
    if (propertyData && !isNewProperty) {
      console.log("Populating form with property data:", propertyData);
      
      // Create a clean form data object
      const formData: PropertyFormValues = {
        // String fields with fallbacks
        reference: propertyData.reference || "",
        listingType: propertyData.listingType || "sale",
        propertyType: propertyData.propertyType || "villa",
        subCommunity: propertyData.subCommunity || "",
        community: propertyData.community || "",
        region: propertyData.region || "Dubai",
        country: propertyData.country || "AE",
        propertyStatus: propertyData.propertyStatus || "Off Plan",
        title: propertyData.title || "",
        description: propertyData.description || "",
        currency: propertyData.currency || "AED",
        lifestyle: propertyData.lifestyle || "",
        permit: propertyData.permit || "",
        brochure: propertyData.brochure || "",
        development: propertyData.development || "",
        neighbourhood: propertyData.neighbourhood || "",

        // Numeric fields with proper conversion
        price: typeof propertyData.price === 'string' ? parseFloat(propertyData.price) || 0 : (propertyData.price || 0),
        bedrooms: propertyData.bedrooms ? (typeof propertyData.bedrooms === 'string' ? parseInt(propertyData.bedrooms) : propertyData.bedrooms) : undefined,
        bathrooms: propertyData.bathrooms ? (typeof propertyData.bathrooms === 'string' ? parseInt(propertyData.bathrooms) : propertyData.bathrooms) : undefined,
        sqfeetArea: propertyData.sqfeetArea ? (typeof propertyData.sqfeetArea === 'string' ? parseInt(propertyData.sqfeetArea) : propertyData.sqfeetArea) : undefined,
        sqfeetBuiltup: propertyData.sqfeetBuiltup ? (typeof propertyData.sqfeetBuiltup === 'string' ? parseInt(propertyData.sqfeetBuiltup) : propertyData.sqfeetBuiltup) : undefined,

        // Boolean fields with proper conversion
        isExclusive: !!propertyData.isExclusive,
        isFeatured: !!propertyData.isFeatured,
        isFitted: !!propertyData.isFitted,
        isFurnished: !!propertyData.isFurnished,
        isDisabled: !!propertyData.isDisabled,
        sold: !!propertyData.sold,

        // Array fields
        images: Array.isArray(propertyData.images) ? propertyData.images : (propertyData.images ? [propertyData.images] : []),
        agent: Array.isArray(propertyData.agent) ? propertyData.agent : (propertyData.agent ? [propertyData.agent] : []),

        // Handle amenities (convert array to comma-separated string if needed)
        amenities: Array.isArray(propertyData.amenities) 
          ? propertyData.amenities.join(',') 
          : (propertyData.amenities || ''),
      };

      console.log("Processed form data:", formData);
      console.log("Agent field value:", formData.agent);

      // Reset the form with the new data
      form.reset(formData);
    }
  }, [propertyData, form, isNewProperty]);

  // Save property mutation
  const saveMutation = useMutation({
    mutationFn: async (data: PropertyFormValues) => {
      // Parse amenities selection from array of strings to comma-separated string
      if (Array.isArray(data.amenities)) {
        data.amenities = data.amenities.join(',');
      }
      
      console.log("Saving property with data:", data);

      if (isNewProperty) {
        return apiRequest("POST", "/api/properties", data);
      } else {
        return apiRequest("PUT", `/api/properties/${propertyId}`, data);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewProperty ? "Property created" : "Property updated",
        description: isNewProperty 
          ? "The property has been successfully created." 
          : "The property has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      setLocation("/properties");
    },
    onError: (error) => {
      console.error("Failed to save property:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewProperty ? "create" : "update"} property. Please try again.`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: z.infer<typeof propertyFormSchema>) => {
    console.log("Form submitted with data:", data);
    saveMutation.mutate(data as PropertyFormValues);
  };

  // Convert comma-separated amenities string to array for checkboxes
  const getSelectedAmenities = () => {
    const amenitiesValue = form.watch('amenities');
    if (!amenitiesValue) return [];
    return typeof amenitiesValue === 'string' 
      ? amenitiesValue.split(',').filter(Boolean) 
      : amenitiesValue;
  };
  
  const selectedAmenities = getSelectedAmenities();

  const toggleAmenity = (amenity: string) => {
    const currentAmenities = getSelectedAmenities();
    const newAmenities = currentAmenities.includes(amenity)
      ? currentAmenities.filter(a => a !== amenity)
      : [...currentAmenities, amenity];
    
    form.setValue('amenities', newAmenities.join(','));
  };

  return (
    <DashLayout
      title={isNewProperty ? "Add New Property" : "Edit Property"}
      description={isNewProperty 
        ? "Create a new property listing" 
        : `Editing property: ${form.watch('title') || form.watch('reference') || 'Loading...'}`}
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => setLocation("/properties")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Properties
      </Button>

      {isLoadingProperty && !isNewProperty ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading property data...</span>
        </div>
      ) : isLoadingAgents ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading agents data...</span>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Enter the basic details for this property
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reference</FormLabel>
                        <FormControl>
                          <Input placeholder="NS1234" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="listingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Listing Type</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            console.log("Listing Type changed to:", value);
                            field.onChange(value);
                          }}
                          value={field.value || "sale"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select listing type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sale">Sale</SelectItem>
                            <SelectItem value="rent">Rent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Luxurious Villa in Palm Jumeirah" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            console.log("Property Type changed to:", value);
                            field.onChange(value);
                          }}
                          value={field.value || "villa"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select property type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="villa">Villa</SelectItem>
                            <SelectItem value="apartment">Apartment</SelectItem>
                            <SelectItem value="penthouse">Penthouse</SelectItem>
                            <SelectItem value="townhouse">Townhouse</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="propertyStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Status</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            console.log("Property Status changed to:", value);
                            field.onChange(value);
                          }}
                          value={field.value || "Off Plan"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Off Plan">Off Plan</SelectItem>
                            <SelectItem value="Ready">Ready</SelectItem>
                            <SelectItem value="Sold">Sold</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="sold"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-end space-x-2 space-y-0 rounded-md p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Mark as Sold</FormLabel>
                          <FormDescription>
                            This property will be marked as sold
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
                <CardDescription>
                  Enter the location details for this property
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="community"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Community</FormLabel>
                        <FormControl>
                          <Input placeholder="Palm Jumeirah" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="subCommunity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sub-Community</FormLabel>
                        <FormControl>
                          <Input placeholder="Frond K" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <FormControl>
                          <Input placeholder="Dubai" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="AE" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="development"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Development</FormLabel>
                        <FormControl>
                          <Input placeholder="Development name" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="neighbourhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Neighbourhood</FormLabel>
                        <FormControl>
                          <Input placeholder="Neighbourhood" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Property Details</CardTitle>
                <CardDescription>
                  Enter the detailed information about this property
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="1000000" 
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                        <Select 
                          onValueChange={(value) => {
                            console.log("Currency changed to:", value);
                            field.onChange(value);
                          }}
                          value={field.value || "AED"}
                        >
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
                    name="isExclusive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-end space-x-2 space-y-0 rounded-md p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Exclusive</FormLabel>
                          <FormDescription>
                            This is an exclusive property
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bedrooms</FormLabel>
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
                    name="bathrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bathrooms</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="3" 
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
                    name="sqfeetArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Area (sq ft)</FormLabel>
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
                  
                  <FormField
                    control={form.control}
                    name="sqfeetBuiltup"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Built-up Area (sq ft)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="3000" 
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter property description..." 
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
                <CardTitle>Amenities</CardTitle>
                <CardDescription>
                  Select amenities available with this property
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {amenitiesList.map((amenity) => (
                    <div key={amenity} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`amenity-${amenity}`}
                        checked={selectedAmenities.includes(amenity)}
                        onCheckedChange={() => toggleAmenity(amenity)}
                      />
                      <label
                        htmlFor={`amenity-${amenity}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {amenity}
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Property Features</CardTitle>
                <CardDescription>
                  Additional features and details for this property
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Featured Property</FormLabel>
                          <FormDescription>
                            Highlight this property on the homepage
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
                  
                  <FormField
                    control={form.control}
                    name="isFitted"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Fitted</FormLabel>
                          <FormDescription>
                            Property comes with basic fixtures
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
                  
                  <FormField
                    control={form.control}
                    name="isFurnished"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Furnished</FormLabel>
                          <FormDescription>
                            Property comes fully furnished
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
                </div>
                
                <FormField
                  control={form.control}
                  name="lifestyle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lifestyle</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Luxury, Beach, Family..." 
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Comma-separated lifestyle tags
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="permit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permit Number</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Permit reference..." 
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
                <CardTitle>Media & Documents</CardTitle>
                <CardDescription>
                  Upload images and documents for this property
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="images"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Images</FormLabel>
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
                        Upload up to 10 images of the property
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
                        <Input 
                          placeholder="Brochure URL..." 
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Link to a PDF brochure for this property
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent Assignment</CardTitle>
                <CardDescription>
                  Assign an agent to this property
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="agent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned Agent</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            if (value === "") {
                              console.log("Agent cleared");
                              field.onChange([]);
                            } else {
                              const selectedAgent = (agents as Array<{id: number; name: string}>).find(a => a.id === parseInt(value));
                              if (selectedAgent) {
                                console.log("Agent selected:", selectedAgent);
                                field.onChange([{ 
                                  id: selectedAgent.id.toString(), 
                                  name: selectedAgent.name 
                                }]);
                              }
                            }
                          }}
                          value={field.value?.[0]?.id ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an agent" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">No Agent</SelectItem>
                            {(agents as Array<{id: number; name: string}>).map((agent) => (
                              <SelectItem key={agent.id} value={agent.id.toString()}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select an agent to assign to this property
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visibility</CardTitle>
                <CardDescription>
                  Control the visibility of this property
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="isDisabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Hidden</FormLabel>
                        <FormDescription>
                          This property will not be visible on the website
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
                onClick={() => setLocation("/properties")}
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
                Save Property
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}