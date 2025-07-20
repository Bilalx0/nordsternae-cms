// src/App.tsx
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient.js";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster.jsx";
import { TooltipProvider } from "@/components/ui/tooltip.jsx";
import { AuthProvider, AuthContext } from "@/context/AuthContext";
import { useContext, useEffect } from "react";
import { useLocation } from "wouter";
import NotFound from "@/pages/not-found.jsx";
import Dashboard from "@/pages/dashboard.jsx";
import PropertiesPage from "@/pages/properties/index.jsx";
import PropertyEditPage from "@/pages/properties/edit.jsx";
import AgentsPage from "@/pages/agents/index.jsx";
import AgentEditPage from "@/pages/agents/edit.jsx";
import DevelopmentsPage from "@/pages/developments/index.jsx";
import DevelopmentEditPage from "@/pages/developments/edit.jsx";
import NeighborhoodsPage from "@/pages/neighborhoods/index.jsx";
import NeighborhoodEditPage from "@/pages/neighborhoods/edit.jsx";
import ArticlesPage from "@/pages/articles/index.jsx";
import ArticleEditPage from "@/pages/articles/edit.jsx";
import EnquiriesPage from "@/pages/enquiries/index.jsx";
import EnquiryDetailPage from "@/pages/enquiries/detail.jsx";
import BannerHighlightsPage from "@/pages/banner-highlights/index.jsx";
import BannerHighlightEditPage from "@/pages/banner-highlights/edit.jsx";
import DevelopersPage from "@/pages/developers/index.jsx";
import DeveloperEditPage from "@/pages/developers/edit.jsx";
import SitemapPage from "@/pages/sitemap/index.jsx";
import SitemapEditPage from "@/pages/sitemap/edit.jsx";
import ImportProperties from "@/pages/admin/import-properties.jsx";
import Login from "@/components/auth/Login";
import Register from "@/components/auth/Register";
import UpdateProfile from "@/components/settings/UpdateProfile";
import ChangePassword from "@/components/settings/ChangePassword";
import UploadProfileImage from "@/components/settings/UploadProfileImage";
import DeleteAccount from "@/components/settings/DeleteAccount";
import FooterLinkEditPage from "./pages/footer_links/edit.jsx";
import FooterLinksPage from "./pages/footer_links/index.jsx";

// ProtectedRoute component to guard authenticated routes
function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType<any>; [key: string]: any }) {
  const { user } = useContext(AuthContext) as { user: any };
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  return user ? <Route {...rest} component={Component} /> : null;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />

      {/* Protected routes */}
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/properties" component={PropertiesPage} />
      <ProtectedRoute path="/properties/new" component={PropertyEditPage} />
      <ProtectedRoute path="/properties/:id" component={PropertyEditPage} />
      <ProtectedRoute path="/admin/import-properties" component={ImportProperties} />
      <ProtectedRoute path="/agents" component={AgentsPage} />
      <ProtectedRoute path="/agents/new" component={AgentEditPage} />
      <ProtectedRoute path="/agents/:id" component={AgentEditPage} />
      <ProtectedRoute path="/developments" component={DevelopmentsPage} />
      <ProtectedRoute path="/developments/new" component={DevelopmentEditPage} />
      <ProtectedRoute path="/developments/:id" component={DevelopmentEditPage} />
      <ProtectedRoute path="/neighborhoods" component={NeighborhoodsPage} />
      <ProtectedRoute path="/neighborhoods/new" component={NeighborhoodEditPage} />
      <ProtectedRoute path="/neighborhoods/:id" component={NeighborhoodEditPage} />
      <ProtectedRoute path="/articles" component={ArticlesPage} />
      <ProtectedRoute path="/articles/new" component={ArticleEditPage} />
      <ProtectedRoute path="/articles/:id" component={ArticleEditPage} />
      <ProtectedRoute path="/enquiries" component={EnquiriesPage} />
      <ProtectedRoute path="/enquiries/:id" component={EnquiryDetailPage} />
      <ProtectedRoute path="/banner-highlights" component={BannerHighlightsPage} />
      <ProtectedRoute path="/banner-highlights/new" component={BannerHighlightEditPage} />
      <ProtectedRoute path="/banner-highlights/:id" component={BannerHighlightEditPage} />
      <ProtectedRoute path="/developers" component={DevelopersPage} />
      <ProtectedRoute path="/developers/new" component={DeveloperEditPage} />
      <ProtectedRoute path="/developers/:id" component={DeveloperEditPage} />
      <ProtectedRoute path="/sitemap" component={SitemapPage} />
      <ProtectedRoute path="/sitemap/new" component={SitemapEditPage} />
      <ProtectedRoute path="/sitemap/:id" component={SitemapEditPage} />
      <ProtectedRoute path="/settings/change-password" component={ChangePassword} />
      <ProtectedRoute path="/settings/delete-account" component={DeleteAccount} />
      <ProtectedRoute path="/footer_links" component={FooterLinksPage} />
      <ProtectedRoute path="/footer_links/new" component={FooterLinkEditPage} />
      <ProtectedRoute path="/footer_links/:id" component={FooterLinkEditPage} />


      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;