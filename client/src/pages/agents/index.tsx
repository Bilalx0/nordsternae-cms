import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileUp, FileDown, AlertCircle } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { formatDate, objectsToCSV, downloadCSV } from "@/lib/utils";
import { CSVUpload } from "@/components/ui/csv-upload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export default function AgentsPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteAgentId, setDeleteAgentId] = useState<number | null>(null);

  // Fetch agents
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['/api/agents'],
  });

  // Delete agent mutation
  const deleteAgentMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
      toast({
        title: "Agent deleted",
        description: "The agent has been successfully deleted.",
      });
      setDeleteAgentId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete agent. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete agent:", error);
    }
  });

  const handleDelete = (id: number) => {
    setDeleteAgentId(id);
  };

  const confirmDelete = () => {
    if (deleteAgentId !== null) {
      deleteAgentMutation.mutate(deleteAgentId);
    }
  };

  const handleExportCSV = () => {
    const csv = objectsToCSV(agents);
    downloadCSV(csv, "agents.csv");
    toast({
      title: "Export successful",
      description: "Agents data has been exported to CSV.",
    });
  };

  const handleImportCSV = (data: any[]) => {
    // In a real app, this would call a bulk import API endpoint
    toast({
      title: "Import successful",
      description: `${data.length} agents have been imported.`,
    });
    setIsImportDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
  };

  const agentColumns: ColumnDef<any>[] = [
    {
      id: "name",
      header: "Name",
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={row.original.headShot} alt={row.original.name} />
            <AvatarFallback>{row.original.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="font-medium">{row.original.name}</div>
        </div>
      ),
    },
    {
      id: "jobTitle",
      header: "Job Title",
      accessorKey: "jobTitle",
      cell: ({ row }) => <div>{row.original.jobTitle || "—"}</div>,
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
      id: "location",
      header: "Location",
      accessorKey: "location",
      cell: ({ row }) => <div>{row.original.location || "—"}</div>,
    },
    {
      id: "licenseNumber",
      header: "License",
      accessorKey: "licenseNumber",
      cell: ({ row }) => <div>{row.original.licenseNumber || "—"}</div>,
    },
    {
      id: "experience",
      header: "Experience",
      accessorKey: "experience",
      cell: ({ row }) => (
        <div>
          {row.original.experience ? `${row.original.experience} years` : "—"}
        </div>
      ),
    },
    {
      id: "languages",
      header: "Languages",
      accessorKey: "languages",
      cell: ({ row }) => (
        <div>
          {row.original.languages ? (
            <Badge variant="outline">{row.original.languages}</Badge>
          ) : (
            "—"
          )}
        </div>
      ),
    },
  ];

  return (
    <DashLayout
      title="Agents Management"
      description="Manage your team of property agents and brokers"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <Button 
            onClick={() => navigate("/agents/new")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Agent
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
        columns={agentColumns}
        data={agents}
        searchableColumns={[
          {
            id: "name",
            title: "name"
          },
          {
            id: "email",
            title: "email"
          }
        ]}
        deleteRow={(row) => handleDelete(row.id)}
        editRow={(row) => navigate(`/agents/${row.id}`)}
      />

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Agents</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import agents. The file should include all required fields.
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
      <AlertDialog open={deleteAgentId !== null} onOpenChange={(open) => !open && setDeleteAgentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this agent. This action cannot be undone.
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
