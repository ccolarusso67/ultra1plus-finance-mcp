"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export const COMPANIES = [
  { id: "u1p_ultrachem", name: "U1P Ultrachem", shortCode: "U1P" },
  { id: "u1dynamics", name: "U1Dynamics Manufacturing", shortCode: "U1D" },
  { id: "maxilub", name: "Maxilub", shortCode: "MAX" },
  { id: "italchacao", name: "Italchacao Services", shortCode: "ITC" },
  { id: "timspirit", name: "Timspirit", shortCode: "TSP" },
] as const;

type CompanyContextType = {
  companyId: string;
  setCompanyId: (id: string) => void;
  companyName: string;
};

const CompanyContext = createContext<CompanyContextType>({
  companyId: "u1p_ultrachem",
  setCompanyId: () => {},
  companyName: "U1P Ultrachem",
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyId] = useState("u1p_ultrachem");
  const companyName = COMPANIES.find((c) => c.id === companyId)?.name || companyId;

  return (
    <CompanyContext.Provider value={{ companyId, setCompanyId, companyName }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
