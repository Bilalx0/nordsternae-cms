import { useState, useEffect } from "react";
import { useRoute, useRouter } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashLayout } from "@/components/layout/dash-layout";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Trash2, Mail, User, Phone, Calendar, MapPin, AlignLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";

export default function EnquiryDetailPage() {
  const [match, params] = useRoute("/enquiries/:id");
  const [_, navigate] = useRouter();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const enquiryId = parseInt(params?.id || "0");

  // Fetch enquiry data
  const { data: enquiry, isLoading } = useQuery({
    queryKey: ['/api/enquiries', enquiryId],
    enabled: !!enquiryId,
  });

  // Mark enquiry as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/enquiries/${enquiryId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enquiries', enquiryId] });
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

  // Delete enquiry mutation
  const deleteEnquiryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/enquiries/${enquiryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enquiries'] });
      toast({
        title: "Enquiry deleted",
        description: "The enquiry has been successfully deleted.",
      });
      navigate("/enquiries");
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

  // Automatically mark as read when opening the detail page
  useEffect(() => {
    if (enquiry && !enquiry.isRead) {
      markAsReadMutation.mutate();
    }
  }, [enquiry]);

  const handleDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteEnquiryMutation.mutate();
  };

  if (isLoading) {
    return (
      <DashLayout title="Enquiry Details" description="Loading enquiry information...">
        <Button
          variant="outline"
          className="mb-6"
          onClick={() => navigate("/enquiries")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Enquiries
        </Button>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashLayout>
    );
  }

  if (!enquiry) {
    return (
      <DashLayout title="Enquiry Not Found" description="The requested enquiry could not be found">
        <Button
          variant="outline"
          className="mb-6"
          onClick={() => navigate("/enquiries")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Enquiries
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center h-40">
              <p className="text-lg font-medium text-center text-gray-500">
                The enquiry you are looking for does not exist or has been deleted.
              </p>
            </div>
          </CardContent>
        </Card>
      </DashLayout>
    );
  }

  return (
    <DashLayout
      title="Enquiry Details"
      description={`Viewing enquiry from ${enquiry.email}`}
    >
      <div className="flex justify-between items-center mb-6">
        <Button
          variant="outline"
          onClick={() => navigate("/enquiries")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Enquiries
        </Button>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            className="text-red-500"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Enquiry
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{enquiry.subject || "General Enquiry"}</CardTitle>
                  <CardDescription>
                    {formatDate(enquiry.createdAt, { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </CardDescription>
                </div>
                {enquiry.isRead ? (
                  <Badge variant="outline">Read</Badge>
                ) : (
                  <Badge variant="secondary">New</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enquiry.propertyReference && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h3 className="font-medium text-sm">Property Reference</h3>
                      <p>{enquiry.propertyReference}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <AlignLeft className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-medium text-sm">Message</h3>
                    <div className="mt-2 p-4 bg-gray-50 rounded-md">
                      {enquiry.message ? (
                        <p className="whitespace-pre-line">{enquiry.message}</p>
                      ) : (
                        <p className="text-gray-500 italic">No message provided</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-medium text-sm">Name</h3>
                    <p>{enquiry.name || "Not provided"}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-medium text-sm">Email</h3>
                    <p className="break-all">{enquiry.email}</p>
                  </div>
                </div>
                
                {enquiry.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h3 className="font-medium text-sm">Phone</h3>
                      <p>{enquiry.phone}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-medium text-sm">Received On</h3>
                    <p>{formatDate(enquiry.createdAt)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex justify-center">
              <Button className="w-full">
                <Mail className="h-4 w-4 mr-2" />
                Reply via Email
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
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
