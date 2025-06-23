// src/components/settings/UpdateProfile.tsx
import { useContext, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { DashLayout } from "@/components/layout/dash-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header.jsx";
import { Sidebar } from "@/components/layout/sidebar.jsx";

export default function UpdateProfile() {
  const { user, accessToken } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const response = await fetch("/api/auth/profile", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data.user;
    },
    enabled: !!accessToken,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.user;
    },
    onSuccess: (updatedUser) => {
      toast.success("Profile updated successfully");
      // Update user in context (simplified, may need to update AuthContext)
      localStorage.setItem("user", JSON.stringify(updatedUser));
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-4 md:p-6">
          <Card>
            <CardHeader>
              <CardTitle>Update Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                />
                <Input
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                />
                <Input
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isLoading}
                >
                  {updateProfileMutation.isLoading
                    ? "Updating..."
                    : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}