import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUp, AlertCircle } from "lucide-react";

interface CSVUploadProps {
  onUpload: (data: any[]) => void;
  onError: (message: string) => void;
  accept?: string;
  maxSize?: number; // in bytes
}

export function CSVUpload({
  onUpload,
  onError,
  accept = ".csv",
  maxSize = 10 * 1024 * 1024, // 10MB default
}: CSVUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (!selectedFile) {
      return;
    }
    
    // File size validation
    if (selectedFile.size > maxSize) {
      setError(`File size exceeds the maximum allowed size (${Math.round(maxSize / 1024 / 1024)}MB)`);
      return;
    }
    
    // File type validation
    if (!selectedFile.name.endsWith('.csv')) {
      setError('Only CSV files are allowed');
      return;
    }
    
    setFile(selectedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const csvContent = event.target?.result as string;
        
        if (!csvContent) {
          throw new Error('Failed to read file content');
        }
        
        // Simple CSV parsing (in a real app, use a robust CSV parser)
        const lines = csvContent.split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        
        const data = lines.slice(1)
          .filter(line => line.trim() !== '')
          .map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, i) => {
              obj[header] = values[i]?.trim() || '';
              return obj;
            }, {} as Record<string, string>);
          });
        
        onUpload(data);
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      
      reader.onerror = () => {
        throw new Error('Error reading file');
      };
      
      reader.readAsText(file);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process CSV file';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid w-full max-w-sm items-center gap-1.5">
        <Label htmlFor="csv-upload">Upload CSV</Label>
        <Input
          ref={fileInputRef}
          id="csv-upload"
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="cursor-pointer"
        />
        {file && (
          <p className="text-sm text-muted-foreground">
            Selected: {file.name} ({Math.round(file.size / 1024)} KB)
          </p>
        )}
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Button
        onClick={handleUpload}
        disabled={!file || isLoading}
        className="flex items-center gap-2"
      >
        <FileUp className="h-4 w-4" />
        {isLoading ? 'Processing...' : 'Upload'}
      </Button>
    </div>
  );
}
