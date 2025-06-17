import { Table } from "@tanstack/react-table";
import { X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  filterableColumns?: {
    id: string;
    title: string;
    options: { label: string; value: string }[];
  }[];
  searchableColumns?: {
    id: string;
    title: string;
  }[];
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
}

export function DataTableToolbar<TData>({
  table,
  filterableColumns = [],
  searchableColumns = [],
  globalFilter,
  setGlobalFilter,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0 || globalFilter !== "";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-card">
      <div className="flex w-full sm:w-auto items-center gap-2">
        {searchableColumns.length > 0 && (
          <div className="flex w-full items-center space-x-2">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full pl-8"
              />
              {globalFilter && (
                <X
                  className="absolute right-2 top-2.5 h-4 w-4 cursor-pointer text-muted-foreground"
                  onClick={() => setGlobalFilter("")}
                />
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filterableColumns.length > 0 &&
          filterableColumns.map(
            (column) =>
              table.getColumn(column.id) && (
                <DataTableFacetedFilter
                  key={column.id}
                  column={table.getColumn(column.id)}
                  title={column.title}
                  options={column.options}
                />
              )
          )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              setGlobalFilter("");
            }}
            className="h-8 px-2 lg:px-3"
          >
            Clear
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function DataTableFacetedFilter<TData>({
  column,
  title,
  options,
}: {
  column: any;
  title: string;
  options: { label: string; value: string }[];
}) {
  const facets = column?.getFacetedUniqueValues();
  const selectedValues = new Set(column?.getFilterValue() as string[]);

  return (
    <div className="relative">
      <select
        className="h-8 px-3 py-1 rounded-md border border-input bg-transparent text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        value={selectedValues.size > 0 ? Array.from(selectedValues)[0] : ""}
        onChange={(e) => {
          if (e.target.value === "") {
            column?.setFilterValue(undefined);
          } else {
            column?.setFilterValue([e.target.value]);
          }
        }}
      >
        <option value="">{title}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}


