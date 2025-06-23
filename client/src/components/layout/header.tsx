// src/components/layout/Header.tsx
import { useState, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Search, Settings, Menu, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sidebar } from "./sidebar";
import { AuthContext } from "@/context/AuthContext";
import { Link } from "wouter";

interface HeaderProps {
  onSearch?: (value: string) => void;
}

export function Header({ onSearch }: HeaderProps) {
  const [searchValue, setSearchValue] = useState("");
  const { user, logout } = useContext(AuthContext);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchValue);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-white border-b border-neutral-200 px-4 sm:px-6">
      <div className="flex items-center md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>
      </div>

      <form onSubmit={handleSearch} className="flex-1 flex max-w-lg mx-4">
        <div className="w-full flex md:ml-0">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <div className="relative w-full text-neutral-400 focus-within:text-neutral-600">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5" />
            </div>
            <Input
              id="search-field"
              className="block h-9 w-full rounded-md border-0 py-1.5 pl-10 pr-3 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 focus:ring-0 sm:text-sm"
              placeholder="Search..."
              type="search"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
        </div>
      </form>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="hidden md:flex">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hidden md:flex">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link href="/settings/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/settings/change-password">Change Password</Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link href="/settings/upload-image">Upload Profile Image</Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                <Link href="/settings/delete-account">Delete Account</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="icon" className="hidden md:flex">
            <Link href="/login">
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Login</span>
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}