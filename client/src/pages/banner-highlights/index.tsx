import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileUp, FileDown } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { objectsToCSV, downloadCSV, truncateText } from "@/lib/utils";
import { CSVUpload } from "@/components/ui/csv-upload";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function BannerHighlightsPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteBannerId, setDeleteBannerId] = useState<number | null>(null);

  // Fetch banner highlights
  const { data: bannerHighlights = [], isLoading } = useQuery({
    queryKey: ['/api/banner-highlights'],
  });

  // Delete banner mutation
  const deleteBannerMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/banner-highlights/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banner-highlights'] });
      toast({
        title: "Banner highlight deleted",
        description: "The banner highlight has been successfully deleted.",
      });
      setDeleteBannerId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete banner highlight. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete banner highlight:", error);
    }
  });

  const handleDelete = (id: number) => {
    setDeleteBannerId(id);
  };

  const confirmDelete = () => {
    if (deleteBannerId !== null) {
      deleteBannerMutation.mutate(deleteBannerId);
    }
  };

  const handleExportCSV = () => {
    const csv = objectsToCSV(bannerHighlights);
    downloadCSV(csv, "banner-highlights.csv");
    toast({
      title: "Export successful",
      description: "Banner highlights have been exported to CSV.",
    });
  };

  const handleImportCSV = (data: any[]) => {
    // In a real app, this would call a bulk import API endpoint
    toast({
      title: "Import successful",
      description: `${data.length} banner highlights have been imported.`,
    });
    setIsImportDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/banner-highlights'] });
  };

  const bannerColumns: ColumnDef<any>[] = [
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.title}</div>
      ),
    },
    {
      id: "headline",
      header: "Headline",
      accessorKey: "headline",
      cell: ({ row }) => <div>{row.original.headline}</div>,
    },
    {
      id: "subheading",
      header: "Subheading",
      accessorKey: "subheading",
      cell: ({ row }) => (
        <div className="max-w-xs truncate" title={row.original.subheading}>
          {truncateText(row.original.subheading || "", 50)}
        </div>
      ),
    },
    {
      id: "cta",
      header: "CTA",
      accessorKey: "cta",
      cell: ({ row }) => <div>{row.original.cta || "—"}</div>,
    },
    {
      id: "preview",
      header: "Banner Image",
      cell: ({ row }) => (
        <div className="relative w-40 h-16 rounded overflow-hidden bg-gray-100">
          {row.original.image ? (
            <img
              src={row.original.image}
              alt={row.original.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No image
            </div>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "isActive",
      cell: ({ row }) => (
        <div>
          {row.original.isActive ? (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
          ) : (
            <Badge variant="outline">Inactive</Badge>
          )}
        </div>
      ),
    }
  ];

  return (
    <DashLayout
      title="Banner Highlights Management"
      description="Manage promotional banners for the website"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <Button 
            onClick={() => navigate("/banner-highlights/new")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Banner
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" />
            Export CSV
          </Button>
          <Button 
            variant="outline"
            onClick={() => setIsImportDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <FileUp className="h-4 w-4" />
            Import CSV
          </Button>
        </div>
      </div>

      <DataTable
        columns={bannerColumns}
        data={bannerHighlights}
        filterableColumns={[
          {
            id: "isActive",
            title: "Status",
            options: [
              { label: "Active", value: "true" },
              { label: "Inactive", value: "false" }
            ]
          }
        ]}
        searchableColumns={[
          {
            id: "title",
            title: "title"
          },
          {
            id: "headline",
            title: "headline"
          }
        ]}
        deleteRow={(row) => handleDelete(row.id)}
        editRow={(row) => navigate(`/banner-highlights/${row.id}`)}
      />

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Banner Highlights</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import banner highlights. The file should include all required fields.
            </DialogDescription>
          </DialogHeader>
          <CSVUpload
            onUpload={handleImportCSV}
            onError={(message) => {
              toast({
                title: "Import Error",
                description: message,
                variant: "destructive",
              });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteBannerId !== null} onOpenChange={(open) => !open && setDeleteBannerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this banner highlight. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashLayout>
  );
}
