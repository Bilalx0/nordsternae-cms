import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FileInput } from "@/components/ui/file-input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BannerHighlightFormValues } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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

export default function BannerHighlightEditPage() {
  const [match, params] = useRoute("/banner-highlights/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const isNewBanner = !match || params?.id === "new";
  const bannerId = isNewBanner ? null : parseInt(params?.id || "");

  // Fetch banner data if editing
  const { data: bannerData, isLoading: isLoadingBanner } = useQuery({
    queryKey: ['/api/banner-highlights', bannerId],
    enabled: !!bannerId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof bannerFormSchema>>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues,
  });

  // Populate form when banner data is loaded
  useEffect(() => {
    if (bannerData) {
      form.reset(bannerData);
      setPreviewImage(bannerData.image || null);
    }
  }, [bannerData, form]);

  // Update preview when image changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'image') {
        setPreviewImage(value.image as string);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  // Save banner mutation
  const saveMutation = useMutation({
    mutationFn: async (data: BannerHighlightFormValues) => {
      if (isNewBanner) {
        return apiRequest("POST", "/api/banner-highlights", data);
      } else {
        return apiRequest("PUT", `/api/banner-highlights/${bannerId}`, data);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewBanner ? "Banner created" : "Banner updated",
        description: isNewBanner 
          ? "The banner highlight has been successfully created." 
          : "The banner highlight has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/banner-highlights'] });
      navigate("/banner-highlights");
    },
    onError: (error) => {
      console.error("Failed to save banner:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewBanner ? "create" : "update"} banner. Please try again.`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: z.infer<typeof bannerFormSchema>) => {
    saveMutation.mutate(data as BannerHighlightFormValues);
  };

  return (
    <DashLayout
      title={isNewBanner ? "Add New Banner Highlight" : "Edit Banner Highlight"}
      description={isNewBanner 
        ? "Create a new promotional banner" 
        : `Editing banner: ${form.watch('title')}`}
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate("/banner-highlights")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Banner Highlights
      </Button>

      {isLoadingBanner ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Banner Information</CardTitle>
                    <CardDescription>
                      Enter the details for this banner highlight
                    </CardDescription>
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
                          <FormDescription>
                            Internal reference title for this banner
                          </FormDescription>
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
                          <FormDescription>
                            The main headline displayed on the banner
                          </FormDescription>
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
                            <Input placeholder="A Remarkable Collection Of Branded Residences" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormDescription>
                            Secondary text displayed under the headline
                          </FormDescription>
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
                              <Input placeholder="https://nordstern.ae/article/..." {...field} value={field.value || ""} />
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
                          <FormLabel>Banner Image URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com/banner.jpg" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormDescription>
                            The URL for the banner image
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
                    <CardDescription>
                      Control when and how this banner appears
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Active</FormLabel>
                            <FormDescription>
                              Display this banner on the website
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
              </div>
              
              <div className="md:col-span-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Banner Preview</CardTitle>
                    <CardDescription>
                      How the banner will look on the website
                    </CardDescription>
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
                        {form.watch('headline') || "Headline"}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {form.watch('subheading') || "Subheading text will appear here"}
                      </p>
                      <div className="mt-4">
                        <span className="inline-block px-4 py-2 bg-primary text-white text-sm font-medium rounded">
                          {form.watch('cta') || "Read More"}
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
                Save Banner
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}
