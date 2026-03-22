"use client";

import { useEffect, useState } from "react";
import { useCompany } from "./company";

export function useCompanyFetch<T>(apiPath: string) {
  const { companyId } = useCompany();
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`${apiPath}?company_id=${encodeURIComponent(companyId)}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); else setData(null); })
      .catch(() => setData(null));
  }, [apiPath, companyId]);

  return data;
}
