import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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

// Define the form schema
const sitemapFormSchema = z.object({
  url: z.string().min(1, "URL is required"),
  title: z.string().min(1, "Title is required"),
  priority: z.string().optional(),
  changeFrequency: z.string().optional(),
  lastModified: z.string().optional(),
});

// Define form values type
interface SitemapFormValues {
  url: string;
  title: string;
  priority?: string;
  changeFrequency?: string;
  lastModified?: string;
}

const defaultValues: SitemapFormValues = {
  url: "",
  title: "",
  priority: "0.5",
  changeFrequency: "monthly",
  lastModified: new Date().toISOString().split('T')[0],
};

export default function SitemapEditPage() {
  const [match, params] = useRoute("/sitemap/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const isNewEntry = !match || params?.id === "new";
  const entryId = isNewEntry ? null : parseInt(params?.id || "");

  // Fetch sitemap entry data if editing
  const { data: sitemapData, isLoading: isLoadingData } = useQuery({
    queryKey: ['/api/sitemap', entryId],
    enabled: !!entryId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof sitemapFormSchema>>({
    resolver: zodResolver(sitemapFormSchema),
    defaultValues,
  });

  // Populate form when data is loaded
  useEffect(() => {
    if (sitemapData) {
      form.reset(sitemapData);
    }
  }, [sitemapData, form]);

  // Save sitemap entry mutation
  const saveMutation = useMutation({
    mutationFn: async (data: SitemapFormValues) => {
      if (isNewEntry) {
        return apiRequest("POST", "/api/sitemap", data);
      } else {
        return apiRequest("PUT", `/api/sitemap/${entryId}`, data);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewEntry ? "Entry created" : "Entry updated",
        description: isNewEntry 
          ? "The sitemap entry has been successfully created." 
          : "The sitemap entry has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sitemap'] });
      navigate("/sitemap");
    },
    onError: (error) => {
      console.error("Failed to save sitemap entry:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewEntry ? "create" : "update"} sitemap entry. Please try again.`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: z.infer<typeof sitemapFormSchema>) => {
    saveMutation.mutate(data as SitemapFormValues);
  };

  return (
    <DashLayout
      title={isNewEntry ? "Add New Sitemap Entry" : "Edit Sitemap Entry"}
      description={isNewEntry 
        ? "Create a new sitemap entry" 
        : `Editing entry: ${form.watch('url')}`}
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate("/sitemap")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Sitemap
      </Button>

      {isLoadingData ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Entry Information</CardTitle>
                <CardDescription>
                  Enter the sitemap entry details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Path</FormLabel>
                      <FormControl>
                        <Input placeholder="/about-us" {...field} />
                      </FormControl>
                      <FormDescription>
                        The path of the URL relative to the domain
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Page Title</FormLabel>
                      <FormControl>
                        <Input placeholder="About Us" {...field} />
                      </FormControl>
                      <FormDescription>
                        Title of the page for reference
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1.0">1.0 - Highest</SelectItem>
                            <SelectItem value="0.8">0.8 - High</SelectItem>
                            <SelectItem value="0.5">0.5 - Medium</SelectItem>
                            <SelectItem value="0.3">0.3 - Low</SelectItem>
                            <SelectItem value="0.1">0.1 - Lowest</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          The priority of this URL relative to other URLs
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="changeFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Change Frequency</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="always">Always</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                            <SelectItem value="never">Never</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How frequently the page is likely to change
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lastModified"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Modified</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>
                          When the page was last modified
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
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
                {isNewEntry ? "Create Entry" : "Update Entry"}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}