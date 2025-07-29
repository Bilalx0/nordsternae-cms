import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

// Validation functions
const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (password.length < 8) {
    return { isValid: false, message: "Password must be at least 8 characters long" };
  }
  if (!/(?=.*[a-z])/.test(password)) {
    return { isValid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    return { isValid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/(?=.*\d)/.test(password)) {
    return { isValid: false, message: "Password must contain at least one number" };
  }
  return { isValid: true };
};

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") || "";
  
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({
    newPassword: "",
    confirmPassword: "",
    server: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);

  // Verify reset token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setErrors({ newPassword: "", confirmPassword: "", server: "Invalid or missing reset token" });
        setIsTokenValid(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/verify-reset-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Invalid or expired reset token");
        }

        console.log("[ResetPassword] Token verified successfully");
        setIsTokenValid(true);
      } catch (error: any) {
        console.error("[ResetPassword] Token verification error:", error.message);
        setErrors({ newPassword: "", confirmPassword: "", server: error.message || "Invalid or expired reset token" });
        setIsTokenValid(false);
      }
    };

    verifyToken();
  }, [token]);

  const validateForm = () => {
    const newErrors = {
      newPassword: "",
      confirmPassword: "",
      server: "",
    };
    let isValid = true;

    const passwordValidation = validatePassword(formData.newPassword);
    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
      isValid = false;
    } else if (!passwordValidation.isValid) {
      newErrors.newPassword = passwordValidation.message || "Invalid password";
      isValid = false;
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required";
      isValid = false;
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({ newPassword: "", confirmPassword: "", server: "" });
    setIsSubmitting(true);

    try {
      if (!validateForm()) {
        setIsSubmitting(false);
        return;
      }

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: formData.newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      console.log("[ResetPassword] Password reset successfully");
      toast.success("Password reset successfully! Please log in with your new password.");
      setLocation("/login");
    } catch (error: any) {
      console.error("[ResetPassword] Error:", error.message);
      setErrors({ newPassword: "", confirmPassword: "", server: error.message || "Failed to reset password" });
      toast.error(error.message || "Failed to reset password");
      setIsSubmitting(false);
    }
  };

  if (isTokenValid === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Reset Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-500 text-center">{errors.server}</p>
            <p className="text-sm text-center text-neutral-500 mt-4">
              Please request a new reset link.
            </p>
            <Button
              className="w-full mt-4"
              onClick={() => setLocation("/forgot-password")}
            >
              Request New Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          {isTokenValid === null ? (
            <p className="text-sm text-center text-neutral-500">Verifying reset link...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.server && (
                <p className="text-sm text-red-500 text-center">{errors.server}</p>
              )}
              <div>
                <Input
                  type="password"
                  placeholder="New Password"
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                />
                {errors.newPassword && (
                  <p className="text-sm text-red-500 mt-1">{errors.newPassword}</p>
                )}
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </Button>
              <p className="text-sm text-center text-neutral-500">
                Remember your password?{" "}
                <Link href="/login" className="text-primary">
                  Back to Login
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}