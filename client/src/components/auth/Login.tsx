import { useContext, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

// Validation functions
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function Login() {
  const { login } = useContext(AuthContext);
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({
    email: "",
    password: "",
    server: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {
      email: "",
      password: "",
      server: "",
    };
    let isValid = true;

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      newErrors.email = "Invalid email format";
      isValid = false;
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({ email: "", password: "", server: "" });
    setIsSubmitting(true);

    try {
      if (!validateForm()) {
        setIsSubmitting(false);
        return;
      }

      await login(formData.email, formData.password);
      
      // Show success message
      toast.success("Login successful! Welcome back!");
      
      // Navigate to home page
      setLocation("/");
      
    } catch (error: any) {
      setErrors((prev) => ({ ...prev, server: error.message || "Login failed" }));
      toast.error(error.message || "Login failed");
      setIsSubmitting(false);
    }
    // Note: Don't set isSubmitting to false here if navigation is successful
    // as the component will unmount
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.server && (
              <p className="text-sm text-red-500 text-center">{errors.server}</p>
            )}
            <div>
              <Input
                placeholder="Email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email}</p>
              )}
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
              {errors.password && (
                <p className="text-sm text-red-500 mt-1">{errors.password}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Login"}
            </Button>
            <p className="text-sm text-center text-neutral-500">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary">
                Register
              </Link>
            </p>
            <p className="text-sm text-center text-neutral-500">
  Forgot your password?{" "}
  <Link href="/forgot-password" className="text-primary">
    Reset Password
  </Link>
</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}