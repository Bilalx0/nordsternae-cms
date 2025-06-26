// src/components/layout/Header.tsx
import { useState, useContext, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Settings, Menu, LogOut } from "lucide-react";
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
import { Link, useLocation } from "wouter";
import Fuse from 'fuse.js';

interface PageContent {
  id: string;
  title: string;
  url: string;
  content: string;
  headings: string[];
  links: string[];
  timestamp: number;
}

interface SearchResult {
  item: PageContent;
  matches?: any[];
}

interface HeaderProps {
  onSearch?: (value: string) => void;
}

export function Header({ onSearch }: HeaderProps) {
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isIndexing, setIsIndexing] = useState(false);
  const [searchIndex, setSearchIndex] = useState<PageContent[]>([]);
  const { user, logout } = useContext(AuthContext);
  const [, setLocation] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fuseRef = useRef<Fuse<PageContent> | null>(null);

  // Automatic content scanner
  const scanWebsiteContent = async () => {
    setIsIndexing(true);
    const scannedPages: PageContent[] = [];
    const visitedUrls = new Set<string>();
    const baseUrl = window.location.origin;

    // Get all links from current page and scan recursively
    const scanPage = async (url: string): Promise<void> => {
      if (visitedUrls.has(url) || !url.startsWith(baseUrl)) return;
      visitedUrls.add(url);

      try {
        // For SPA, we need to navigate and scan DOM content
        const response = await fetch(url);
        if (!response.ok) return;

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract content
        const title = doc.querySelector('title')?.textContent || 
                     doc.querySelector('h1')?.textContent || 
                     url.split('/').pop() || 'Untitled';

        // Get main content (exclude nav, footer, etc.)
        const contentSelectors = [
          'main', '[role="main"]', '.content', '#content', 
          '.main-content', 'article', '.page-content'
        ];
        
        let contentElement = null;
        for (const selector of contentSelectors) {
          contentElement = doc.querySelector(selector);
          if (contentElement) break;
        }

        // Fallback to body if no main content found
        if (!contentElement) {
          contentElement = doc.body;
        }

        // Remove unwanted elements
        const unwantedSelectors = [
          'nav', 'header', 'footer', '.nav', '.header', '.footer',
          '.sidebar', '.menu', 'script', 'style', '.advertisement'
        ];
        
        unwantedSelectors.forEach(selector => {
          const elements = contentElement?.querySelectorAll(selector);
          elements?.forEach(el => el.remove());
        });

        const content = contentElement?.textContent?.trim() || '';
        
        // Extract headings
        const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
          .map(h => h.textContent?.trim())
          .filter(Boolean) as string[];

        // Extract internal links for further scanning
        const links = Array.from(doc.querySelectorAll('a[href]'))
          .map(a => {
            const href = (a as HTMLAnchorElement).href;
            return href.startsWith(baseUrl) ? href : null;
          })
          .filter(Boolean) as string[];

        scannedPages.push({
          id: url,
          title: title.trim(),
          url,
          content,
          headings,
          links,
          timestamp: Date.now()
        });

        // Recursively scan found links (limit depth to prevent infinite loops)
        if (scannedPages.length < 50) { // Limit total pages
          for (const link of links.slice(0, 10)) { // Limit links per page
            await scanPage(link);
          }
        }

      } catch (error) {
        console.warn(`Failed to scan ${url}:`, error);
      }
    };

    // For SPA, we need to scan current DOM content instead of fetching
    const scanCurrentSPA = () => {
      const currentUrl = window.location.href;
      const title = document.title || 
                   document.querySelector('h1')?.textContent || 
                   'Current Page';

      // Get main content
      const contentSelectors = [
        'main', '[role="main"]', '.content', '#content', 
        '.main-content', 'article', '.page-content'
      ];
      
      let contentElement = null;
      for (const selector of contentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }

      if (!contentElement) {
        contentElement = document.body;
      }

      // Clone and clean content
      const clonedContent = contentElement.cloneNode(true) as Element;
      const unwantedSelectors = [
        'nav', 'header', 'footer', '.nav', '.header', '.footer',
        '.sidebar', '.menu', 'script', 'style', '.search-results'
      ];
      
      unwantedSelectors.forEach(selector => {
        const elements = clonedContent.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      const content = clonedContent.textContent?.trim() || '';
      
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .map(h => h.textContent?.trim())
        .filter(Boolean) as string[];

      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => (a as HTMLAnchorElement).href)
        .filter(href => href.startsWith(window.location.origin));

      return {
        id: currentUrl,
        title: title.trim(),
        url: currentUrl,
        content,
        headings,
        links,
        timestamp: Date.now()
      };
    };

    // For SPA, scan current page content
    const currentPage = scanCurrentSPA();
    scannedPages.push(currentPage);

    // You can also add predefined routes if you know them
    const knownRoutes = [
      '/dashboard',
      '/settings',
      '/settings/change-password',
      '/settings/delete-account',
      '/profile',
      // Add your known routes here
    ];

    // Simulate navigation to other routes (for SPA)
    // This is a simplified approach - in a real SPA you'd need to integrate with your router
    for (const route of knownRoutes) {
      if (route !== window.location.pathname) {
        scannedPages.push({
          id: window.location.origin + route,
          title: route.split('/').pop()?.replace('-', ' ') || route,
          url: window.location.origin + route,
          content: `Page content for ${route}`, // You'd need to navigate and scan actual content
          headings: [route.split('/').pop()?.replace('-', ' ') || route],
          links: [],
          timestamp: Date.now()
        });
      }
    }

    setSearchIndex(scannedPages);
    
    // Create Fuse instance
    fuseRef.current = new Fuse(scannedPages, {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'headings', weight: 0.3 },
        { name: 'content', weight: 0.3 }
      ],
      threshold: 0.4,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
    });

    setIsIndexing(false);
    
    // Store in memory (since we can't use localStorage)
    console.log(`Indexed ${scannedPages.length} pages`);
  };

  // Initialize scanning on component mount
  useEffect(() => {
    scanWebsiteContent();
  }, []);

  // Handle search
  useEffect(() => {
    if (searchValue.length >= 2 && fuseRef.current) {
      const results = fuseRef.current.search(searchValue);
      setSearchResults(results.slice(0, 8));
      setShowResults(true);
      setSelectedIndex(-1);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchValue]);

  // Handle clicks outside search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          navigateToResult(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        inputRef.current?.blur();
        break;
    }
  };

  const navigateToResult = (result: SearchResult) => {
    const url = result.item.url.replace(window.location.origin, '');
    setLocation(url);
    setSearchValue("");
    setShowResults(false);
    inputRef.current?.blur();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0) {
      navigateToResult(searchResults[selectedIndex]);
    } else if (searchResults.length > 0) {
      navigateToResult(searchResults[0]);
    }
    if (onSearch) {
      onSearch(searchValue);
    }
  };

  const highlightMatch = (text: string, matches?: any[]) => {
    if (!matches || matches.length === 0) return text;
    
    // Simple highlighting - you can make this more sophisticated
    let highlightedText = text;
    matches.forEach(match => {
      if (match.value) {
        const regex = new RegExp(`(${match.value})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
      }
    });
    
    return highlightedText;
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

      <div className="flex-1 flex max-w-lg mx-4 relative" ref={searchRef}>
        <form onSubmit={handleSearch} className="w-full">
          <div className="w-full flex md:ml-0">
            <label htmlFor="search-field" className="sr-only">
              Search
            </label>
            <div className="relative w-full text-neutral-400 focus-within:text-neutral-600">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10">
                <Search className={`h-5 w-5 ${isIndexing ? 'animate-spin' : ''}`} />
              </div>
              <Input
                ref={inputRef}
                id="search-field"
                className="block h-9 w-full rounded-md border-0 py-1.5 pl-10 pr-3 bg-neutral-50 text-neutral-900 placeholder:text-neutral-500 focus:ring-0 sm:text-sm"
                placeholder={isIndexing ? "Indexing content..." : "Search entire website..."}
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => searchValue.length >= 2 && setShowResults(true)}
                autoComplete="off"
                disabled={isIndexing}
              />
            </div>
          </div>
        </form>

        {/* Search Results */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
            {searchResults.map((result, index) => {
              const contentPreview = result.item.content.substring(0, 100) + '...';
              return (
                <div
                  key={result.item.id}
                  className={`px-4 py-3 cursor-pointer border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 ${
                    index === selectedIndex ? 'bg-neutral-50' : ''
                  }`}
                  onClick={() => navigateToResult(result)}
                >
                  <div className="text-sm font-medium text-neutral-900 mb-1">
                    {result.item.title}
                  </div>
                  <div className="text-xs text-neutral-500 mb-1">
                    {contentPreview}
                  </div>
                  <div className="text-xs text-blue-600">
                    {result.item.url.replace(window.location.origin, '')}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No Results */}
        {showResults && searchValue.length >= 2 && searchResults.length === 0 && !isIndexing && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-md shadow-lg z-50 px-4 py-3">
            <div className="text-sm text-neutral-500">
              No results found for "{searchValue}"
            </div>
          </div>
        )}
      </div>

      {/* Rest of your header... */}
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
                <Link href="/settings/change-password">Change Password</Link>
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