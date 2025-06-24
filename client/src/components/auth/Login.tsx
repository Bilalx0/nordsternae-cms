// src/components/auth/Login.tsx
import { useContext, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Login() {
  const { login } = useContext(AuthContext);
  const [, setLocation] = useLocation(); // Fixed: properly destructure useLocation
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(formData.email, formData.password);
      setLocation("/"); // Fixed: use setLocation instead of navigate
    } catch (error) {
      // Error handled by AuthContext
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
            <Input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
            <Button type="submit" className="w-full">
              Login
            </Button>
            <p className="text-sm text-center text-neutral-500">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary">
                Register
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}