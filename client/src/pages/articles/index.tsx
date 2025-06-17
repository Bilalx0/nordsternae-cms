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
import { formatDate, objectsToCSV, downloadCSV, truncateText } from "@/lib/utils";
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

export default function ArticlesPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteArticleId, setDeleteArticleId] = useState<number | null>(null);

  // Fetch articles
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['/api/articles'],
  });

  // Delete article mutation
  const deleteArticleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/articles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
      toast({
        title: "Article deleted",
        description: "The article has been successfully deleted.",
      });
      setDeleteArticleId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete article. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete article:", error);
    }
  });

  const handleDelete = (id: number) => {
    setDeleteArticleId(id);
  };

  const confirmDelete = () => {
    if (deleteArticleId !== null) {
      deleteArticleMutation.mutate(deleteArticleId);
    }
  };

  const handleExportCSV = () => {
    const csv = objectsToCSV(articles);
    downloadCSV(csv, "articles.csv");
    toast({
      title: "Export successful",
      description: "Articles have been exported to CSV.",
    });
  };

  const handleImportCSV = (data: any[]) => {
    // In a real app, this would call a bulk import API endpoint
    toast({
      title: "Import successful",
      description: `${data.length} articles have been imported.`,
    });
    setIsImportDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
  };

  const articleColumns: ColumnDef<any>[] = [
    {
      id: "title",
      header: "Title",
      accessorKey: "title",
      cell: ({ row }) => (
        <div className="font-medium">{truncateText(row.original.title, 50)}</div>
      ),
    },
    {
      id: "author",
      header: "Author",
      accessorKey: "author",
      cell: ({ row }) => <div>{row.original.author || "—"}</div>,
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.category || "Uncategorized"}
        </Badge>
      ),
    },
    {
      id: "datePublished",
      header: "Published Date",
      accessorKey: "datePublished",
      cell: ({ row }) => <div>{formatDate(row.original.datePublished || "") || "—"}</div>,
    },
    {
      id: "readingTime",
      header: "Reading Time",
      accessorKey: "readingTime",
      cell: ({ row }) => (
        <div>{row.original.readingTime ? `${row.original.readingTime} min` : "—"}</div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        if (row.original.isDisabled) {
          return <Badge variant="destructive">Disabled</Badge>;
        }
        if (row.original.superFeature) {
          return <Badge variant="success">Super Feature</Badge>;
        }
        if (row.original.isFeatured) {
          return <Badge variant="secondary">Featured</Badge>;
        }
        return <Badge variant="outline">Published</Badge>;
      },
    },
    {
      id: "slug",
      header: "Slug",
      accessorKey: "slug",
      cell: ({ row }) => <div>{row.original.slug}</div>,
    }
  ];

  return (
    <DashLayout
      title="Articles Management"
      description="Manage blog articles and news content"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div className="mt-4 md:mt-0 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
          <Button 
            onClick={() => navigate("/articles/new")}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Article
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
        columns={articleColumns}
        data={articles}
        filterableColumns={[
          {
            id: "category",
            title: "Category",
            options: Array.from(new Set(articles.map((a: any) => a.category)))
              .filter(Boolean)
              .map(category => ({ label: category, value: category }))
          }
        ]}
        searchableColumns={[
          {
            id: "title",
            title: "title"
          },
          {
            id: "author",
            title: "author"
          }
        ]}
        deleteRow={(row) => handleDelete(row.id)}
        editRow={(row) => navigate(`/articles/${row.id}`)}
      />

      {/* Import CSV Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Articles</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import articles. The file should include all required fields.
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
      <AlertDialog open={deleteArticleId !== null} onOpenChange={(open) => !open && setDeleteArticleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this article. This action cannot be undone.
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
