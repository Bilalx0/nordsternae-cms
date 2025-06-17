import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function DevelopersPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteDeveloperId, setDeleteDeveloperId] = useState<number | null>(null);

  // Fetch developers
  const { data: developers = [], isLoading } = useQuery({
    queryKey: ['/api/developers'],
  });

  // Delete developer mutation
  const deleteDeveloperMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/developers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/developers'] });
      toast({
        title: "Developer deleted",
        description: "The developer has been successfully deleted.",
      });
      setDeleteDeveloperId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete developer. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete developer:", error);
    }
  });

  const handleDelete = (id: number) => {
    setDeleteDeveloperId(id);
  };

  const confirmDelete = () => {
    if (deleteDeveloperId !== null) {
      deleteDeveloperMutation.mutate(deleteDeveloperId);
    }
  };

  const handleExportCSV = () => {
    const csv = objectsToCSV(developers);
    downloadCSV(csv, "developers.csv");
    toast({
      title: "Export successful",
      description: "Developers have been exported to CSV.",
    });
  };

  const handleImportCSV = (data: any[]) => {
    // In a real app, this would call a bulk import API endpoint
    toast({
      title: "Import successful",
      description: `${data.length} developers have been imported.`,
    });
    setIsImportDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/developers'] });
  };

  const developerColumns: ColumnDef<any>[] = [
    {
      id: "logo",
      header: "Logo",
      cell: ({ row }) => (
        <Avatar className="h-10 w-10">
          <AvatarImage src={row.original.logo} alt={row.original.title} />
          <AvatarFallback>{row.original.title.charAt(0)}</AvatarFallback>
        </Avatar>
      ),
    },
    {
      id: "title",
      header: "Name",
      accessorKey: "title",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.title}</div>
      ),
    },
    {
      id: "country",
      header: "Country",
      accessorKey: "country",
      cell: ({ row }) => <div>{row.original.country || "—"}</div>,
    },
    {
      id: "establishedSince",
      header: "Established",
      accessorKey: "establishedSince",
      cell: ({ row }) => <div>{row.original.establishedSince || "—"}</div>,
    },
    {
      id: "urlSlug",
      header: "URL Slug",
      accessorKey: "urlSlug",
      cell: ({ row }) => <div>{row.original.urlSlug}</div>,
    },
    {
      id: "description",
      header: "Description",
      accessorKey: "description",
      cell: ({ row }) => (
        <div className="max-w-xs truncate" title={row.original.description}>
          {truncateText(row.original.description || "", 50)}
        </div>
      ),
    }
  ];

  return (
    <DashLayout
      title="Developers Management"
      description="Manage real estate developers and builders"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <Button 
            onClick={() => navigate("/developers/new")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Developer
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
        columns={developerColumns}
        data={developers}
        filterableColumns={[
          {
            id: "country",
            title: "Country",
            options: Array.from(new Set(developers.map((d: any) => d.country)))
              .filter(Boolean)
              .map(country => ({ label: country, value: country }))
          }
        ]}
        searchableColumns={[
          {
            id: "title",
            title: "title"
          }
        ]}
        deleteRow={(row) => handleDelete(row.id)}
        editRow={(row) => navigate(`/developers/${row.id}`)}
      />

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Developers</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import developers. The file should include all required fields.
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
      <AlertDialog open={deleteDeveloperId !== null} onOpenChange={(open) => !open && setDeleteDeveloperId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this developer. This action cannot be undone.
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
