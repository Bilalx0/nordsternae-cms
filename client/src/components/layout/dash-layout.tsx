import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ReactNode } from "react";

interface DashLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function DashLayout({ children, title, description }: DashLayoutProps) {
  return (
    <div className="flex bg-neutral-50 overflow-auto">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden md:ml-64">
        {/* Header */}
        <Header />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
            {(title || description) && (
              <div className="mb-6">
                {title && <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>}
                {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
