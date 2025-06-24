import { useContext, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header.jsx";
import { Sidebar } from "@/components/layout/sidebar.jsx";
import imageCompression from 'browser-image-compression';

export default function UploadProfileImage() {
  const { accessToken } = useContext(AuthContext) as { accessToken: string };
  const [file, setFile] = useState<File | null>(null);

  const uploadImageMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      // Validate file type
      if (!file.type.startsWith("image/")) {
        throw new Error("Only image files are allowed");
      }

      // Compression options
      const options = {
        maxSizeMB: 1, // Maximum file size in MB
        maxWidthOrHeight: 1024, // Maximum width or height
        useWebWorker: true, // Use web worker for better performance
        fileType: 'image/jpeg', // Output format
        initialQuality: 0.8, // Initial quality (0-1)
      };

      try {
        // Compress the image
        const compressedFile = await imageCompression(file, options);
        
        console.log('Original file size:', file.size / 1024 / 1024, 'MB');
        console.log('Compressed file size:', compressedFile.size / 1024 / 1024, 'MB');

        const formData = new FormData();
        formData.append("profileImage", compressedFile);

        const response = await fetch("/api/auth/upload-profile-image", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            // Remove Content-Type header to let browser set multipart boundary
          },
          body: formData,
        });

        const result = await response.json();
        if (!response.ok) {
          console.error("Upload error response:", result);
          throw new Error(result.error || "Failed to upload image");
        }
        return result;
      } catch (compressionError) {
        console.error("Image compression error:", compressionError);
        throw new Error("Failed to compress image");
      }
    },
    onSuccess: (data) => {
      toast.success("Profile image uploaded successfully");
      localStorage.setItem("user", JSON.stringify(data.user));
    },
    onError: (error: any) => {
      console.error("Upload mutation error:", error);
      toast.error(error.message || "Failed to upload image");
    },
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
                  disabled={uploadImageMutation.isLoading || !file}
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