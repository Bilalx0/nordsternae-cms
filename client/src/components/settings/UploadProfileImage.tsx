import { useContext, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header.jsx";
import { Sidebar } from "@/components/layout/sidebar.jsx";

// Compress image using canvas
const compressImage = (file: File, maxSizeMB: number, maxWidth: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Resize if image exceeds maxWidth
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context not supported"));

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with quality 0.8
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Failed to compress image"));
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            if (compressedFile.size > maxSizeMB * 1024 * 1024) {
              reject(new Error(`Compressed image size exceeds ${maxSizeMB}MB`));
            } else {
              resolve(compressedFile);
            }
          },
          "image/jpeg",
          0.8 // Quality (0 to 1)
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

export default function UploadProfileImage() {
  const { accessToken } = useContext(AuthContext) as { accessToken: string };
  const [file, setFile] = useState<File | null>(null);

  const uploadImageMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file selected");

      // Validate file type and size
      if (!file.type.startsWith("image/")) {
        throw new Error("Only image files are allowed");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("File size must be less than 5MB");
      }

      // Compress image (max 5MB, max width 1024px)
      const compressedFile = await compressImage(file, 5, 1024);

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