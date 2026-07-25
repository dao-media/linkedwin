"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PeriodChips } from "@/components/PeriodChips";
import type { TrendsSeriesPoint } from "@/lib/trends-shared";
import type { TrendsPeriodId } from "@/lib/trends-periods";
import { formatCompactNumber } from "@/lib/calendar-format";

export function TrendsChartCard({
  title,
  subtitle,
  periods,
  period,
  onPeriodChange,
  series,
  valueSuffix = "",
  formatValue,
}: {
  title: string;
  subtitle?: string;
  periods: { id: TrendsPeriodId; label: string }[];
  period: TrendsPeriodId;
  onPeriodChange: (id: TrendsPeriodId) => void;
  series: TrendsSeriesPoint[];
  valueSuffix?: string;
  formatValue?: (n: number) => string;
}) {
  const fmt = formatValue ?? ((n: number) => `${formatCompactNumber(n)}${valueSuffix}`);
  // Parentheses / special chars break SVG url(#id) fills — keep ids CSS-safe.
  const gradientId = `fill-${title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "")}`;

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>
          ) : null}
        </div>
        <PeriodChips
          options={periods}
          value={period}
          onChange={onPeriodChange}
          ariaLabel={`${title} time period`}
        />
      </div>
      <div className="h-52 rounded-lg bg-[var(--accent-soft)]/50 px-1 py-2">
        {series.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
            No data for this period yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d598c" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0d598c" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e3e5eb" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#6b7380", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#e3e5eb" }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: "#6b7380", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v) => formatCompactNumber(Number(v))}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e3e5eb",
                  fontSize: 12,
                }}
                formatter={(value) => [fmt(Number(value ?? 0)), title]}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#0d598c"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={series.length <= 14}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
