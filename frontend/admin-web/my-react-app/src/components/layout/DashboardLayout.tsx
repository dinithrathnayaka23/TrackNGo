import type { ReactNode } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

type DashboardLayoutProps = {
  children: ReactNode;
  title: string;
  breadcrumb?: string[];
};

function DashboardLayout({ children, title, breadcrumb }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar title={title} breadcrumb={breadcrumb} />
          <main className="flex-1 px-8 py-6">
            <div className="mx-auto w-full max-w-[1200px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
