"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Package,
  FileText,
  CreditCard,
  Warehouse,
  ClipboardList,
  Activity,
  Building2,
  Banknote,
  Brain,
} from "lucide-react";
import { useCompany, COMPANIES } from "@/lib/company";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/insights", label: "Financial Intelligence", icon: Brain },
  { href: "/revenue", label: "Revenue & P&L", icon: TrendingUp },
  { href: "/cash", label: "Operational Cash", icon: Banknote },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/products", label: "Products", icon: Package },
  { href: "/receivables", label: "Receivables", icon: FileText },
  { href: "/payables", label: "Payables", icon: CreditCard },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/orders", label: "Sales Orders", icon: ClipboardList },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { companyId, setCompanyId } = useCompany();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0C2340] text-white flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#1A3A60]">
        <h1 className="text-lg font-semibold tracking-tight">
          <span className="text-[#0098DB]">Ultra1Plus</span>{" "}
          <span className="text-white/90 font-normal">Finance</span>
        </h1>
        <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mt-1">Financial Dashboard</p>
      </div>

      {/* Company Selector */}
      <div className="px-4 py-3 border-b border-[#1A3A60]">
        <div className="flex items-center gap-2 mb-1.5">
          <Building2 size={12} className="text-white/40" />
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-medium">Company</span>
        </div>
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="w-full bg-[#1A3A60] text-white/90 text-[13px] font-medium px-2.5 py-1.5 rounded border border-[#2A4A70] focus:outline-none focus:border-[#0098DB] cursor-pointer"
        >
          {COMPANIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.shortCode} — {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-[13px] font-medium transition-colors ${
                isActive
                  ? "border-l-2 border-[#0098DB] bg-white/[0.06] text-white ml-0 pl-[10px]"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04] border-l-2 border-transparent pl-[10px]"
              }`}
            >
              <Icon size={16} strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sync Status */}
      <div className="px-4 py-3 border-t border-[#1A3A60]">
        <Link
          href="/sync"
          className={`flex items-center gap-2 text-[11px] transition-colors ${
            pathname === "/sync"
              ? "text-[#0098DB]"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          <Activity size={12} />
          Data Sync Status
        </Link>
      </div>
    </aside>
  );
}
