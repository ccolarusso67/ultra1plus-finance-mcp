/* ─── Shared Period Utilities ──────────────────────────────────────────────
   Used by all API endpoints and the PeriodSelector component.
   Supports: trailing months, individual months, quarters, full years.
   ─────────────────────────────────────────────────────────────────────────── */

export interface ParsedPeriod {
  start: string;
  end: string;
  label: string;
}

/**
 * Parse a period string into date range.
 * Formats:
 *   trailing6, trailing12, trailing24  — rolling windows
 *   2025-03                            — individual month (YYYY-MM)
 *   2025Q1                             — quarter
 *   2025                               — full year
 */
export function parsePeriod(period: string): ParsedPeriod {
  // Individual month: 2025-03
  const mMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (mMatch) {
    const year = parseInt(mMatch[1]);
    const month = parseInt(mMatch[2]);
    const lastDay = new Date(year, month, 0).getDate();
    const start = `${year}-${mMatch[2]}-01`;
    const end = `${year}-${mMatch[2]}-${String(lastDay).padStart(2, "0")}`;
    const label = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { start, end, label };
  }

  // Quarter: 2025Q4
  const qMatch = period.match(/^(\d{4})Q([1-4])$/);
  if (qMatch) {
    const year = parseInt(qMatch[1]);
    const q = parseInt(qMatch[2]);
    const startMonth = (q - 1) * 3 + 1;
    const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
    const endDate = new Date(year, startMonth + 2, 0);
    const end = `${year}-${String(startMonth + 2).padStart(2, "0")}-${endDate.getDate()}`;
    return { start, end, label: `${year} Q${q}` };
  }

  // Full year: 2025
  const yMatch = period.match(/^(\d{4})$/);
  if (yMatch) {
    return { start: `${yMatch[1]}-01-01`, end: `${yMatch[1]}-12-31`, label: yMatch[1] };
  }

  // Trailing months: trailing6, trailing12, trailing24
  const tMatch = period.match(/^trailing(\d+)$/);
  if (tMatch) {
    const months = parseInt(tMatch[1]);
    return {
      start: `CURRENT_DATE - INTERVAL '${months} months'`,
      end: `CURRENT_DATE`,
      label: `Last ${months} months`,
    };
  }

  // Default: trailing 12
  return {
    start: `CURRENT_DATE - INTERVAL '12 months'`,
    end: `CURRENT_DATE`,
    label: "Last 12 months",
  };
}

export function isTrailing(period: string): boolean {
  return period.startsWith("trailing") || (!period.match(/^\d{4}Q[1-4]$/) && !period.match(/^\d{4}$/) && !period.match(/^\d{4}-\d{2}$/));
}

/**
 * Build SQL date filter clause.
 * For trailing periods: uses INTERVAL expressions
 * For fixed periods: uses date literals
 */
export function buildDateFilter(period: string, dateColumn: string, paramOffset: number = 1): {
  sql: string;
  params: string[];
} {
  const p = parsePeriod(period);
  if (isTrailing(period)) {
    return {
      sql: `${dateColumn} >= ${p.start} AND ${dateColumn} <= ${p.end}`,
      params: [],
    };
  }
  return {
    sql: `${dateColumn} >= $${paramOffset + 1}::date AND ${dateColumn} <= $${paramOffset + 2}::date`,
    params: [p.start, p.end],
  };
}

/**
 * Generate list of available months, quarters, and years from data range.
 */
export function generateAvailablePeriods(startYear: number = 2022): {
  months: { value: string; label: string }[];
  quarters: { value: string; label: string }[];
  years: { value: string; label: string }[];
} {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  const months: { value: string; label: string }[] = [];
  const quarters: { value: string; label: string }[] = [];
  const years: { value: string; label: string }[] = [];

  for (let y = currentYear; y >= startYear; y--) {
    // Years (only completed years)
    if (y < currentYear) {
      years.push({ value: String(y), label: String(y) });
    }

    // Quarters
    const maxQ = y === currentYear ? currentQuarter : 4;
    for (let q = maxQ; q >= 1; q--) {
      // Skip current open quarter
      if (y === currentYear && q === currentQuarter) continue;
      quarters.push({ value: `${y}Q${q}`, label: `${y} Q${q}` });
    }

    // Months
    const maxM = y === currentYear ? currentMonth : 12;
    for (let m = maxM; m >= 1; m--) {
      // Skip current open month
      if (y === currentYear && m === currentMonth) continue;
      const monthStr = String(m).padStart(2, "0");
      const label = new Date(y, m - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      months.push({ value: `${y}-${monthStr}`, label });
    }
  }

  return { months, quarters, years };
}
