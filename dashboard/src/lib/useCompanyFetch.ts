"use client";

import { useEffect, useState } from "react";
import { useCompany } from "./company";

/**
 * Fetch data from a company-aware API endpoint.
 * Automatically appends company_id and any extra params.
 *
 * @param apiPath - e.g. "/api/overview"
 * @param extraParams - optional additional query params, e.g. { period: "trailing12", days: "90" }
 */
export function useCompanyFetch<T>(
  apiPath: string,
  extraParams?: Record<string, string>
) {
  const { companyId } = useCompany();
  const [data, setData] = useState<T | null>(null);

  // Build a stable key from extra params for the dependency array
  const extraKey = extraParams ? JSON.stringify(extraParams) : "";

  useEffect(() => {
    setData(null);
    const params = new URLSearchParams({ company_id: companyId });
    if (extraParams) {
      Object.entries(extraParams).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
    }
    fetch(`${apiPath}?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setData(d);
        else setData(null);
      })
      .catch(() => setData(null));
  }, [apiPath, companyId, extraKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return data;
}
