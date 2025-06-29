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

// Real estate application searchable content
const searchableContent = [
  { id: 1, title: "Dashboard", type: "page", url: "/dashboard", icon: Home },
  { id: 2, title: "Properties", type: "page", url: "/properties", icon: Home },
  { id: 3, title: "Neighborhoods", type: "page", url: "/neighborhoods", icon: Hash },
  { id: 4, title: "Developments", type: "page", url: "/developments", icon: FileText },
  { id: 5, title: "Agents", type: "page", url: "/agents", icon: User },
  { id: 6, title: "Enquiries", type: "page", url: "/enquiries", icon: Bell },
  { id: 7, title: "Articles", type: "page", url: "/articles", icon: FileText },
  { id: 8, title: "Banner", type: "page", url: "/banner", icon: FileText },
  { id: 9, title: "Highlights", type: "page", url: "/highlights", icon: FileText },
  { id: 10, title: "Developers", type: "page", url: "/developers", icon: User },
  { id: 11, title: "Sitemap", type: "page", url: "/sitemap", icon: Hash },
  { id: 12, title: "Change Password", type: "settings", url: "/settings/change-password", icon: Settings },
  { id: 13, title: "Delete Account", type: "settings", url: "/settings/delete-account", icon: Settings },
  
  // Property-related searches
  { id: 14, title: "Add Property", type: "action", url: "/properties/add", icon: Home },
  { id: 15, title: "Property List", type: "content", url: "/properties/list", icon: Home },
  { id: 16, title: "Property Search", type: "action", url: "/properties/search", icon: Search },
  
  // Agent-related searches
  { id: 17, title: "Add Agent", type: "action", url: "/agents/add", icon: User },
  { id: 18, title: "Agent List", type: "content", url: "/agents/list", icon: User },
  { id: 19, title: "Agent Profile", type: "content", url: "/agents/profile", icon: User },
  
  // Neighborhood-related searches
  { id: 20, title: "Add Neighborhood", type: "action", url: "/neighborhoods/add", icon: Hash },
  { id: 21, title: "Neighborhood List", type: "content", url: "/neighborhoods/list", icon: Hash },
  
  // Development-related searches
  { id: 22, title: "Add Development", type: "action", url: "/developments/add", icon: FileText },
  { id: 23, title: "Development List", type: "content", url: "/developments/list", icon: FileText },
  
  // Enquiry-related searches
  { id: 24, title: "New Enquiries", type: "content", url: "/enquiries/new", icon: Bell },
  { id: 25, title: "Pending Enquiries", type: "content", url: "/enquiries/pending", icon: Bell },
  { id: 26, title: "Completed Enquiries", type: "content", url: "/enquiries/completed", icon: Bell },
  
  // Article-related searches
  { id: 27, title: "Add Article", type: "action", url: "/articles/add", icon: FileText },
  { id: 28, title: "Article List", type: "content", url: "/articles/list", icon: FileText },
  { id: 29, title: "Published Articles", type: "content", url: "/articles/published", icon: FileText },
  
  // Developer-related searches
  { id: 30, title: "Add Developer", type: "action", url: "/developers/add", icon: User },
  { id: 31, title: "Developer List", type: "content", url: "/developers/list", icon: User },
];

interface HeaderProps {
  onSearch?: (value: string) => void;
  onNavigate?: (url: string) => void;
}

interface SearchResult {
  id: number;
  title: string;
  type: string;
  url: string;
  icon: any;
}

export function Header({ onSearch, onNavigate }: HeaderProps) {
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
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
    
    if (onNavigate) {
      onNavigate(suggestion.url);
    }
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
      case 'content': return 'text-purple-600 bg-purple-50';
      case 'settings': return 'text-orange-600 bg-orange-50';
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
                <button onClick={() => onNavigate?.('/settings/change-password')}>
                  Change Password
                </button>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                <button onClick={() => onNavigate?.('/settings/delete-account')}>
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
          <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => onNavigate?.('/login')}>
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

  const handleNavigate = (url: string) => {
    console.log('Navigate to:', url);
    // Implement your navigation logic here
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onSearch={handleSearch} onNavigate={handleNavigate} />
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Search Demo</h1>
        <p className="text-gray-600">
          Try searching in the header above. Search for any of these sections:
        </p>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li>• <strong>Main Pages:</strong> Dashboard, Properties, Neighborhoods, Developments</li>
          <li>• <strong>Management:</strong> Agents, Developers, Enquiries, Articles</li>
          <li>• <strong>Content:</strong> Banner, Highlights, Sitemap</li>
          <li>• <strong>Settings:</strong> Change Password, Delete Account</li>
          <li>• <strong>Actions:</strong> Add Property, Add Agent, New Enquiries</li>
        </ul>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Search Features:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Auto-suggestions as you type</li>
            <li>• Recent search history</li>
            <li>• Keyboard navigation (↑↓ Enter Escape)</li>
            <li>• Color-coded categories</li>
            <li>• Click outside to close</li>
          </ul>
        </div>
      </div>
    </div>
  );
}