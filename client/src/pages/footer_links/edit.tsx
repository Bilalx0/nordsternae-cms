// client/src/pages/footer_links/edit.tsx

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage
} from "@/components/ui/form";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const schema = z.object({
  url: z.string().url("Must be a valid URL"),
  heading: z.string().min(1, "Heading is required"),
  priority: z.number().min(1, "Priority must be at least 1"),
  section: z.enum(["Search Properties In", "Neighbourhood Guides", "Explore", "Company"]),
});

export default function FooterLinkEditPage() {
  const [match, params] = useRoute("/footer_links/:id");
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const isNew = !match || params?.id === "new";
  const id = isNew ? null : parseInt(params?.id || "");

  const { data: linkData } = useQuery({
    queryKey: ["/api/footer-links", id],
    queryFn: () => apiRequest("GET", `/api/footer-links/${id}`),
    enabled: !!id,
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      url: "",
      heading: "",
      priority: 1,
      section: "Search Properties In",
    },
  });

  useEffect(() => {
    if (linkData && !isNew) {
      form.reset(linkData);
    }
  }, [linkData, form, isNew]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isNew) return apiRequest("POST", "/api/footer-links", data);
      return apiRequest("PUT", `/api/footer-links/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: isNew ? "Created" : "Updated", description: "Footer link saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/footer-links"] });
      navigate("/footer_links");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save link", variant: "destructive" });
    }
  });

  return (
    <DashLayout title={isNew ? "Add Footer Link" : "Edit Footer Link"}>
      <Button onClick={() => navigate("/footer_links")} className="mb-6" variant="outline">
        <ArrowLeft className="mr-2 w-4 h-4" /> Back
      </Button>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(mutation.mutate)} className="space-y-6">
          <FormField
            control={form.control}
            name="heading"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Heading</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL Path</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                </FormControl>
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["Search Properties In", "Neighbourhood Guides", "Explore", "Company"].map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" className="flex items-center gap-2">
              <Save className="w-4 h-4" /> Save
            </Button>
          </div>
        </form>
      </Form>
    </DashLayout>
  );
}
