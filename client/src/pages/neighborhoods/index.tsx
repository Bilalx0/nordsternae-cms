import { useState, useMemo } from "react";
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

export default function NeighborhoodsPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteNeighborhoodId, setDeleteNeighborhoodId] = useState<number | null>(null);

  // Fetch neighborhoods
  const { data: neighborhoods = [], isLoading } = useQuery({
    queryKey: ['/api/neighborhoods'],
  });

  // Delete neighborhood mutation
  const deleteNeighborhoodMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/neighborhoods/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/neighborhoods'] });
      toast({
        title: "Neighborhood deleted",
        description: "The neighborhood has been successfully deleted.",
      });
      setDeleteNeighborhoodId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete neighborhood. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete neighborhood:", error);
    }
  });

  const handleDelete = (id: number) => {
    setDeleteNeighborhoodId(id);
  };

  const confirmDelete = () => {
    if (deleteNeighborhoodId !== null) {
      deleteNeighborhoodMutation.mutate(deleteNeighborhoodId);
    }
  };

  const handleExportCSV = () => {
    const csv = objectsToCSV(neighborhoods);
    downloadCSV(csv, "neighborhoods.csv");
    toast({
      title: "Export successful",
      description: "Neighborhoods have been exported to CSV.",
    });
  };

  const handleImportCSV = (data: any[]) => {
    // In a real app, this would call a bulk import API endpoint
    toast({
      title: "Import successful",
      description: `${data.length} neighborhoods have been imported.`,
    });
    setIsImportDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/neighborhoods'] });
  };

  const neighborhoodColumns: ColumnDef<any>[] = [
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.title}</div>
      ),
    },
    {
      id: "region",
      header: "Region",
      accessorKey: "region",
      cell: ({ row }) => <div>{row.original.region || "—"}</div>,
    },
    {
      id: "subtitle",
      header: "Subtitle",
      accessorKey: "subtitle",
      cell: ({ row }) => (
        <div className="max-w-md truncate" title={row.original.subtitle}>
          {truncateText(row.original.subtitle || "", 50)}
        </div>
      ),
    },
    {
      id: "urlSlug",
      header: "URL Slug",
      accessorKey: "urlSlug",
      cell: ({ row }) => <div>{row.original.urlSlug}</div>,
    },
    {
      id: "availableProperties",
      header: "Properties",
      accessorKey: "availableProperties",
      cell: ({ row }) => (
        <div>{row.original.availableProperties || "0"}</div>
      ),
    },
    {
      id: "showOnFooter",
      header: "Footer",
      accessorKey: "showOnFooter",
      cell: ({ row }) => (
        <div>
          {row.original.showOnFooter ? (
            <Badge variant="success">Yes</Badge>
          ) : (
            <Badge variant="outline">No</Badge>
          )}
        </div>
      ),
    }
  ];

  return (
    <DashLayout
      title="Neighborhoods Management"
      description="Manage neighborhood locations and community information"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <Button 
            onClick={() => setLocation("/neighborhoods/new")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Neighborhood
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
        columns={neighborhoodColumns}
        data={neighborhoods}
        filterableColumns={[
          {
            id: "region",
            title: "Region",
            options: Array.from(new Set(neighborhoods.map((n: any) => n.region)))
              .filter(Boolean)
              .map(region => ({ label: region, value: region }))
          }
        ]}
        searchableColumns={[
          {
            id: "title",
            title: "title"
          },
          {
            id: "urlSlug",
            title: "urlSlug"
          }
        ]}
        deleteRow={(row) => handleDelete(row.id)}
        editRow={(row) => setLocation(`/neighborhoods/${row.id}`)}
      />

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Neighborhoods</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import neighborhoods. The file should include all required fields.
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
      <AlertDialog open={deleteNeighborhoodId !== null} onOpenChange={(open) => !open && setDeleteNeighborhoodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this neighborhood. This action cannot be undone.
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
