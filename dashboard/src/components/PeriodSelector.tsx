"use client";

import { Calendar } from "lucide-react";
import { useMemo } from "react";
import { generateAvailablePeriods } from "@/lib/periods";

interface PeriodSelectorProps {
  value: string;
  onChange: (period: string) => void;
  /** Whether to include current (incomplete) month/quarter in options */
  includeCurrent?: boolean;
  onIncludeCurrentChange?: (include: boolean) => void;
  /** Show trailing month options (default: true) */
  showTrailing?: boolean;
  /** Show individual month options (default: true) */
  showMonths?: boolean;
  /** Show quarter options (default: true) */
  showQuarters?: boolean;
  /** Show full year options (default: true) */
  showYears?: boolean;
  /** Compact mode — smaller text (default: false) */
  compact?: boolean;
  /** Earliest year to show (default: 2022) */
  startYear?: number;
}

export default function PeriodSelector({
  value,
  onChange,
  includeCurrent = false,
  onIncludeCurrentChange,
  showTrailing = true,
  showMonths = true,
  showQuarters = true,
  showYears = true,
  compact = false,
  startYear = 2022,
}: PeriodSelectorProps) {
  const { months, quarters, years } = useMemo(
    () => generateAvailablePeriods(startYear, includeCurrent),
    [startYear, includeCurrent]
  );

  return (
    <div className="flex items-center gap-3">
      {/* Include current month toggle */}
      {onIncludeCurrentChange && (
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeCurrent}
            onChange={(e) => onIncludeCurrentChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 text-[#0098DB] focus:ring-[#0098DB] cursor-pointer"
          />
          <span className={`text-gray-500 whitespace-nowrap ${compact ? "text-[10px]" : "text-[11px]"}`}>
            Incl. current month
          </span>
        </label>
      )}

      <div className="flex items-center gap-2">
        <Calendar size={compact ? 12 : 14} className="text-gray-400" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`border border-gray-200 rounded px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-[#0098DB] cursor-pointer ${
            compact ? "text-[11px]" : "text-[13px]"
          }`}
        >
          {showTrailing && (
            <optgroup label="Rolling (completed months)">
              <option value="trailing3">Last 3 months</option>
              <option value="trailing6">Last 6 months</option>
              <option value="trailing12">Last 12 months</option>
              <option value="trailing24">Last 24 months</option>
            </optgroup>
          )}
          {showMonths && months.length > 0 && (
            <optgroup label="Month">
              {months.slice(0, 24).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          )}
          {showQuarters && quarters.length > 0 && (
            <optgroup label="Quarter">
              {quarters.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </optgroup>
          )}
          {showYears && years.length > 0 && (
            <optgroup label="Full Year">
              {years.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
    </div>
  );
}
