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
import { objectsToCSV, downloadCSV, formatDate } from "@/lib/utils";
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

export default function SitemapPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteSitemapEntryId, setDeleteSitemapEntryId] = useState<number | null>(null);

  // Fetch sitemap entries
  const { data: sitemapEntries = [], isLoading } = useQuery({
    queryKey: ['/api/sitemap'],
  });

  // Delete sitemap entry mutation
  const deleteSitemapEntryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sitemap/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sitemap'] });
      toast({
        title: "Sitemap entry deleted",
        description: "The sitemap entry has been successfully deleted.",
      });
      setDeleteSitemapEntryId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete sitemap entry. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete sitemap entry:", error);
    }
  });

  const handleDelete = (id: number) => {
    setDeleteSitemapEntryId(id);
  };

  const confirmDelete = () => {
    if (deleteSitemapEntryId !== null) {
      deleteSitemapEntryMutation.mutate(deleteSitemapEntryId);
    }
  };

  const handleExportCSV = () => {
    const csv = objectsToCSV(sitemapEntries);
    downloadCSV(csv, "sitemap-entries.csv");
    toast({
      title: "Export successful",
      description: "Sitemap entries have been exported to CSV.",
    });
  };

  const handleImportCSV = (data: any[]) => {
    // In a real app, this would call a bulk import API endpoint
    toast({
      title: "Import successful",
      description: `${data.length} sitemap entries have been imported.`,
    });
    setIsImportDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/sitemap'] });
  };

  const sitemapColumns: ColumnDef<any>[] = [
    {
      id: "url",
      header: "URL",
      accessorKey: "url",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.url}</div>
      ),
    },
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      cell: ({ row }) => <div>{row.original.title || "—"}</div>,
    },
    {
      id: "priority",
      header: "Priority",
      accessorKey: "priority",
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.priority || "0.5"}
        </Badge>
      ),
    },
    {
      id: "lastModified",
      header: "Last Modified",
      accessorKey: "lastModified",
      cell: ({ row }) => (
        <div>
          {row.original.lastModified ? formatDate(new Date(row.original.lastModified)) : "—"}
        </div>
      ),
    },
    {
      id: "changeFrequency",
      header: "Change Frequency",
      accessorKey: "changeFrequency",
      cell: ({ row }) => <div>{row.original.changeFrequency || "monthly"}</div>,
    }
  ];

  return (
    <DashLayout
      title="Sitemap Management"
      description="Manage your website's sitemap entries for SEO"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <Button 
            onClick={() => navigate("/sitemap/new")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Sitemap Entry
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
        columns={sitemapColumns}
        data={sitemapEntries}
        searchableColumns={[
          {
            id: "url",
            title: "url"
          },
          {
            id: "title",
            title: "title"
          }
        ]}
        deleteRow={(row) => handleDelete(row.id)}
        editRow={(row) => navigate(`/sitemap/${row.id}`)}
      />

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Sitemap Entries</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import sitemap entries. The file should include all required fields.
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
      <AlertDialog open={deleteSitemapEntryId !== null} onOpenChange={(open) => !open && setDeleteSitemapEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this sitemap entry. This action cannot be undone.
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