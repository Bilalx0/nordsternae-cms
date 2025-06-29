import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Search, Settings, Menu, LogOut, Clock, Hash, FileText, User, Home } from "lucide-react";
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
import { useLocation } from "wouter";

// Real estate application searchable content - matching exact routes from App.tsx
const searchableContent = [
  // Main pages
  { id: 1, title: "Dashboard", type: "page", url: "/", icon: Home },
  { id: 2, title: "Properties", type: "page", url: "/properties", icon: Home },
  { id: 3, title: "Neighborhoods", type: "page", url: "/neighborhoods", icon: Hash },
  { id: 4, title: "Developments", type: "page", url: "/developments", icon: FileText },
  { id: 5, title: "Agents", type: "page", url: "/agents", icon: User },
  { id: 6, title: "Enquiries", type: "page", url: "/enquiries", icon: Bell },
  { id: 7, title: "Articles", type: "page", url: "/articles", icon: FileText },
  { id: 8, title: "Banner Highlights", type: "page", url: "/banner-highlights", icon: FileText },
  { id: 9, title: "Developers", type: "page", url: "/developers", icon: User },
  { id: 10, title: "Sitemap", type: "page", url: "/sitemap", icon: Hash },
  
  // Settings pages
  { id: 11, title: "Change Password", type: "settings", url: "/settings/change-password", icon: Settings },
  { id: 12, title: "Delete Account", type: "settings", url: "/settings/delete-account", icon: Settings },
  
  // Add new/create actions
  { id: 13, title: "Add Property", type: "action", url: "/properties/new", icon: Home },
  { id: 14, title: "Add Agent", type: "action", url: "/agents/new", icon: User },
  { id: 15, title: "Add Development", type: "action", url: "/developments/new", icon: FileText },
  { id: 16, title: "Add Neighborhood", type: "action", url: "/neighborhoods/new", icon: Hash },
  { id: 17, title: "Add Article", type: "action", url: "/articles/new", icon: FileText },
  { id: 18, title: "Add Banner Highlight", type: "action", url: "/banner-highlights/new", icon: FileText },
  { id: 19, title: "Add Developer", type: "action", url: "/developers/new", icon: User },
  { id: 20, title: "Add Sitemap Entry", type: "action", url: "/sitemap/new", icon: Hash },
  
  // Admin functions
  { id: 21, title: "Import Properties", type: "admin", url: "/admin/import-properties", icon: FileText },
  
  // Auth pages (public)
  { id: 22, title: "Login", type: "auth", url: "/login", icon: LogOut },
  { id: 23, title: "Register", type: "auth", url: "/register", icon: User },
];

interface HeaderProps {
  onSearch?: (value: string) => void;
}

interface SearchResult {
  id: number;
  title: string;
  type: string;
  url: string;
  icon: any;
}

