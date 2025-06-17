import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency values
export function formatCurrency(
  value: number | undefined,
  currency = "AED",
  locale = "en-AE"
): string {
  if (value === undefined) return "";
  
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format date to locale string
export function formatDate(
  date: string | Date | undefined,
  options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }
): string {
  if (!date) return "";
  
  const dateObj = typeof date === "string" ? new Date(date) : date;
  
  return dateObj.toLocaleDateString("en-AE", options);
}

// Parse CSV string to array of objects
export function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.split("\n");
  const headers = lines[0].split(",").map(header => header.trim());
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const obj: Record<string, string> = {};
    const currentLine = lines[i].split(",");

    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentLine[j]?.trim() || "";
    }

    result.push(obj);
  }

  return result;
}

// Convert array of objects to CSV string
export function objectsToCSV(data: Record<string, any>[]): string {
  if (data.length === 0) return "";
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add header row
  csvRows.push(headers.join(","));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      
      // Handle different data types
      if (val === null || val === undefined) return "";
      if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
      if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      
      return val;
    });
    
    csvRows.push(values.join(","));
  }
  
  return csvRows.join("\n");
}

// Convert boolean to Yes/No string
export function booleanToYesNo(value: boolean | undefined): string {
  if (value === undefined) return "";
  return value ? "Yes" : "No";
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Extract image URL from data URI or URL string
export function getImageUrl(src: string | undefined): string {
  if (!src) return "";
  
  // If it's already a URL, return it
  if (src.startsWith("http")) {
    return src;
  }
  
  // If it's a data URI, return it
  if (src.startsWith("data:")) {
    return src;
  }
  
  // Otherwise, consider it a relative path
  return src;
}

// Safely parse JSON string
export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString) return fallback;
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return fallback;
  }
}

// Generate a slug from text
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

// Download data as CSV file
export function downloadCSV(data: string, filename: string): void {
  const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
