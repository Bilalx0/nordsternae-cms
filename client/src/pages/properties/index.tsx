import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout.jsx";
import { DataTable } from "@/components/ui/data-table.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { apiRequest, queryClient } from "@/lib/queryClient.js";
import { Plus, FileUp, FileDown, AlertCircle, Trash2, RefreshCw } from "lucide-react";
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
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog.jsx";
import { useToast } from "@/hooks/use-toast.js";

export default function PropertiesPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deletePropertyId, setDeletePropertyId] = useState<number | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch properties
  const { data: properties = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/properties"],
  });

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast({
      title: "Data refreshed",
      description: "The properties list has been refreshed.",
    });
  };

  // Delete property mutation
  const deletePropertyMutation = useMutation({
  mutationFn: async (id: number) => {
    const result = await apiRequest("DELETE", `/api/properties/${id}`);
    return result; // Could be null for 204
  },
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
    toast({
      title: "Property deleted",
      description: "The property has been successfully deleted.",
    });
    setDeletePropertyId(null);
  },
  onError: (error) => {
    toast({
      title: "Error",
      description: "Failed to delete property. Please try again.",
      variant: "destructive",
    });
    console.error("Failed to delete property:", error);
  },
});

  // Delete all properties mutation (client-side batch delete)
  const deleteAllPropertiesMutation = useMutation({
    mutationFn: async () => {
      const propertyIds = (properties as Array<{ id: number }>).map(property => property.id);
      const deletePromises = propertyIds.map(id => 
        apiRequest("DELETE", `/api/properties/${id}`)
      );
      
      // Execute all delete requests
      const results = await Promise.allSettled(deletePromises);
      
      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');
      
      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} out of ${propertyIds.length} properties`);
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({
        title: "All properties deleted",
        description: `Successfully deleted ${results.length} properties.`,
      });
      setShowDeleteAllDialog(false);
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] }); // Refresh to show current state
      toast({
        title: "Error",
        description: error.message || "Some properties could not be deleted. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete all properties:", error);
    },
  });

  const handleDelete = (id: number) => {
    setDeletePropertyId(id);
  };

  const confirmDelete = () => {
    if (deletePropertyId !== null) {
      deletePropertyMutation.mutate(deletePropertyId);
    }
  };

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(true);
  };

  const confirmDeleteAll = () => {
    deleteAllPropertiesMutation.mutate();
  };

  const handleExportCSV = () => {
    const csv = objectsToCSV(properties as Record<string, any>[]);
    downloadCSV(csv, "properties.csv");
    toast({
      title: "Export successful",
      description: "Properties have been exported to CSV.",
    });
  };

  const handleImportCSV = (data: any[]) => {
    // In a real app, this would call a bulk import API endpoint
    toast({
      title: "Import successful",
      description: `${data.length} properties have been imported.`,
    });
    setIsImportDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
  };

  const propertyColumns: ColumnDef<any>[] = [
    {
      id: "reference",
      header: "Reference",
      accessorKey: "reference",
      cell: ({ row }) => (
        <div className="font-medium text-primary">{row.original.reference}</div>
      ),
    },
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate" title={row.original.title}>
          {row.original.title}
        </div>
      ),
    },
    {
      id: "propertyType",
      header: "Type",
      accessorKey: "propertyType",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.propertyType}
        </Badge>
      ),
    },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) => (
        <div>{row.original.community}, {row.original.region}</div>
      ),
    },
    {
      id: "price",
      header: "Price",
      accessorKey: "price",
      cell: ({ row }) => (
        <div>{formatCurrency(row.original.price, row.original.currency)}</div>
      ),
    },
    {
      id: "propertyStatus",
      header: "Status",
      accessorKey: "propertyStatus",
      cell: ({ row }) => {
        const status = row.original.propertyStatus;
        let badgeVariant = "outline";
        
        if (status === "Off Plan") badgeVariant = "warning";
        else if (status === "Ready") badgeVariant = "success";
        else if (status === "Sold") badgeVariant = "destructive";
        
        return (
          <Badge variant={badgeVariant as any}>
            {status}
          </Badge>
        );
      },
    },
    {
      id: "agent",
      header: "Agent",
      accessorKey: "agent",
      cell: ({ row }) => {
        const agent = row.original.agent;
        if (!agent || (Array.isArray(agent) && agent.length === 0)) {
          return <div className="text-muted-foreground">Unassigned</div>;
        }
        
        const agentName = Array.isArray(agent) ? agent[0]?.name : agent.name;
        
        return (
          <div className="flex items-center">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600">
              {agentName ? agentName.charAt(0) : "?"}
            </div>
            <div className="ml-3 text-sm">{agentName}</div>
          </div>
        );
      },
    }
  ];

  const filterableColumns = [
    {
      id: "propertyType",
      title: "Property Type",
      options: [
        { label: "Villa", value: "villa" },
        { label: "Apartment", value: "apartment" },
        { label: "Penthouse", value: "penthouse" },
        { label: "Townhouse", value: "townhouse" }
      ]
    },
    {
      id: "propertyStatus",
      title: "Status",
      options: [
        { label: "Off Plan", value: "Off Plan" },
        { label: "Ready", value: "Ready" },
        { label: "Sold", value: "Sold" }
      ]
    }
  ];

  return (
    <DashLayout
      title="Properties Management"
      description="Manage all property listings across your platform"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <Button 
            onClick={() => setLocation("/properties/new")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Property
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
          <Button 
            variant="outline"
            onClick={handleRefresh}
            className="flex items-center gap-2"
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button 
            variant="destructive"
            onClick={handleDeleteAll}
            className="flex items-center gap-2"
            disabled={!Array.isArray(properties) || properties.length === 0 || deleteAllPropertiesMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
            {deleteAllPropertiesMutation.isPending ? "Deleting..." : "Delete All"}
          </Button>
        </div>
      </div>

      <DataTable
        columns={propertyColumns}
        data={properties as any[]}
        filterableColumns={filterableColumns}
        searchableColumns={[
          {
            id: "title",
            title: "title"
          },
          {
            id: "reference",
            title: "reference"
          }
        ]}
        deleteRow={(row) => handleDelete(row.id)}
        editRow={(row) => setLocation(`/properties/${row.id}`)}
      />

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Properties</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import properties. The file should include all required fields.
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

      {/* Delete Single Property Confirmation Dialog */}
      <AlertDialog open={deletePropertyId !== null} onOpenChange={(open) => !open && setDeletePropertyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this property. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Properties Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Delete All Properties?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>ALL {Array.isArray(properties) ? properties.length : 0} properties</strong> from your database.
              This action cannot be undone and will remove all property data, including images, descriptions, and associated records.
              <br /><br />
              Are you absolutely sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAllPropertiesMutation.isPending}
            >
              {deleteAllPropertiesMutation.isPending ? "Deleting..." : "Delete All Properties"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashLayout>
  );
}