export function Header({ onSearch }: HeaderProps) {
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [, navigate] = useLocation();
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mock user - replace with your actual auth context
  const user = { name: "John Doe", email: "john@example.com" };
  const logout = () => console.log("Logout clicked");

  // Filter suggestions based on search input
  useEffect(() => {
    if (searchValue.trim().length > 0) {
      const filtered = searchableContent.filter(item =>
        item.title.toLowerCase().includes(searchValue.toLowerCase()) ||
        item.type.toLowerCase().includes(searchValue.toLowerCase())
      ).slice(0, 8); // Limit to 8 suggestions
      
      setSuggestions(filtered);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  }, [searchValue]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = () => {
    if (searchValue.trim()) {
      // Add to recent searches
      const updatedRecent = [searchValue, ...recentSearches.filter(s => s !== searchValue)].slice(0, 5);
      setRecentSearches(updatedRecent);
      
      if (onSearch) {
        onSearch(searchValue);
      }
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: SearchResult) => {
    setSearchValue(suggestion.title);
    setShowSuggestions(false);
    
    // Add to recent searches
    const updatedRecent = [suggestion.title, ...recentSearches.filter(s => s !== suggestion.title)].slice(0, 5);
    setRecentSearches(updatedRecent);
    
    // Navigate using Wouter
    navigate(suggestion.url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'page': return 'text-blue-600 bg-blue-50';
      case 'action': return 'text-green-600 bg-green-50';
      case 'settings': return 'text-orange-600 bg-orange-50';
      case 'admin': return 'text-red-600 bg-red-50';
      case 'auth': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const showRecentSearches = searchValue.length === 0 && recentSearches.length > 0;

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

      <div ref={searchRef} className="flex-1 flex max-w-lg mx-4 relative">
        <div className="w-full flex md:ml-0">
          <div className="w-full flex">
            <label htmlFor="search-field" className="sr-only">
              Search
            </label>
            <div className="relative w-full text-neutral-400 focus-within:text-neutral-600">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10">
                <Search className="h-5 w-5" />
              </div>
              <Input
                ref={inputRef}
                id="search-field"
                className="block h-9 w-full rounded-md border-0 py-1.5 pl-10 pr-3 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent sm:text-sm"
                placeholder="Search properties, agents, neighborhoods..."
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (searchValue.length > 0 || recentSearches.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        {/* Search Suggestions Dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg max-h-80 overflow-y-auto z-50">
            {showRecentSearches ? (
              <div className="p-2">
                <div className="text-xs font-medium text-neutral-500 px-3 py-2 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Recent Searches
                </div>
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 rounded flex items-center"
                    onClick={() => {
                      setSearchValue(search);
                      if (onSearch) onSearch(search);
                      setShowSuggestions(false);
                    }}
                  >
                    <Clock className="h-4 w-4 mr-3 text-neutral-400" />
                    {search}
                  </button>
                ))}
              </div>
            ) : suggestions.length > 0 ? (
              <div className="p-2">
                <div className="text-xs font-medium text-neutral-500 px-3 py-2">
                  Search Results
                </div>
                {suggestions.map((suggestion, index) => {
                  const IconComponent = suggestion.icon;
                  return (
                    <button
                      key={suggestion.id}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-neutral-50 rounded flex items-center justify-between transition-colors ${
                        selectedIndex === index ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                      }`}
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <IconComponent className="h-4 w-4 mr-3 text-neutral-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-neutral-900 font-medium truncate">
                            {suggestion.title}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">
                            {suggestion.url}
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getTypeColor(suggestion.type)}`}>
                        {suggestion.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : searchValue.length > 0 ? (
              <div className="p-4 text-center text-sm text-neutral-500">
                No results found for "{searchValue}"
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
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
                <button onClick={() => navigate('/settings/change-password')}>
                  Change Password
                </button>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                <button onClick={() => navigate('/settings/delete-account')}>
                  Delete Account
                </button>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => navigate('/login')}>
            <LogOut className="h-5 w-5" />
            <span className="sr-only">Login</span>
          </Button>
        )}
      </div>
    </header>
  );
}

// Mock Sidebar component for the demo
function Sidebar() {
  return (
    <div className="p-4">
      <h3 className="font-medium text-sm text-neutral-900 mb-3">Navigation</h3>
      <div className="space-y-2">
        <div className="text-sm text-neutral-600 p-2 hover:bg-neutral-50 rounded">Dashboard</div>
        <div className="text-sm text-neutral-600 p-2 hover:bg-neutral-50 rounded">Profile</div>
        <div className="text-sm text-neutral-600 p-2 hover:bg-neutral-50 rounded">Settings</div>
      </div>
    </div>
  );
}

// Demo component to show how to use the Header
export default function HeaderDemo() {
  const handleSearch = (value: string) => {
    console.log('Search performed:', value);
    // Implement your search logic here
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onSearch={handleSearch} />
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Real Estate Dashboard Search</h1>
        <p className="text-gray-600">
          Try searching in the header above. Click on any suggestion to navigate to that page:
        </p>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li>• <strong>Main Pages:</strong> Properties, Neighborhoods, Developments, Agents</li>
          <li>• <strong>Quick Actions:</strong> Add Property, Add Agent, Add Development</li>
          <li>• <strong>Management:</strong> Enquiries, Articles, Banner Highlights</li>
          <li>• <strong>Settings:</strong> Change Password, Delete Account</li>
          <li>• <strong>Admin:</strong> Import Properties</li>
        </ul>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Navigation Features:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Click any suggestion to navigate instantly</li>
            <li>• All routes match your App.tsx exactly</li>
            <li>• Recent searches are saved</li>
            <li>• Keyboard shortcuts: ↑↓ Enter Escape</li>
            <li>• Color-coded by category</li>
          </ul>
        </div>
      </div>
    </div>
  );
}