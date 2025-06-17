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

export default function DeveloperEditPage() {
  const [match, params] = useRoute("/developers/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const isNewDeveloper = !match || params?.id === "new";
  const developerId = isNewDeveloper ? null : parseInt(params?.id || "");

  // Fetch developer data if editing
  const { data: developerData, isLoading: isLoadingDeveloper } = useQuery({
    queryKey: ['/api/developers', developerId],
    enabled: !!developerId,
  });

  // Form setup with react-hook-form
  const form = useForm<z.infer<typeof developerFormSchema>>({
    resolver: zodResolver(developerFormSchema),
    defaultValues,
  });

  // Populate form when developer data is loaded
  useEffect(() => {
    if (developerData) {
      form.reset(developerData);
    }
  }, [developerData, form]);

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
      if (name === 'title' && value.title && isNewDeveloper) {
        const slug = generateSlug(value.title as string);
        form.setValue('urlSlug', slug);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, isNewDeveloper]);

  // Save developer mutation
  const saveMutation = useMutation({
    mutationFn: async (data: DeveloperFormValues) => {
      if (isNewDeveloper) {
        return apiRequest("POST", "/api/developers", data);
      } else {
        return apiRequest("PUT", `/api/developers/${developerId}`, data);
      }
    },
    onSuccess: () => {
      toast({
        title: isNewDeveloper ? "Developer created" : "Developer updated",
        description: isNewDeveloper 
          ? "The developer has been successfully created." 
          : "The developer has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/developers'] });
      navigate("/developers");
    },
    onError: (error) => {
      console.error("Failed to save developer:", error);
      toast({
        title: "Error",
        description: `Failed to ${isNewDeveloper ? "create" : "update"} developer. Please try again.`,
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: z.infer<typeof developerFormSchema>) => {
    saveMutation.mutate(data as DeveloperFormValues);
  };

  return (
    <DashLayout
      title={isNewDeveloper ? "Add New Developer" : "Edit Developer"}
      description={isNewDeveloper 
        ? "Create a new real estate developer" 
        : `Editing developer: ${form.watch('title')}`}
    >
      <Button
        variant="outline"
        className="mb-6"
        onClick={() => navigate("/developers")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Developers
      </Button>

      {isLoadingDeveloper ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Developer Information</CardTitle>
                <CardDescription>
                  Enter the details for this developer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-8 items-start">
                  <div className="w-full max-w-xs flex flex-col items-center space-y-4">
                    <Avatar className="h-32 w-32">
                      <AvatarImage src={form.watch('logo')} alt={form.watch('title')} />
                      <AvatarFallback className="text-2xl">
                        {form.watch('title')?.charAt(0) || "D"}
                      </AvatarFallback>
                    </Avatar>
                    
                    <FormField
                      control={form.control}
                      name="logo"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel>Logo URL</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="https://example.com/logo.png" 
                              {...field} 
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            URL to the developer's logo image
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
                              <Input placeholder="United Arab Emirates" {...field} value={field.value || ""} />
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
                          <FormDescription>
                            Used for the website URL (automatically generated)
                          </FormDescription>
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
                Save Developer
              </Button>
            </div>
          </form>
        </Form>
      )}
    </DashLayout>
  );
}
