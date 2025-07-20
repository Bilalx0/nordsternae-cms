// client/src/pages/footer_links/index.tsx

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function FooterLinksPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: footerLinks = [], isLoading } = useQuery({
    queryKey: ["/api/footer-links"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/footer-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/footer-links"] });
      toast({ title: "Deleted", description: "Footer link removed." });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    },
  });

  const handleDelete = (id: number) => setDeleteId(id);
  const confirmDelete = () => deleteId && deleteMutation.mutate(deleteId);

  const columns: ColumnDef<any>[] = [
    { header: "Heading", accessorKey: "heading" },
    { header: "URL Path", accessorKey: "url" },
    { header: "Priority", accessorKey: "priority" },
    { header: "Section", accessorKey: "section" },
  ];

  return (
    <DashLayout title="Footer Links" description="Manage footer navigation links">
      <div className="flex justify-end mb-4">
        <Button onClick={() => navigate("/footer_links/new")} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Footer Link
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={footerLinks}
        deleteRow={(row) => handleDelete(row.id)}
        editRow={(row) => navigate(`/footer_links/${row.id}`)}
        searchableColumns={[
          { id: "heading", title: "Heading" },
          { id: "section", title: "Section" }
        ]}
      />
    </DashLayout>
  );
}
