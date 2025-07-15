import { useState, useEffect } from "react"; // useEffect is needed for time countdown logic if added later, but currently not used in this specific page context. I'll keep it for consistency with the original PropertiesPage.
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CSVUpload } from "@/components/ui/csv-upload.jsx";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileUp, FileDown, AlertCircle, Trash2 } from "lucide-react";
import { ColumnDef, RowSelectionState } from "@tanstack/react-table"; // Import RowSelectionState
import { objectsToCSV, downloadCSV, formatDate } from "@/lib/utils";
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

// Define a type for SitemapEntry for better type safety, assuming it has an 'id'
interface SitemapEntry {
  id: number; // Assuming a unique ID for each sitemap entry
  url: string;
  title?: string;
  priority?: string;
  lastModified?: string; // Or Date if you parse it
  changeFrequency?: string;
}

export default function SitemapPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteSitemapEntryId, setDeleteSitemapEntryId] = useState<number | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedRowIds, setSelectedRowIds] = useState<RowSelectionState>({}); // State to hold selected row IDs

  // Fetch sitemap entries
  const { data: sitemapEntries = [], isLoading } = useQuery<SitemapEntry[]>({ // Type assertion for data
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

  // Toggle selection mode
  const toggleSelectionMode = (): void => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedRowIds({}); // Reset selected rows when toggling mode
  };

  // Handle export CSV
  const handleExportCSV = (): void => {
    // Determine which data to export based on selection mode
    const dataToExport = isSelectionMode
      ? sitemapEntries.filter(entry => selectedRowIds[entry.id]) // Filter by selected IDs
      : sitemapEntries; // Export all if not in selection mode

    if (isSelectionMode && dataToExport.length === 0) {
      toast({
        title: "No Rows Selected",
        description: "Please select at least one sitemap entry to export.",
        variant: "destructive",
      });
      return;
    }

    const filename = isSelectionMode ? "selected_sitemap-entries.csv" : "sitemap-entries.csv";
    const toastDescription = isSelectionMode
      ? `Successfully exported ${dataToExport.length} selected sitemap entries to CSV.`
      : `Successfully exported ${dataToExport.length} sitemap entries to CSV.`;

    const csv = objectsToCSV(dataToExport);
    downloadCSV(csv, filename);
    toast({
      title: "Export successful",
      description: toastDescription,
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

  // Define sitemap columns, including the select column
  const sitemapColumns: ColumnDef<SitemapEntry>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          disabled={!isSelectionMode} // Disable if not in selection mode
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          disabled={!isSelectionMode} // Disable if not in selection mode
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
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
          <Button
            variant="destructive"
            onClick={() => { /* Implement delete all sitemap entries if needed */ }}
            className="flex items-center gap-2"
            disabled={sitemapEntries.length === 0} // Disable if no entries to delete all
          >
            <Trash2 className="h-4 w-4" />
            Delete All (Not Implemented)
          </Button>
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
        deleteRow={(row: SitemapEntry) => handleDelete(row.id)} // Ensure type matches SitemapEntry
        editRow={(row: SitemapEntry) => navigate(`/sitemap/${row.id}`)} // Ensure type matches SitemapEntry
        // --- ADDED FOR ROW SELECTION ---
        rowSelection={selectedRowIds}
        setRowSelection={setSelectedRowIds}
        // ------------------------------
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
