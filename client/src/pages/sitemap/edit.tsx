import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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

// Define the form schema to match the database schema
const sitemapFormSchema = z.object({
  completeUrl: z.string().min(1, "URL is required"),
  linkLabel: z.string().min(1, "Title is required"),
  section: z.string().optional(),
});

// Define form values type
interface SitemapFormValues {
  completeUrl: string;
  linkLabel: string;
  section?: string;
}

const defaultValues: SitemapFormValues = {
  completeUrl: "",
  linkLabel: "",
  section: "",
};

export default function SitemapEditPage() {
  const [match, params] = useRoute("/sitemap/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const isNewEntry = !match || params?.id === "new";
  const entryId = isNewEntry ? null : parseInt(params?.id || "");

  // Fetch sitemap entry data if editing
  const { data: sitemapData, isLoading: isLoadingData } = useQuery({
    queryKey: ["/api/sitemap", entryId],
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
      form.reset({
        completeUrl: sitemapData.completeUrl,
        linkLabel: sitemapData.linkLabel,
        section: sitemapData.section,
      });
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
      queryClient.invalidateQueries({ queryKey: ["/api/sitemap"] });
      navigate("/sitemap");
    },
    onError: (error) => {
      console.error("Failed to save sitemap entry:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewEntry ? "create" : "update"} sitemap entry. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof sitemapFormSchema>) => {
    saveMutation.mutate(data as SitemapFormValues);
  };

  return (
    <DashLayout
      title={isNewEntry ? "Add New Sitemap Entry" : "Edit Sitemap Entry"}
      description={
        isNewEntry ? "Create a new sitemap entry" : `Editing entry: ${form.watch("completeUrl")}`
      }
    >
      <Button variant="outline" className="mb-6" onClick={() => navigate("/sitemap")}>
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
                <CardDescription>Enter the sitemap entry details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="completeUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Path</FormLabel>
                      <FormControl>
                        <Input placeholder="/about-us" {...field} />
                      </FormControl>
                      <FormDescription>The path of the URL relative to the domain</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="linkLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Page Title</FormLabel>
                      <FormControl>
                        <Input placeholder="About Us" {...field} />
                      </FormControl>
                      <FormDescription>Title of the page for reference</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="section"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Section</FormLabel>
                      <FormControl>
                        <Input placeholder="Main Navigation" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormDescription>Optional section for organizing the sitemap</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={saveMutation.isPending} className="flex items-center gap-2">
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