// src/components/settings/ChangePassword.tsx
import { useContext, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header.jsx";
import { Sidebar } from "@/components/layout/sidebar.jsx";
import {DashLayout} from "@/components/layout/dash-layout.jsx";
import { useLocation } from "wouter";

export default function ChangePassword() {
  const { accessToken } = useContext(AuthContext);
  const [, setLocation] = useLocation(); // Fixed: properly destructure useLocation

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Account password update successfully");
      setLocation("/login");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    changePasswordMutation.mutate(formData);
  };

  return (
    <DashLayout
      title="Account Management"
      description="Manage all property listings across your platform"
    >
    <div className="flex min-h-screen">
      <div className="flex-1 flex flex-col">
        <main className="flex-1 p-4 md:p-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="password"
                  placeholder="Current Password"
                  value={formData.currentPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      currentPassword: e.target.value,
                    })
                  }
                />
                <Input
                  type="password"
                  placeholder="New Password"
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                />
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isLoading}
                >
                  {changePasswordMutation.isLoading
                    ? "Updating..."
                    : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
    </DashLayout>
  );
}