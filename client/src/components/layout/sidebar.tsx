// src/components/layout/Sidebar.tsx
import { useState, useEffect, useContext } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Building,
  MapPin,
  Home,
  UserSquare2,
  Inbox,
  Newspaper,
  Image,
  Map,
  Menu,
  Building2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AuthContext } from "@/context/AuthContext";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  // Get unread enquiry count
  const { data: enquiries = [] } = useQuery({
    queryKey: ["/api/enquiries"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const unreadCount = Array.isArray(enquiries)
    ? enquiries.filter((enquiry: any) => !enquiry.isRead).length
    : 0;

  const routes = [
    {
      label: "Dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: "/",
      active: location === "/",
    },
    {
      label: "Properties",
      icon: <Building className="h-5 w-5" />,
      href: "/properties",
      active: location.startsWith("/properties"),
    },
    {
      label: "Neighborhoods",
      icon: <MapPin className="h-5 w-5" />,
      href: "/neighborhoods",
      active: location.startsWith("/neighborhoods"),
    },
    {
      label: "Developments",
      icon: <Home className="h-5 w-5" />,
      href: "/developments",
      active: location.startsWith("/developments"),
    },
    {
      label: "Agents",
      icon: <UserSquare2 className="h-5 w-5" />,
      href: "/agents",
      active: location.startsWith("/agents"),
    },
    {
      label: "Enquiries",
      icon: <Inbox className="h-5 w-5" />,
      href: "/enquiries",
      badge: unreadCount,
      active: location.startsWith("/enquiries"),
    },
    {
      label: "Articles",
      icon: <Newspaper className="h-5 w-5" />,
      href: "/articles",
      active: location.startsWith("/articles"),
    },
    {
      label: "Banner Highlights",
      icon: <Image className="h-5 w-5" />,
      href: "/banner-highlights",
      active: location.startsWith("/banner-highlights"),
    },
    {
      label: "Developers",
      icon: <Building2 className="h-5 w-5" />,
      href: "/developers",
      active: location.startsWith("/developers"),
    },
    {
      label: "Sitemap",
      icon: <Map className="h-5 w-5" />,
      href: "/sitemap",
      active: location.startsWith("/sitemap"),
    },
  ];

  // Close sidebar when route changes (on mobile)
  useEffect(() => {
    setOpen(false);
  }, [location]);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden fixed top-3 left-3 z-40"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <MobileSidebar routes={routes} />
        </SheetContent>
      </Sheet>
      <div
        className={cn(
          "hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0",
          className
        )}
      >
        <DesktopSidebar routes={routes} />
      </div>
    </>
  );
}

function DesktopSidebar({ routes }) {
  return <SidebarContent routes={routes} />;
}

function MobileSidebar({ routes }) {
  return <SidebarContent routes={routes} />;
}

function SidebarContent({ routes }) {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="flex h-full flex-col bg-white border-r border-neutral-200">
      <div className="flex items-center justify-center h-16 bg-slate-300">
        <Link href="/">
          <span className="text-white text-xl font-semibold cursor-pointer">
            <img src="https://nordstern.ae/logo_nordstern.svg" alt="" className="w-44"/>
          </span>
        </Link>
      </div>
      <ScrollArea className="flex-1 p-4">
        <nav className="space-y-2">
          {routes.map((route) => (
            <Link key={route.href} href={route.href}>
              <a
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                  route.active
                    ? "bg-neutral-100 text-primary"
                    : "text-neutral-700 hover:text-primary hover:bg-neutral-100"
                )}
              >
                {route.icon}
                {route.label}
                {route.badge ? (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary text-xs font-medium text-primary">
                    {route.badge}
                  </span>
                ) : null}
              </a>
            </Link>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t border-neutral-200 p-4">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <p className="text-sm font-medium">{`${user.firstName} ${user.lastName}`}</p>
              <p className="text-xs text-neutral-500">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8"
              onClick={logout}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="sr-only">Log out</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-neutral-200 overflow-hidden">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-full w-full text-neutral-600"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="flex flex-col">
              <p className="text-sm font-medium">Guest</p>
              <Link href="/login">
                <p className="text-xs text-primary cursor-pointer">Login</p>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}