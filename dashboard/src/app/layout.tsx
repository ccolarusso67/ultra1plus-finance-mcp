import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { CompanyProvider } from "@/lib/company";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <CompanyProvider>
          <Sidebar />
          <div className="lg:ml-64 min-h-screen">
            {/* Top Header Bar */}
            <header className="h-12 border-b border-border bg-card flex items-center px-6">
              <span className="text-[11px] uppercase tracking-[0.15em] font-medium text-muted-foreground">
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
