import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

export function DataTableViewOptions<TData>({ table }: { table: Table<TData> }) {
  return (
    <div className="flex items-center">
      <Button variant="outline" className="h-7 px-3 text-xs">
        View
      </Button>
    </div>
  );
}