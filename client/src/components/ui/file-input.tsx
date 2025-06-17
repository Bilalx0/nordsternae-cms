import { useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileUp, X, Image } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileInputProps {
  label: string;
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  className?: string;
}

export function FileInput({
  label,
  value,
  onChange,
  accept = "image/*",
  multiple = false,
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024, // 5MB default
  className,
}: FileInputProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fileUrls = Array.isArray(value) ? value : value ? [value] : [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Validate number of files
    if (multiple && files.length > maxFiles) {
      setError(`You can only upload up to ${maxFiles} files`);
      return;
    }

    // Validate file sizes
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > maxSize) {
        setError(`File ${files[i].name} exceeds the maximum allowed size (${Math.round(maxSize / 1024 / 1024)}MB)`);
        return;
      }
    }

    setError(null);
    setIsUploading(true);
    setProgress(10); // Start progress

    try {
      // Simulate file upload (in a real app, upload to a server)
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(50);

      // Process files
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Create a data URL (for demo purposes)
        // In a real app, upload to server and get back URLs
        const reader = new FileReader();
        const url = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        urls.push(url);
        setProgress(50 + Math.floor((i + 1) / files.length * 50));
      }

      // Update value
      if (multiple) {
        onChange([...fileUrls, ...urls]);
      } else {
        onChange(urls[0]);
      }

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (err) {
      setError('Failed to upload file(s)');
      console.error(err);
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const removeFile = (index: number) => {
    if (Array.isArray(value)) {
      const newValue = [...value];
      newValue.splice(index, 1);
      onChange(newValue);
    } else {
      onChange('');
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor={`file-input-${label}`}>{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            id={`file-input-${label}`}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileChange}
            disabled={isUploading}
            className="cursor-pointer"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            <FileUp className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {isUploading && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">Uploading... {progress}%</p>
          </div>
        )}
      </div>

      {fileUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {fileUrls.map((url, index) => (
            <div key={index} className="group relative rounded-md border border-border overflow-hidden">
              {url.startsWith('data:image') || url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                <img src={url} alt="" className="h-24 w-full object-cover" />
              ) : (
                <div className="flex h-24 w-full items-center justify-center bg-muted">
                  <Image className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
