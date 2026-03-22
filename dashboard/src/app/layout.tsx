import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { CompanyProvider } from "@/lib/company";

export const metadata: Metadata = {
  title: "Ultra1Plus Finance Dashboard",
  description: "Financial reporting and business intelligence for Ultra1Plus",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CompanyProvider>
          <Sidebar />
          <div className="lg:ml-64 min-h-screen">
            {/* Top Header Bar */}
            <header className="h-12 border-b border-[#E0E0E0] bg-white flex items-center px-6">
              <span className="text-[11px] uppercase tracking-[0.15em] font-medium text-[#5F6368]">
                Ultra1Plus Financial Intelligence
              </span>
            </header>
            <main className="p-6">{children}</main>
          </div>
        </CompanyProvider>
      </body>
    </html>
  );
}
