// src/components/settings/UploadProfileImage.tsx
import { useContext, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header.jsx";
import { Sidebar } from "@/components/layout/sidebar.jsx";

export default function UploadProfileImage() {
  const { accessToken } = useContext(AuthContext);
  const [file, setFile] = useState<File | null>(null);

  const uploadImageMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (file) formData.append("profileImage", file);
      const response = await fetch("/api/auth/upload-profile-image", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      toast.success("Profile image uploaded successfully");
      // Update user in context (simplified)
      localStorage.setItem("user", JSON.stringify(data.user));
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select an image");
      return;
    }
    uploadImageMutation.mutate();
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-4 md:p-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Profile Image</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <Button
                  type="submit"
                  disabled={uploadImageMutation.isLoading}
                >
                  {uploadImageMutation.isLoading
                    ? "Uploading..."
                    : "Upload Image"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}