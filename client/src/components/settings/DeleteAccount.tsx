// src/components/settings/DeleteAccount.tsx
import { useContext, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header.jsx";
import { Sidebar } from "@/components/layout/sidebar.jsx";
import {DashLayout} from "@/components/layout/dash-layout.jsx";

export default function DeleteAccount() {
  const { accessToken, logout } = useContext(AuthContext);
  const [password, setPassword] = useState("");
  const navigate = useLocation();

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      logout();
      toast.success("Account deleted successfully");
      navigate("/login");
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("Please enter your password");
      return;
    }
    deleteAccountMutation.mutate();
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
              <CardTitle>Delete Account</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={deleteAccountMutation.isLoading}
                >
                  {deleteAccountMutation.isLoading
                    ? "Deleting..."
                    : "Delete Account"}
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