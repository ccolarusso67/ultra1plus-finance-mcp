import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

/* ─── Financial Intelligence Engine ─────────────────────────────────────────
   Analyzes all dashboard data and produces actionable insights, warnings,
   and recommendations. Each insight has:
   - category: revenue | margin | cash | ar | ap | customers | operations
   - severity: critical | warning | info | positive
   - title: short headline
   - detail: explanation with numbers
   - action: recommended next step
   ─────────────────────────────────────────────────────────────────────────── */

interface Insight {
  category: string;
  severity: "critical" | "warning" | "info" | "positive";
  title: string;
  detail: string;
  action: string;
  metric?: string;
  value?: number;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// Safe query wrappers — never throw, return null/[] on error
async function safeQueryOne(text: string, params?: unknown[]): Promise<any> {
  try { return await queryOne(text, params); } catch { return null; }
}
async function safeQuery(text: string, params?: unknown[]): Promise<any[]> {
  try { return await query(text, params); } catch { return []; }
}

export async function GET(request: NextRequest) {
  const companyId =
    request.nextUrl.searchParams.get("company_id") || "u1p_ultrachem";

  try {
    const [
      pnlCurrent,
      pnlPrior,
      pnlTrend,
      arSummary,
      apSummary,
      cashFlow,
      arConcentration,
      overdueAr,
      overdueAp,
      customerDecline,
      marginErosion,
      syncHealth,
      creditHolds,
      reorderAlerts,
      collectionSpeed,
      backlogInfo,
    ] = await Promise.all([
      // Current quarter P&L
      safeQueryOne(
        `SELECT
           COALESCE(SUM(income), 0) AS revenue,
           COALESCE(SUM(cogs), 0) AS cogs,
           COALESCE(SUM(gross_profit), 0) AS gross_profit,
           COALESCE(SUM(net_income), 0) AS net_income,
           CASE WHEN SUM(income) > 0
                THEN ROUND((SUM(gross_profit) / SUM(income) * 100)::numeric, 1) ELSE 0 END AS margin_pct,
           CASE WHEN SUM(income) > 0
                THEN ROUND((SUM(net_income) / SUM(income) * 100)::numeric, 1) ELSE 0 END AS net_margin_pct
         FROM monthly_pnl
         WHERE company_id = $1 AND report_basis = 'accrual'
           AND month >= DATE_TRUNC('quarter', CURRENT_DATE)`,
        [companyId]
      ),

      // Prior quarter P&L
      safeQueryOne(
        `SELECT
           COALESCE(SUM(income), 0) AS revenue,
           COALESCE(SUM(gross_profit), 0) AS gross_profit,
           COALESCE(SUM(net_income), 0) AS net_income,
           CASE WHEN SUM(income) > 0
                THEN ROUND((SUM(gross_profit) / SUM(income) * 100)::numeric, 1) ELSE 0 END AS margin_pct
         FROM monthly_pnl
         WHERE company_id = $1 AND report_basis = 'accrual'
           AND month >= DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')
           AND month < DATE_TRUNC('quarter', CURRENT_DATE)`,
        [companyId]
      ),

      // Last 6 months margin trend
      safeQuery(
        `SELECT TO_CHAR(month, 'Mon YY') AS label, month,
                income AS revenue,
                CASE WHEN income > 0
                     THEN ROUND((gross_profit / income * 100)::numeric, 1) ELSE 0 END AS margin_pct,
                CASE WHEN income > 0
                     THEN ROUND((net_income / income * 100)::numeric, 1) ELSE 0 END AS net_margin_pct
         FROM monthly_pnl
         WHERE company_id = $1 AND report_basis = 'accrual'
           AND month >= CURRENT_DATE - INTERVAL '6 months'
         ORDER BY month ASC`,
        [companyId]
      ),

      // AR summary
      safeQueryOne(
        `SELECT
           COALESCE(SUM(total_open_balance), 0) AS total_ar,
           COALESCE(SUM(current_bucket), 0) AS current_ar,
           COALESCE(SUM(days_1_30), 0) AS ar_1_30,
           COALESCE(SUM(days_31_60), 0) AS ar_31_60,
           COALESCE(SUM(days_61_90), 0) AS ar_61_90,
           COALESCE(SUM(days_91_plus), 0) AS ar_91_plus,
           COUNT(DISTINCT customer_name) AS ar_customer_count
         FROM v_latest_ar_aging WHERE company_id = $1`,
        [companyId]
      ),

      // AP summary
      safeQueryOne(
        `SELECT
           COALESCE(SUM(total_open_balance), 0) AS total_ap,
           COALESCE(SUM(days_31_60), 0) AS ap_31_60,
           COALESCE(SUM(days_61_90), 0) AS ap_61_90,
           COALESCE(SUM(days_91_plus), 0) AS ap_91_plus,
           COUNT(DISTINCT vendor_name) AS ap_vendor_count
         FROM v_latest_ap_aging WHERE company_id = $1`,
        [companyId]
      ),

      // Cash flow: last 30 day collections vs upcoming 30 day bills
      safeQueryOne(
        `SELECT
           (SELECT COALESCE(SUM(amount), 0) FROM payments
            WHERE company_id = $1 AND payment_date >= CURRENT_DATE - 30) AS collections_30d,
           (SELECT COALESCE(SUM(amount), 0) FROM payments
            WHERE company_id = $1 AND payment_date >= CURRENT_DATE - 7) AS collections_7d,
           (SELECT COALESCE(SUM(amount), 0) FROM bills
            WHERE company_id = $1 AND NOT is_paid AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) AS bills_due_30d,
           (SELECT COALESCE(SUM(amount), 0) FROM bills
            WHERE company_id = $1 AND NOT is_paid AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS bills_due_7d,
           (SELECT AVG(amount) FROM payments
            WHERE company_id = $1 AND payment_date >= CURRENT_DATE - 90) AS avg_payment_size,
           (SELECT COUNT(*) FROM payments
            WHERE company_id = $1 AND payment_date >= CURRENT_DATE - 30) AS payment_count_30d`,
        [companyId]
      ),

      // AR concentration: top 5 % of total
      safeQuery(
        `WITH totals AS (
           SELECT COALESCE(SUM(total_open_balance), 0) AS total_ar
           FROM v_latest_ar_aging WHERE company_id = $1
         )
         SELECT a.customer_name,
                a.total_open_balance AS balance,
                CASE WHEN t.total_ar > 0
                     THEN ROUND(a.total_open_balance / t.total_ar * 100, 1) ELSE 0 END AS pct
         FROM v_latest_ar_aging a, totals t
         WHERE a.company_id = $1
         ORDER BY a.total_open_balance DESC LIMIT 5`,
        [companyId]
      ),

      // Overdue AR totals
      safeQueryOne(
        `SELECT
           COUNT(*) AS overdue_invoice_count,
           COALESCE(SUM(balance_remaining), 0) AS overdue_amount
         FROM v_open_invoices
         WHERE company_id = $1 AND days_past_due > 30`,
        [companyId]
      ),

      // Overdue AP
      safeQueryOne(
        `SELECT
           COUNT(*) AS overdue_bill_count,
           COALESCE(SUM(balance_remaining), 0) AS overdue_amount
         FROM (
           SELECT b.balance_remaining
           FROM bills b
           WHERE b.company_id = $1 AND NOT b.is_paid AND b.due_date < CURRENT_DATE
         ) sub`,
        [companyId]
      ),

      // Declining customers
      safeQuery(
        `WITH recent AS (
           SELECT customer_id, SUM(amount) AS recent_rev
           FROM invoices
           WHERE company_id = $1 AND txn_date >= CURRENT_DATE - INTERVAL '6 months'
           GROUP BY customer_id
         ),
         prior AS (
           SELECT customer_id, SUM(amount) AS prior_rev
           FROM invoices
           WHERE company_id = $1
             AND txn_date >= CURRENT_DATE - INTERVAL '12 months'
             AND txn_date < CURRENT_DATE - INTERVAL '6 months'
           GROUP BY customer_id
         )
         SELECT c.full_name, r.recent_rev, p.prior_rev,
                ROUND(((r.recent_rev - p.prior_rev) / NULLIF(p.prior_rev, 0) * 100)::numeric, 1) AS change_pct
         FROM recent r
         JOIN prior p ON p.customer_id = r.customer_id
         JOIN customers c ON c.company_id = $1 AND c.customer_id = r.customer_id
         WHERE p.prior_rev > 10000 AND r.recent_rev < p.prior_rev * 0.7
         ORDER BY (p.prior_rev - r.recent_rev) DESC
         LIMIT 5`,
        [companyId]
      ),

      // Margin erosion (products)
      safeQuery(
        `WITH recent AS (
           SELECT il.item_id,
                  SUM(il.line_total) AS rev,
                  SUM(il.cost * il.quantity) AS cost
           FROM invoice_lines il
           JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.txn_id
           WHERE il.company_id = $1 AND i.txn_date >= CURRENT_DATE - INTERVAL '3 months'
           GROUP BY il.item_id HAVING SUM(il.line_total) > 5000
         ),
         prior AS (
           SELECT il.item_id,
                  SUM(il.line_total) AS rev,
                  SUM(il.cost * il.quantity) AS cost
           FROM invoice_lines il
           JOIN invoices i ON i.company_id = il.company_id AND i.txn_id = il.txn_id
           WHERE il.company_id = $1
             AND i.txn_date >= CURRENT_DATE - INTERVAL '6 months'
             AND i.txn_date < CURRENT_DATE - INTERVAL '3 months'
           GROUP BY il.item_id HAVING SUM(il.line_total) > 5000
         )
         SELECT pc.name AS product,
                ROUND(((r.rev - r.cost) / NULLIF(r.rev, 0) * 100)::numeric, 1) AS current_margin,
                ROUND(((p.rev - p.cost) / NULLIF(p.rev, 0) * 100)::numeric, 1) AS prior_margin
         FROM recent r
         JOIN prior p ON p.item_id = r.item_id
         LEFT JOIN product_catalog pc ON pc.company_id = $1 AND pc.item_id = r.item_id
         WHERE (r.rev - r.cost) / NULLIF(r.rev, 0) < (p.rev - p.cost) / NULLIF(p.rev, 0) - 0.03
         ORDER BY ((p.rev - p.cost) / NULLIF(p.rev, 0)) - ((r.rev - r.cost) / NULLIF(r.rev, 0)) DESC
         LIMIT 5`,
        [companyId]
      ),

      // Sync freshness
      safeQuery(
        `SELECT job_name, status, last_success_at,
                ROUND(EXTRACT(EPOCH FROM (NOW() - last_success_at)) / 3600) AS hours_ago
         FROM sync_status
         WHERE company_id = $1
           AND (last_success_at IS NULL OR NOW() - last_success_at > INTERVAL '24 hours')`,
        [companyId]
      ),

      // Credit holds
      safeQueryOne(
        `SELECT COUNT(*) AS over_limit_count,
                COALESCE(SUM(balance - credit_limit), 0) AS over_limit_amount
         FROM v_credit_status
         WHERE company_id = $1 AND is_over_limit`,
        [companyId]
      ),

      // Reorder alerts
      safeQueryOne(
        `SELECT COUNT(*) AS count
         FROM v_latest_inventory
         WHERE company_id = $1 AND below_reorder`,
        [companyId]
      ),

      // Average collection speed (DSO proxy)
      safeQueryOne(
        `WITH rev AS (
           SELECT COALESCE(SUM(income), 0) / NULLIF(COUNT(*), 0) AS avg_monthly_rev
           FROM monthly_pnl
           WHERE company_id = $1 AND report_basis = 'accrual'
             AND month >= CURRENT_DATE - INTERVAL '3 months'
         )
         SELECT
           CASE WHEN r.avg_monthly_rev > 0
                THEN ROUND((a.total_ar / (r.avg_monthly_rev / 30))::numeric, 0)
                ELSE 0 END AS dso
         FROM (SELECT COALESCE(SUM(total_open_balance), 0) AS total_ar
               FROM v_latest_ar_aging WHERE company_id = $1) a,
              rev r`,
        [companyId]
      ),

      // Backlog info
      safeQueryOne(
        `SELECT
           COALESCE(SUM(amount), 0) AS total_backlog,
           COUNT(*) AS order_count,
           COUNT(*) FILTER (WHERE is_overdue) AS overdue_count
         FROM v_open_sales_orders WHERE company_id = $1`,
        [companyId]
      ),
    ]);

    // ── Build Insights ───────────────────────────────────────────────────

    const insights: Insight[] = [];

    const totalAr = Number(arSummary?.total_ar || 0);
    const ar91 = Number(arSummary?.ar_91_plus || 0);
    const ar61_90 = Number(arSummary?.ar_61_90 || 0);
    const totalAp = Number(apSummary?.total_ap || 0);
    const ap91 = Number(apSummary?.ap_91_plus || 0);
    const collections30 = Number(cashFlow?.collections_30d || 0);
    const billsDue30 = Number(cashFlow?.bills_due_30d || 0);
    const collections7 = Number(cashFlow?.collections_7d || 0);
    const billsDue7 = Number(cashFlow?.bills_due_7d || 0);
    const dso = Number(collectionSpeed?.dso || 0);
    const currentQRevenue = Number(pnlCurrent?.revenue || 0);
    const priorQRevenue = Number(pnlPrior?.revenue || 0);
    const currentMargin = Number(pnlCurrent?.margin_pct || 0);
    const priorMargin = Number(pnlPrior?.margin_pct || 0);
    const netMargin = Number(pnlCurrent?.net_margin_pct || 0);
    const netPosition = totalAr - totalAp;

    // ── REVENUE INSIGHTS ─────────────────────────────────────────────────

    if (priorQRevenue > 0 && currentQRevenue > 0) {
      const revChange = ((currentQRevenue - priorQRevenue) / priorQRevenue) * 100;
      if (revChange > 10) {
        insights.push({
          category: "revenue",
          severity: "positive",
          title: "Revenue Growing",
          detail: `Current quarter revenue is ${fmt(currentQRevenue)}, up ${pct(revChange)} from prior quarter (${fmt(priorQRevenue)}). Growth trajectory is healthy.`,
          action: "Monitor whether growth is coming from new customers or existing account expansion to ensure sustainability.",
          metric: "QoQ Revenue Growth",
          value: revChange,
        });
      } else if (revChange < -10) {
        insights.push({
          category: "revenue",
          severity: "warning",
          title: "Revenue Declining",
          detail: `Current quarter revenue is ${fmt(currentQRevenue)}, down ${pct(Math.abs(revChange))} from prior quarter (${fmt(priorQRevenue)}).`,
          action: "Investigate declining accounts. Check if key customers have reduced orders or if pricing pressure is the cause.",
          metric: "QoQ Revenue Change",
          value: revChange,
        });
      }
    }

    // ── MARGIN INSIGHTS ──────────────────────────────────────────────────

    if (currentMargin > 0) {
      if (currentMargin < 25) {
        insights.push({
          category: "margin",
          severity: "critical",
          title: "Gross Margin Under Pressure",
          detail: `Gross margin at ${pct(currentMargin)} is dangerously low. For a chemical distribution business, margins below 25% leave almost no room for operating expenses.`,
          action: "Review pricing on highest-volume products. Identify which products or customers are dragging margin below cost-recovery levels.",
          metric: "Gross Margin",
          value: currentMargin,
        });
      } else if (currentMargin < 35) {
        insights.push({
          category: "margin",
          severity: "warning",
          title: "Margin Compression",
          detail: `Gross margin at ${pct(currentMargin)} is below the 35% target. ${priorMargin > currentMargin ? `Down from ${pct(priorMargin)} last quarter.` : ""}`,
          action: "Evaluate supplier costs for increases. Consider price adjustments on low-margin products or customers.",
          metric: "Gross Margin",
          value: currentMargin,
        });
      } else if (currentMargin > 40) {
        insights.push({
          category: "margin",
          severity: "positive",
          title: "Strong Gross Margins",
          detail: `Gross margin at ${pct(currentMargin)} indicates healthy pricing power. ${priorMargin > 0 ? `Prior quarter was ${pct(priorMargin)}.` : ""}`,
          action: "Maintain pricing discipline. Watch for competitor undercutting on key product lines.",
          metric: "Gross Margin",
          value: currentMargin,
        });
      }

      if (priorMargin > 0 && currentMargin < priorMargin - 3) {
        insights.push({
          category: "margin",
          severity: "warning",
          title: "Margin Eroding Quarter-Over-Quarter",
          detail: `Gross margin dropped ${pct(priorMargin - currentMargin)} from ${pct(priorMargin)} to ${pct(currentMargin)}. This could indicate rising input costs or pricing concessions.`,
          action: "Run a product-level margin analysis. Identify which SKUs have the largest margin decline and whether it's cost-driven or price-driven.",
        });
      }

      // Net margin insight
      if (netMargin < 5 && netMargin > 0) {
        insights.push({
          category: "margin",
          severity: "warning",
          title: "Thin Net Margins",
          detail: `Net margin at ${pct(netMargin)} leaves little buffer for unexpected costs. A small revenue drop or cost increase could push the company to breakeven.`,
          action: "Review operating expenses for optimization opportunities. Focus on the largest expense categories first.",
          metric: "Net Margin",
          value: netMargin,
        });
      } else if (netMargin < 0) {
        insights.push({
          category: "margin",
          severity: "critical",
          title: "Operating at a Loss",
          detail: `Net margin is ${pct(netMargin)} — the company is losing money. Operating expenses exceed gross profit.`,
          action: "Immediate review of operating costs required. Identify the largest expense drivers and implement cost controls.",
          metric: "Net Margin",
          value: netMargin,
        });
      }
    }

    // ── MARGIN TREND ANALYSIS ────────────────────────────────────────────

    if ((pnlTrend as any[]).length >= 3) {
      const margins = (pnlTrend as any[]).map((r) => Number(r.margin_pct));
      const recent3 = margins.slice(-3);
      const isConsistentlyDeclining =
        recent3.length === 3 && recent3[0] > recent3[1] && recent3[1] > recent3[2];
      if (isConsistentlyDeclining) {
        insights.push({
          category: "margin",
          severity: "warning",
          title: "3-Month Margin Decline Trend",
          detail: `Gross margin has declined for 3 consecutive months: ${recent3.map((m) => pct(m)).join(" → ")}. This pattern suggests systematic cost or pricing pressure.`,
          action: "This is not a one-time event. Investigate whether supplier costs are rising, whether sales is offering deeper discounts, or whether product mix is shifting to lower-margin items.",
        });
      }
    }

    // ── CASH / LIQUIDITY INSIGHTS ────────────────────────────────────────

    if (billsDue30 > 0) {
      const coverageRatio = collections30 / billsDue30;
      if (coverageRatio < 0.8) {
        insights.push({
          category: "cash",
          severity: "critical",
          title: "Cash Coverage Below Safe Level",
          detail: `30-day coverage ratio is ${coverageRatio.toFixed(2)}x — collections (${fmt(collections30)}) are not keeping pace with upcoming bills (${fmt(billsDue30)}). This means a ${fmt(billsDue30 - collections30)} gap.`,
          action: "Accelerate collections on overdue invoices immediately. Consider negotiating extended payment terms with vendors. Review which bills can be deferred without relationship damage.",
          metric: "Coverage Ratio",
          value: coverageRatio,
        });
      } else if (coverageRatio < 1.2) {
        insights.push({
          category: "cash",
          severity: "warning",
          title: "Cash Position Tight",
          detail: `30-day coverage ratio is ${coverageRatio.toFixed(2)}x — barely covering upcoming bills. Collections: ${fmt(collections30)}, Bills due: ${fmt(billsDue30)}.`,
          action: "Monitor weekly. Prioritize collection of largest overdue invoices to create a buffer.",
          metric: "Coverage Ratio",
          value: coverageRatio,
        });
      } else if (coverageRatio > 2.0) {
        insights.push({
          category: "cash",
          severity: "positive",
          title: "Strong Cash Position",
          detail: `30-day coverage ratio is ${coverageRatio.toFixed(2)}x — collections (${fmt(collections30)}) comfortably exceed upcoming bills (${fmt(billsDue30)}).`,
          action: "Consider using excess cash for early payment discounts, inventory stocking on fast-moving items, or accelerating growth investments.",
          metric: "Coverage Ratio",
          value: coverageRatio,
        });
      }
    }

    if (billsDue7 > collections7 && billsDue7 > 10000) {
      insights.push({
        category: "cash",
        severity: "critical",
        title: "7-Day Cash Shortfall",
        detail: `This week: ${fmt(billsDue7)} in bills due but only ${fmt(collections7)} collected. Short-term gap of ${fmt(billsDue7 - collections7)}.`,
        action: "Identify bills that can be deferred this week. Contact top AR accounts for expedited payment. Prioritize collections calls on the largest overdue balances.",
      });
    }

    // ── DSO INSIGHT ──────────────────────────────────────────────────────

    if (dso > 0) {
      if (dso > 60) {
        insights.push({
          category: "ar",
          severity: "critical",
          title: `Days Sales Outstanding: ${dso} Days`,
          detail: `It takes an average of ${dso} days to collect payment. For a distribution business, DSO above 60 significantly constrains working capital and increases bad debt risk.`,
          action: "Implement stricter credit terms for slow-paying accounts. Consider early payment incentives (2/10 net 30). Review collection procedures for bottlenecks.",
          metric: "DSO",
          value: dso,
        });
      } else if (dso > 45) {
        insights.push({
          category: "ar",
          severity: "warning",
          title: `Days Sales Outstanding: ${dso} Days`,
          detail: `Average collection period of ${dso} days is above the typical 30-45 day target. This ties up working capital unnecessarily.`,
          action: "Focus collection efforts on the largest overdue accounts. Review credit terms for new customers.",
          metric: "DSO",
          value: dso,
        });
      } else if (dso <= 35) {
        insights.push({
          category: "ar",
          severity: "positive",
          title: `Efficient Collections: ${dso}-Day DSO`,
          detail: `Average collection period of ${dso} days indicates healthy cash conversion. Money is being collected quickly relative to revenue.`,
          action: "Maintain current collection practices. This is a competitive advantage — protect it.",
          metric: "DSO",
          value: dso,
        });
      }
    }

    // ── AR AGING INSIGHTS ────────────────────────────────────────────────

    if (totalAr > 0) {
      const severelyOverduePct = ((ar91 + ar61_90) / totalAr) * 100;
      if (severelyOverduePct > 20) {
        insights.push({
          category: "ar",
          severity: "critical",
          title: "High Overdue Receivables Exposure",
          detail: `${pct(severelyOverduePct)} of AR (${fmt(ar91 + ar61_90)}) is 61+ days overdue. High levels of severely aged receivables signal collection failures and increase write-off risk.`,
          action: "Escalate collection efforts on 90+ day accounts. Consider putting the worst accounts on credit hold. Evaluate whether reserves for bad debt are adequate.",
        });
      } else if (severelyOverduePct > 10) {
        insights.push({
          category: "ar",
          severity: "warning",
          title: "Overdue AR Needs Attention",
          detail: `${pct(severelyOverduePct)} of AR (${fmt(ar91 + ar61_90)}) is 61+ days overdue. This is manageable but trending toward concerning levels.`,
          action: "Schedule weekly review of 60+ day accounts. Contact each account for payment commitment dates.",
        });
      }

      // Concentration risk
      if ((arConcentration as any[]).length > 0) {
        const top3Pct = (arConcentration as any[])
          .slice(0, 3)
          .reduce((s: number, r: any) => s + Number(r.pct || 0), 0);
        if (top3Pct > 50) {
          const topNames = (arConcentration as any[])
            .slice(0, 3)
            .map((r: any) => r.customer_name)
            .join(", ");
          insights.push({
            category: "ar",
            severity: "warning",
            title: "AR Concentration Risk",
            detail: `Top 3 customers represent ${pct(top3Pct)} of all receivables (${topNames}). A payment delay or default from any of these would significantly impact cash flow.`,
            action: "Diversify the customer base if possible. Monitor these accounts closely. Ensure credit limits are appropriate. Consider credit insurance for the largest exposures.",
          });
        }
      }
    }

    // ── AP INSIGHTS ──────────────────────────────────────────────────────

    const overdueApAmt = Number(overdueAp?.overdue_amount || 0);
    if (overdueApAmt > 50000) {
      insights.push({
        category: "ap",
        severity: "warning",
        title: "Significant Overdue Payables",
        detail: `${fmt(overdueApAmt)} in bills are past due. Late payments damage vendor relationships and may result in losing favorable terms, credit holds, or supply disruptions.`,
        action: "Prioritize payments to strategic vendors. Negotiate payment plans for the largest balances. Protect relationships with key suppliers.",
      });
    }

    if (ap91 > 100000) {
      insights.push({
        category: "ap",
        severity: "critical",
        title: "Severely Aged Payables",
        detail: `${fmt(ap91)} in payables are 91+ days overdue. This level of delinquency risks vendor account closures, legal action, and supply chain disruption.`,
        action: "Immediate vendor outreach required. Negotiate settlements or payment plans. Budget for these obligations in the next 30-60 days.",
      });
    }

    // ── WORKING CAPITAL INSIGHT ──────────────────────────────────────────

    if (netPosition > 0 && totalAr > 0) {
      insights.push({
        category: "cash",
        severity: netPosition > totalAr * 0.5 ? "positive" : "info",
        title: `Net Working Capital: ${fmt(netPosition)}`,
        detail: `AR (${fmt(totalAr)}) exceeds AP (${fmt(totalAp)}) by ${fmt(netPosition)}. ${netPosition > totalAr * 0.3 ? "This provides a comfortable liquidity buffer." : "The buffer is moderate — a collection slowdown could tighten cash."}`,
        action:
          netPosition > totalAr * 0.3
            ? "Healthy position. Monitor for changes in collection speed or payment obligations."
            : "Consider building additional liquidity reserves. Watch for seasonal cash demands.",
        metric: "Net Working Capital",
        value: netPosition,
      });
    } else if (netPosition < 0) {
      insights.push({
        category: "cash",
        severity: "critical",
        title: "Negative Working Capital",
        detail: `AP (${fmt(totalAp)}) exceeds AR (${fmt(totalAr)}) by ${fmt(Math.abs(netPosition))}. The company owes more than it's owed — a cash flow risk.`,
        action: "This requires attention. Accelerate collections, extend vendor terms where possible, and monitor weekly cash flow forecasts.",
        metric: "Net Working Capital",
        value: netPosition,
      });
    }

    // ── CUSTOMER INSIGHTS ────────────────────────────────────────────────

    const decliningCount = (customerDecline as any[]).length;
    if (decliningCount > 0) {
      const topDecline = (customerDecline as any[])[0];
      insights.push({
        category: "customers",
        severity: decliningCount >= 3 ? "warning" : "info",
        title: `${decliningCount} Customer${decliningCount > 1 ? "s" : ""} Declining`,
        detail: `${decliningCount} significant customer${decliningCount > 1 ? "s have" : " has"} declined 30%+ in the last 6 months. Largest decline: ${topDecline?.full_name} (${pct(Math.abs(Number(topDecline?.change_pct || 0)))} drop).`,
        action: "Schedule account reviews with sales team. Understand whether decline is due to market conditions, competitor activity, or service issues. Develop win-back strategies for recoverable accounts.",
      });
    }

    // ── PRODUCT MARGIN EROSION ───────────────────────────────────────────

    const erosionCount = (marginErosion as any[]).length;
    if (erosionCount > 0) {
      const topErosion = (marginErosion as any[])[0];
      insights.push({
        category: "margin",
        severity: erosionCount >= 3 ? "warning" : "info",
        title: `${erosionCount} Product${erosionCount > 1 ? "s" : ""} with Margin Erosion`,
        detail: `${erosionCount} product${erosionCount > 1 ? "s have" : " has"} seen margins drop 3+ points. Example: ${topErosion?.product || "Unknown"} went from ${pct(Number(topErosion?.prior_margin || 0))} to ${pct(Number(topErosion?.current_margin || 0))}.`,
        action: "Review supplier invoices for cost increases on these products. Evaluate whether price increases can be passed through without losing volume. Consider substituting or renegotiating with suppliers.",
      });
    }

    // ── CREDIT HOLDS ─────────────────────────────────────────────────────

    const overLimitCount = Number(creditHolds?.over_limit_count || 0);
    if (overLimitCount > 0) {
      insights.push({
        category: "ar",
        severity: "warning",
        title: `${overLimitCount} Customer${overLimitCount > 1 ? "s" : ""} Over Credit Limit`,
        detail: `${overLimitCount} customer${overLimitCount > 1 ? "s are" : " is"} over credit limit by a total of ${fmt(Number(creditHolds?.over_limit_amount || 0))}. Continuing to sell to over-limit customers increases bad debt exposure.`,
        action: "Review each over-limit account. Either collect outstanding balances before shipping new orders, or formally approve credit limit increases if justified by payment history.",
      });
    }

    // ── INVENTORY ALERTS ─────────────────────────────────────────────────

    const belowReorderCount = Number(reorderAlerts?.count || 0);
    if (belowReorderCount > 5) {
      insights.push({
        category: "operations",
        severity: "warning",
        title: `${belowReorderCount} Items Below Reorder Point`,
        detail: `${belowReorderCount} inventory items have fallen below their reorder point. This creates stockout risk and could delay order fulfillment.`,
        action: "Generate purchase orders for below-reorder items. Prioritize items with open sales orders attached. Review whether reorder points need adjustment for seasonal demand.",
      });
    }

    // ── BACKLOG INSIGHTS ─────────────────────────────────────────────────

    const backlogValue = Number(backlogInfo?.total_backlog || 0);
    const overdueOrders = Number(backlogInfo?.overdue_count || 0);
    if (overdueOrders > 0 && backlogValue > 0) {
      insights.push({
        category: "operations",
        severity: overdueOrders > 5 ? "warning" : "info",
        title: `${overdueOrders} Overdue Sales Orders`,
        detail: `${overdueOrders} out of ${backlogInfo?.order_count || 0} open orders are past their expected ship date. Total backlog: ${fmt(backlogValue)}. Overdue orders risk customer dissatisfaction and cancellations.`,
        action: "Review overdue orders with operations. Identify whether delays are inventory-related, production-related, or shipping-related. Communicate updated timelines to affected customers.",
      });
    }

    // ── SYNC / DATA FRESHNESS ────────────────────────────────────────────

    const staleJobs = (syncHealth as any[]).length;
    if (staleJobs > 0) {
      const jobNames = (syncHealth as any[])
        .slice(0, 3)
        .map((r: any) => r.job_name)
        .join(", ");
      insights.push({
        category: "operations",
        severity: staleJobs > 3 ? "warning" : "info",
        title: `${staleJobs} Stale Data Source${staleJobs > 1 ? "s" : ""}`,
        detail: `${staleJobs} sync job${staleJobs > 1 ? "s are" : " is"} over 24 hours old: ${jobNames}${staleJobs > 3 ? "..." : ""}. Dashboard numbers may not reflect the latest QuickBooks data.`,
        action: "Check the Windows connector service status. Review sync logs for errors. Numbers shown are from the last successful sync.",
      });
    }

    // ── COMPUTE FINANCIAL HEALTH SCORE ───────────────────────────────────

    let healthScore = 70; // Base score
    for (const insight of insights) {
      if (insight.severity === "critical") healthScore -= 12;
      else if (insight.severity === "warning") healthScore -= 5;
      else if (insight.severity === "positive") healthScore += 5;
    }
    healthScore = Math.max(0, Math.min(100, healthScore));

    let healthGrade: string;
    let healthLabel: string;
    if (healthScore >= 85) { healthGrade = "A"; healthLabel = "Excellent"; }
    else if (healthScore >= 70) { healthGrade = "B"; healthLabel = "Good"; }
    else if (healthScore >= 55) { healthGrade = "C"; healthLabel = "Fair"; }
    else if (healthScore >= 40) { healthGrade = "D"; healthLabel = "Needs Attention"; }
    else { healthGrade = "F"; healthLabel = "Critical"; }

    // Sort: critical first, then warning, then info, then positive
    const severityOrder = { critical: 0, warning: 1, info: 2, positive: 3 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({
      healthScore,
      healthGrade,
      healthLabel,
      insightCount: {
        total: insights.length,
        critical: insights.filter((i) => i.severity === "critical").length,
        warning: insights.filter((i) => i.severity === "warning").length,
        info: insights.filter((i) => i.severity === "info").length,
        positive: insights.filter((i) => i.severity === "positive").length,
      },
      insights,
      keyMetrics: {
        dso,
        grossMargin: currentMargin,
        netMargin,
        coverageRatio: billsDue30 > 0 ? Math.round((collections30 / billsDue30) * 100) / 100 : null,
        netWorkingCapital: netPosition,
        totalAr,
        totalAp,
        ar91Plus: ar91,
        revenue: currentQRevenue,
        revenueChange: priorQRevenue > 0
          ? Math.round(((currentQRevenue - priorQRevenue) / priorQRevenue) * 1000) / 10
          : null,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
