import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout.jsx";
import { DataTable } from "@/components/ui/data-table.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { apiRequest, queryClient } from "@/lib/queryClient.js";
import { Plus, FileUp, FileDown, AlertCircle } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency, objectsToCSV, downloadCSV } from "@/lib/utils.js";
import { CSVUpload } from "@/components/ui/csv-upload.jsx";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog.jsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle
} from "@/components/ui/alert-dialog.jsx";
import { useToast } from "@/hooks/use-toast.js";

// Debug imports
console.log('useQuery:', useQuery);
console.log('useMutation:', useMutation);
console.log('queryClient:', queryClient);
console.log('apiRequest:', apiRequest);

export default function DevelopmentsPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteDevelopmentId, setDeleteDevelopmentId] = useState<number | null>(null);

  // Fetch developments
  const { data: developments = [], isLoading } = useQuery({
    queryKey: ['/api/developments'],
  });

  // Debug query result
  console.log('Developments:', developments);

  // Delete development mutation
  const deleteDevelopmentMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log('Deleting development with ID:', id);
      await apiRequest("DELETE", `/api/developments/${id}`);
    },
    onSuccess: () => {
      console.log('Delete mutation succeeded');
      queryClient.invalidateQueries({ queryKey: ['/api/developments'] });
      toast({
        title: "Development deleted",
        description: "The development has been successfully deleted.",
      });
      setDeleteDevelopmentId(null);
    },
    onError: (error) => {
      console.log('Delete mutation failed:', error);
      toast({
        title: "Error",
        description: "Failed to delete development. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete development:", error);
    }
  });

  const handleDelete = (id: number) => {
    setDeleteDevelopmentId(id);
  };

  const confirmDelete = () => {
    if (deleteDevelopmentId !== null) {
      deleteDevelopmentMutation.mutate(deleteDevelopmentId);
    }
  };

  const handleExportCSV = () => {
    const csv = objectsToCSV(developments as Record<string, any>[]);
    downloadCSV(csv, "developments.csv");
    toast({
      title: "Export successful",
      description: "Developments have been exported to CSV.",
    });
  };

  const handleImportCSV = (data: any[]) => {
    console.log('Imported CSV data:', data);
    toast({
      title: "Import successful",
      description: `${data.length} developments have been imported.`,
    });
    setIsImportDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/developments'] });
  };

  const developmentColumns: ColumnDef<any>[] = [
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.title}</div>
      ),
    },
    {
      id: "area",
      header: "Area",
      accessorKey: "area",
      cell: ({ row }) => <div>{row.original.area || "—"}</div>,
    },
    {
      id: "propertyType",
      header: "Property Type",
      accessorKey: "propertyType",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.propertyType || "—"}
        </Badge>
      ),
    },
    {
      id: "price",
      header: "Starting Price",
      accessorKey: "price",
      cell: ({ row }) => (
        <div>
          {row.original.price ? formatCurrency(row.original.price, row.original.currency || "AED") : "—"}
        </div>
      ),
    },
    {
      id: "units",
      header: "Units",
      accessorKey: "totalUnits",
      cell: ({ row }) => <div>{row.original.totalUnits || "—"}</div>,
    },
    {
      id: "bedrooms",
      header: "Bedrooms",
      cell: ({ row }) => (
        <div>
          {row.original.minBedrooms && row.original.maxBedrooms
            ? `${row.original.minBedrooms} - ${row.original.maxBedrooms}`
            : row.original.minBedrooms || row.original.maxBedrooms || "—"}
        </div>
      ),
    },
    {
      id: "featured",
      header: "Featured",
      accessorKey: "featureOnHomepage",
      cell: ({ row }) => (
        <div>
          {row.original.featureOnHomepage ? (
            <Badge variant="default">Yes</Badge>
          ) : (
            <Badge variant="outline">No</Badge>
          )}
        </div>
      ),
    }
  ];

  return (
    <DashLayout
      title="Developments Management"
      description="Manage real estate development projects"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <Button 
            onClick={() => navigate("/developments/new")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Development
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
        columns={developmentColumns}
        data={developments as any[]}
        filterableColumns={[
          {
            id: "area",
            title: "Area",
            options: Array.from(new Set((developments as any[]).map((d) => d.area)))
              .filter((area): area is string => typeof area === 'string')
              .filter(Boolean)
              .map(area => ({ label: area, value: area }))
          }
        ]}
        searchableColumns={[
          {
            id: "title",
            title: "title"
          }
        ]}
        deleteRow={(row) => handleDelete(row.id)}
        editRow={(row) => navigate(`/developments/${row.id}`)}
      />

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Developments</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import developments. The file should include all required fields.
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
      <AlertDialog open={deleteDevelopmentId !== null} onOpenChange={(open) => !open && setDeleteDevelopmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this development. This action cannot be undone.
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
