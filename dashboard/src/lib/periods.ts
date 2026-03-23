/* ─── Shared Period Utilities ──────────────────────────────────────────────
   Used by all API endpoints and the PeriodSelector component.
   Supports: trailing months, individual months, quarters, full years.

   Key rule: trailing periods EXCLUDE the current (incomplete) month by
   default. When includeCurrent=true, the end date extends to CURRENT_DATE.
   ─────────────────────────────────────────────────────────────────────────── */

export interface ParsedPeriod {
  start: string;
  end: string;
  label: string;
  isPartial: boolean; // true if the period includes incomplete data
}

/**
 * Parse a period string into date range.
 *
 * @param period - e.g. "trailing12", "2025-03", "2025Q1", "2025"
 * @param includeCurrent - if true, trailing periods end at CURRENT_DATE
 *                         instead of end of prior month. Also allows
 *                         selecting the current open month/quarter.
 */
export function parsePeriod(period: string, includeCurrent = false): ParsedPeriod {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);

  // Individual month: 2025-03
  const mMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (mMatch) {
    const year = parseInt(mMatch[1]);
    const month = parseInt(mMatch[2]);
    const lastDay = new Date(year, month, 0).getDate();
    const start = `${year}-${mMatch[2]}-01`;
    const end = `${year}-${mMatch[2]}-${String(lastDay).padStart(2, "0")}`;
    const label = new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const isPartial = year === currentYear && month === currentMonth;
    return { start, end, label: isPartial ? `${label} (in progress)` : label, isPartial };
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
    const isPartial = year === currentYear && q === currentQuarter;
    return { start, end, label: isPartial ? `${year} Q${q} (in progress)` : `${year} Q${q}`, isPartial };
  }

  // Full year: 2025
  const yMatch = period.match(/^(\d{4})$/);
  if (yMatch) {
    const year = parseInt(yMatch[1]);
    const isPartial = year === currentYear;
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      label: isPartial ? `${year} (in progress)` : String(year),
      isPartial,
    };
  }

  // Trailing months: trailing6, trailing12, trailing24
  const tMatch = period.match(/^trailing(\d+)$/);
  if (tMatch) {
    const months = parseInt(tMatch[1]);
    if (includeCurrent) {
      // Include current incomplete month — start N months ago, end today
      return {
        start: `CURRENT_DATE - INTERVAL '${months} months'`,
        end: `CURRENT_DATE`,
        label: `Last ${months} months (incl. current)`,
        isPartial: true,
      };
    }
    // Exclude current month — end at last day of prior month
    return {
      start: `DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '${months} months'`,
      end: `DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day'`,
      label: `Last ${months} completed months`,
      isPartial: false,
    };
  }

  // Default: trailing 12 completed months
  return {
    start: `DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '12 months'`,
    end: `DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day'`,
    label: "Last 12 completed months",
    isPartial: false,
  };
}

export function isTrailing(period: string): boolean {
  return period.startsWith("trailing") || (!period.match(/^\d{4}Q[1-4]$/) && !period.match(/^\d{4}$/) && !period.match(/^\d{4}-\d{2}$/));
}

/**
 * Generate list of available months, quarters, and years.
 * When includeCurrent=true, also includes the current open month/quarter/year.
 */
export function generateAvailablePeriods(startYear: number = 2022, includeCurrent = false): {
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
    // Years
    if (y < currentYear) {
      years.push({ value: String(y), label: String(y) });
    } else if (y === currentYear && includeCurrent) {
      years.push({ value: String(y), label: `${y} (in progress)` });
    }

    // Quarters
    const maxQ = y === currentYear ? currentQuarter : 4;
    for (let q = maxQ; q >= 1; q--) {
      const isCurrent = y === currentYear && q === currentQuarter;
      if (isCurrent && !includeCurrent) continue;
      quarters.push({
        value: `${y}Q${q}`,
        label: isCurrent ? `${y} Q${q} (in progress)` : `${y} Q${q}`,
      });
    }

    // Months
    const maxM = y === currentYear ? currentMonth : 12;
    for (let m = maxM; m >= 1; m--) {
      const isCurrent = y === currentYear && m === currentMonth;
      if (isCurrent && !includeCurrent) continue;
      const monthStr = String(m).padStart(2, "0");
      const label = new Date(y, m - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      months.push({
        value: `${y}-${monthStr}`,
        label: isCurrent ? `${label} (in progress)` : label,
      });
    }
  }

  return { months, quarters, years };
}
