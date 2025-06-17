import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout.jsx";
import { DataTable } from "@/components/ui/data-table.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { apiRequest, queryClient } from "@/lib/queryClient.js";
import { FileDown, Eye, Mail, Trash2 } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { formatDate, objectsToCSV, downloadCSV, truncateText } from "@/lib/utils.js";
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

export default function EnquiriesPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [deleteEnquiryId, setDeleteEnquiryId] = useState<number | null>(null);

  // Fetch enquiries
  const { data: enquiries = [], isLoading } = useQuery({
    queryKey: ['/api/enquiries'],
  });

  // Delete enquiry mutation
  const deleteEnquiryMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/enquiries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enquiries'] });
      toast({
        title: "Enquiry deleted",
        description: "The enquiry has been successfully deleted.",
      });
      setDeleteEnquiryId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete enquiry. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete enquiry:", error);
    }
  });

  // Mark enquiry as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PUT", `/api/enquiries/${id}/read`, {});
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/enquiries'] });
      toast({
        title: "Enquiry marked as read",
        description: "The enquiry has been marked as read.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark enquiry as read. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to mark enquiry as read:", error);
    }
  });

  const handleDelete = (id: number) => {
    setDeleteEnquiryId(id);
  };

  const confirmDelete = () => {
    if (deleteEnquiryId !== null) {
      deleteEnquiryMutation.mutate(deleteEnquiryId);
    }
  };

  const handleMarkAsRead = (id: number) => {
    markAsReadMutation.mutate(id);
  };

  const handleExportCSV = () => {
    const csv = objectsToCSV(enquiries as Record<string, any>[]);
    downloadCSV(csv, "enquiries.csv");
    toast({
      title: "Export successful",
      description: "Enquiries have been exported to CSV.",
    });
  };

  const enquiryColumns: ColumnDef<any>[] = [
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <div>
          {row.original.isRead ? (
            <Badge variant="outline">Read</Badge>
          ) : (
            <Badge variant="secondary">New</Badge>
          )}
        </div>
      ),
    },
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.name || "Anonymous"}</div>
      ),
    },
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      cell: ({ row }) => <div>{row.original.email}</div>,
    },
    {
      id: "phone",
      header: "Phone",
      accessorKey: "phone",
      cell: ({ row }) => <div>{row.original.phone || "—"}</div>,
    },
    {
      id: "subject",
      header: "Subject",
      accessorKey: "subject",
      cell: ({ row }) => <div>{row.original.subject || "General Enquiry"}</div>,
    },
    {
      id: "message",
      header: "Message",
      accessorKey: "message",
      cell: ({ row }) => (
        <div className="max-w-xs truncate" title={row.original.message}>
          {truncateText(row.original.message || "No message provided", 50)}
        </div>
      ),
    },
    {
      id: "propertyReference",
      header: "Property Ref",
      accessorKey: "propertyReference",
      cell: ({ row }) => <div>{row.original.propertyReference || "—"}</div>,
    },
    {
      id: "createdAt",
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ row }) => <div>{formatDate(row.original.createdAt) || "—"}</div>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/enquiries/${row.original.id}`)}>
            <Eye className="h-4 w-4" />
            <span className="sr-only">View</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleMarkAsRead(row.original.id)} disabled={row.original.isRead}>
            <Mail className="h-4 w-4" />
            <span className="sr-only">Mark as Read</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.original.id)}>
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      ),
    }
  ];

  return (
    <DashLayout
      title="Enquiries Management"
      description="Manage customer enquiries and messages"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <DataTable
        columns={enquiryColumns}
        data={enquiries as any[]}
        filterableColumns={[
          {
            id: "status",
            title: "Status",
            options: [
              { label: "New", value: "unread" },
              { label: "Read", value: "read" }
            ]
          }
        ]}
        searchableColumns={[
          {
            id: "email",
            title: "email"
          },
          {
            id: "name",
            title: "name"
          }
        ]}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteEnquiryId !== null} onOpenChange={(open) => !open && setDeleteEnquiryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this enquiry. This action cannot be undone.
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
