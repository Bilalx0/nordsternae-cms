import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileUp, FileDown, AlertCircle, Trash2, RefreshCw, Download, Clock } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency, objectsToCSV, downloadCSV } from "@/lib/utils";
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

// Define types for better TypeScript support
interface Property {
  id: number;
  reference: string;
  title: string;
  propertyType: string;
  community: string;
  region: string;
  price: number;
  currency: string;
  propertyStatus: string;
  agent?: {
    id: string;
    name: string;
  }[] | {
    id: string;
    name: string;
  };
}

interface ImportResult {
  reference: string;
  action: 'created' | 'updated';
  id: number;
}

interface ImportResponse {
  message: string;
  total: number;
  processed: number;
  errors: number;
  results: ImportResult[];
  errorDetails: any[];
}

export default function PropertiesPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState<boolean>(false);
  const [deletePropertyId, setDeletePropertyId] = useState<number | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState<boolean>(false);
  const [showDeduplicateDialog, setShowDeduplicateDialog] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isDeduplicating, setIsDeduplicating] = useState<boolean>(false);
  const [lastImportTime, setLastImportTime] = useState<Date | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Record<string, boolean>>({});

  const [timeRemaining, setTimeRemaining] = useState<number>(15 * 60);

  // Fetch properties
  const { data: rawProperties = [], isLoading, refetch } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  // Delete property mutation with enhanced feedback
  const deletePropertyMutation = useMutation<any, Error, number>({
    mutationFn: async (id: number) => {
      const result = await apiRequest("DELETE", `/api/properties/${id}`);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
    },
    onError: (error: Error, id: number) => {
      toast({
        title: "Deletion Failed",
        description: `Failed to delete property with ID ${id}: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
      console.error(`Failed to delete property with ID ${id}:`, error);
    },
  });

  // Auto-import mutation with enhanced error handling
  const autoImportMutation = useMutation<ImportResponse, Error>({
    mutationFn: async (): Promise<ImportResponse> => {
      setIsImporting(true);
      const result = await apiRequest("GET", "/api/import-properties");
      return result as ImportResponse;
    },
    onSuccess: (result: ImportResponse) => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      setLastImportTime(new Date());
      setTimeRemaining(15 * 60);

      const { processed = 0,

 errors = 0, results = [], total = 0 } = result;
      const created = results.filter((r: ImportResult) => r.action === 'created').length;
      const updated = results.filter((r: ImportResult) => r.action === 'updated').length;

      if (total === 0) {
        toast({
          title: "No Data Found",
          description: "The XML feed contains no properties.",
          variant: "default",
        });
      } else if (processed === 0 && errors === 0) {
        toast({
          title: "No Changes Detected",
          description: "All IDs are present; no new properties in XML.",
          variant: "default",
        });
      } else {
        toast({
          title: "Auto-import completed",
          description: `${created} new properties created, ${updated} updated. ${errors > 0 ? `${errors} errors occurred.` : ''}`,
        });
      }
    },
    onError: (error: Error) => {
      console.error("Auto-import failed:", error);
      toast({
        title: "Import Failed",
        description: `Failed to import properties: ${error.message || 'Server error. Please try again later.'}`,
        variant: "destructive",
      });
      setTimeRemaining(15 * 60);
    },
    onSettled: () => {
      setIsImporting(false);
    },
  });

  // Manual import function
  const handleManualImport = async (): Promise<void> => {
    if (!isImporting) {
      autoImportMutation.mutate();
    }
  };

  // Simple countdown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (!isImporting && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            autoImportMutation.mutate();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isImporting, timeRemaining, autoImportMutation]);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Handle refresh
  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast({
      title: "Data refreshed",
      description: "The properties list has been refreshed successfully.",
    });
  };

  // Delete all properties mutation with enhanced feedback
  const deleteAllPropertiesMutation = useMutation<any[], Error>({
    mutationFn: async (): Promise<any[]> => {
      const propertyIds = rawProperties.map(property => property.id);
      const deletePromises = propertyIds.map(id => apiRequest("DELETE", `/api/properties/${id}`));
      const results = await Promise.allSettled(deletePromises);
      const failures = results.filter(result => result.status === 'rejected');

      if (failures.length > 0) {
        throw new Error(`Failed to delete ${failures.length} out of ${propertyIds.length} properties`);
      }

      return results.map(result => result.status === 'fulfilled' ? result.value : null);
    },
    onSuccess: (results: any[]) => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({
        title: "All Properties Deleted",
        description: `Successfully deleted ${results.length} properties.`,
      });
      setShowDeleteAllDialog(false);
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({
        title: "Deletion Failed",
        description: error.message || "Some properties could not be deleted. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete all properties:", error);
    },
  });

  // Deduplicate properties
  const handleDeduplicate = (): void => {
    setShowDeduplicateDialog(true);
  };

  const confirmDeduplicate = async (): Promise<void> => {
    setIsDeduplicating(true);
    try {
      // Group properties by reference
      const groupedByReference = rawProperties.reduce((acc, property) => {
        if (!acc[property.reference]) {
          acc[property.reference] = [];
        }
        acc[property.reference].push(property);
        return acc;
      }, {} as Record<string, Property[]>);

      // Identify duplicates to delete (keep the one with highest ID)
      const propertiesToDelete: number[] = [];
      Object.values(groupedByReference).forEach(group => {
        if (group.length > 1) {
          // Sort by ID descending to keep the highest ID
          const sortedGroup = group.sort((a, b) => b.id - a.id);
          // Add all but the first (highest ID) to delete list
          propertiesToDelete.push(...sortedGroup.slice(1).map(p => p.id));
        }
      });

      // Delete duplicates
      const deletePromises = propertiesToDelete.map(id => 
        deletePropertyMutation.mutateAsync(id)
      );
      const results = await Promise.allSettled(deletePromises);
      const failures = results.filter(result => result.status === 'rejected');

      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });

      if (failures.length > 0) {
        toast({
          title: "Deduplication Partially Failed",
          description: `Failed to delete ${failures.length} out of ${propertiesToDelete.length} duplicate properties.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Deduplication Completed",
          description: `Successfully deleted ${propertiesToDelete.length} duplicate properties.`,
        });
      }
    } catch (error) {
      toast({
        title: "Deduplication Failed",
        description: `An error occurred during deduplication: ${(error as Error).message || 'Please try again.'}`,
        variant: "destructive",
      });
      console.error("Deduplication error:", error);
    } finally {
      setIsDeduplicating(false);
      setShowDeduplicateDialog(false);
    }
  };

  const handleDelete = (id: number): void => {
    setDeletePropertyId(id);
  };

  const confirmDelete = (): void => {
    if (deletePropertyId !== null) {
      deletePropertyMutation.mutate(deletePropertyId, {
        onSuccess: () => {
          toast({
            title: "Property Deleted",
            description: "The property has been successfully deleted.",
          });
          setDeletePropertyId(null);
        },
      });
    }
  };

  const handleDeleteAll = (): void => {
    setShowDeleteAllDialog(true);
  };

  const confirmDeleteAll = (): void => {
    deleteAllPropertiesMutation.mutate();
  };

  // Toggle selection mode
  const toggleSelectionMode = (): void => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedRowIds({});
  };

  // Handle export CSV
  const handleExportCSV = (): void => {
    // Deduplicate properties for export
    const deduplicatedProperties = Array.isArray(rawProperties)
      ? [...rawProperties]
          .sort((a, b) => b.id - a.id)
          .filter((property, index, self) => 
            index === self.findIndex(p => p.reference === property.reference)
          )
      : [];

    const selectedData = deduplicatedProperties.filter(property => selectedRowIds[property.id]);

    if (isSelectionMode) {
      if (selectedData.length === 0) {
        toast({
          title: "No Rows Selected",
          description: "Please select at least one property to export.",
          variant: "destructive",
        });
        return;
      }
      const csv = objectsToCSV(selectedData as Record<string, any>[]);
      downloadCSV(csv, "selected_properties.csv");
      toast({
        title: "Export Successful",
        description: `Successfully exported ${selectedData.length} selected properties to CSV.`,
      });
    } else {
      const csv = objectsToCSV(deduplicatedProperties as Record<string, any>[]);
      downloadCSV(csv, "properties.csv");
      toast({
        title: "Export Successful",
        description: `Successfully exported ${deduplicatedProperties.length} properties to CSV.`,
      });
    }
  };

  const handleImportCSV = (data: any[]): void => {
    toast({
      title: "Import Successful",
      description: `${data.length} properties have been imported.`,
    });
    setIsImportDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
  };

  const propertyColumns: ColumnDef<Property>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          disabled={!isSelectionMode}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          disabled={!isSelectionMode}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
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
        let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";

        if (status === "Off Plan") badgeVariant = "secondary";
        else if (status === "Ready") badgeVariant = "default";
        else if (status === "Sold") badgeVariant = "destructive";

        return (
          <Badge variant={badgeVariant}>
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

  // Deduplicate properties for display
  const properties = Array.isArray(rawProperties)
    ? [...rawProperties]
        .sort((a, b) => b.id - a.id)
        .filter((property, index, self) => 
          index === self.findIndex(p => p.reference === property.reference)
        )
    : [];

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
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Auto-Import Status</span>
          </div>
          <div className="flex items-center gap-4">
            {lastImportTime && (
              <span className="text-xs text-blue-600">
                Last import: {lastImportTime.toLocaleTimeString()}
              </span>
            )}

            {isImporting ? (
              <div className="flex items-center gap-1 text-blue-600">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="text-xs font-medium">Importing...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-600">Next import in:</span>
                <span className="text-sm font-mono font-bold text-blue-800 bg-blue-100 px-2 py-1 rounded">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="w-full bg-blue-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${((15 * 60 - timeRemaining) / (15 * 60)) * 100}%`
              }}
            ></div>
          </div>
        </div>
      </div>

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
            onClick={handleManualImport}
            className="flex items-center gap-2"
            disabled={isImporting}
          >
            <Download className={`h-4 w-4 ${isImporting ? 'animate-spin' : ''}`} />
            {isImporting ? "Importing..." : "Import Now"}
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
          {/* <Button
            variant="destructive"
            onClick={handleDeduplicate}
            className="flex items-center gap-2"
            disabled={!Array.isArray(properties) || properties.length === 0 || isDeduplicating}
          >
            <Trash2 className="h-4 w-4" />
            {isDeduplicating ? "Deduplicating..." : "Remove Duplicates"}
          </Button> */}
          <Button
            variant={isSelectionMode ? "default" : "outline"}
            onClick={toggleSelectionMode}
            className="flex items-center gap-2"
          >
            {isSelectionMode ? "Cancel Selection" : "Select Rows"}
          </Button>
        </div>
      </div>

      <DataTable
        columns={propertyColumns}
        data={properties}
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
        deleteRow={(row: Property) => handleDelete(row.id)}
        editRow={(row: Property) => setLocation(`/properties/${row.id}`)}
        rowSelection={selectedRowIds}
        setRowSelection={setSelectedRowIds}
      />

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
            onError={(message: string) => {
              toast({
                title: "Import Error",
                description: message,
                variant: "destructive",
              });
            }}
          />
        </DialogContent>
      </Dialog>

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

      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center Cosmetic

gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Delete All Properties?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>ALL {properties.length} properties</strong> from your database.
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

      <AlertDialog open={showDeduplicateDialog} onOpenChange={setShowDeduplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Remove Duplicate Properties?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all duplicate properties based on reference numbers, keeping only the most recent entry for each reference.
              This action cannot be undone.
              <br /><br />
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeduplicate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeduplicating}
            >
              {isDeduplicating ? "Deduplicating..." : "Remove Duplicates"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashLayout>
  );
}