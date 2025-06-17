import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, truncateText } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface FeaturedPropertiesProps {
  properties: any[];
}

export function FeaturedProperties({ properties }: FeaturedPropertiesProps) {
  const [_, setLocation] = useLocation();

  if (!properties || properties.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 border border-dashed rounded-lg">
        <p className="text-sm text-muted-foreground">No featured properties</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {properties.map((property) => (
        <div
          key={property.id}
          className="flex items-center border-b border-gray-100 pb-4 last:border-0 last:pb-0"
        >
          <div className="w-12 h-12 rounded-md bg-gray-100 flex-shrink-0 mr-3 overflow-hidden">
            {property.images && property.images.length > 0 ? (
              <img 
                src={Array.isArray(property.images) ? property.images[0] : property.images} 
                alt={property.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">
                {truncateText(property.title, 30)}
              </h4>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                {property.propertyType}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {property.reference}
              </span>
            </div>
            <p className="text-xs font-medium text-primary mt-1">
              {formatCurrency(property.price, property.currency)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/properties/${property.id}`)}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only">View details</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
