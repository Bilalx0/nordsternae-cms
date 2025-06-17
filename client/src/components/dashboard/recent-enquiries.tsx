import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface RecentEnquiriesProps {
  enquiries: any[];
}

export function RecentEnquiries({ enquiries }: RecentEnquiriesProps) {
  const [_, setLocation] = useLocation();

  if (!enquiries || enquiries.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 border border-dashed rounded-lg">
        <p className="text-sm text-muted-foreground">No recent enquiries</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {enquiries.map((enquiry) => (
        <div
          key={enquiry.id}
          className="flex items-center border-b border-gray-100 pb-4 last:border-0 last:pb-0"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">
                {enquiry.name || enquiry.email || "Anonymous"}
              </h4>
              {!enquiry.isRead && (
                <Badge variant="secondary" className="text-xs">New</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {enquiry.subject || "General Enquiry"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(enquiry.createdAt)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/enquiries/${enquiry.id}`)}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only">View details</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
