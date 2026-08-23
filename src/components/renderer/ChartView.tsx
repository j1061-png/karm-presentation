"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import type { ChartElement } from "@/lib/schema";
import type { Theme } from "@/lib/schema";
import { z } from "zod";

type ChartProps = z.infer<typeof ChartElement>["props"];

const FALLBACK_COLORS = ["#f5a623", "#4f9cf9", "#43c98a", "#e66df2", "#f0554d", "#3ecfcf"];

function shortLabel(s: string, max = 14) {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function ChartView({
  props,
  theme,
  animate,
}: {
  props: ChartProps;
  theme: Theme;
  animate: boolean;
}) {
  const data = useMemo(
    () =>
      props.labels.map((label, i) => {
        const row: Record<string, string | number> = { name: label };
        for (const s of props.series) row[s.name] = s.data[i] ?? 0;
        return row;
      }),
    [props.labels, props.series]
  );

  const colors = props.series.map((s, i) => s.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]);
  const textColor = theme.colors.muted;
  const gridColor = theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const showLegend = props.showLegend && props.series.length > 1;
  const manyTicks = props.labels.length > 6;

  const tooltipStyle = {
    background: theme.colors.surface,
    border: `1px solid ${gridColor}`,
    borderRadius: 8,
    color: theme.colors.text,
    fontSize: 12,
  };

  const fmt = (v: number) => `${props.valuePrefix ?? ""}${v.toLocaleString()}${props.valueSuffix ?? ""}`;

  const axes = (
    <>
      {props.showGrid && <CartesianGrid stroke={gridColor} vertical={false} />}
      <XAxis
        dataKey="name"
        tick={{ fill: textColor, fontSize: 11 }}
        axisLine={{ stroke: gridColor }}
        tickLine={false}
        height={22}
        interval={manyTicks ? "preserveStartEnd" : 0}
        tickFormatter={(v: string) => shortLabel(String(v), manyTicks ? 8 : 12)}
      />
      <YAxis
        tick={{ fill: textColor, fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        tickFormatter={(v: number) => fmt(v)}
        width={44}
      />
      <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v))} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
    </>
  );

  const margin = { top: 6, right: 8, bottom: 0, left: 0 };

  let chart: React.ReactElement;
  switch (props.chartType) {
    case "line":
      chart = (
        <LineChart data={data} margin={margin}>
          {axes}
          {props.series.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={colors[i]} strokeWidth={2.5} dot={{ r: 3, fill: colors[i] }} isAnimationActive={animate} />
          ))}
        </LineChart>
      );
      break;
    case "area":
      chart = (
        <AreaChart data={data} margin={margin}>
          {axes}
          {props.series.map((s, i) => (
            <Area key={s.name} type="monotone" dataKey={s.name} stroke={colors[i]} fill={colors[i]} fillOpacity={0.18} strokeWidth={2.5} stackId={props.stacked ? "a" : undefined} isAnimationActive={animate} />
          ))}
        </AreaChart>
      );
      break;
    case "pie":
    case "donut": {
      const pieData = props.labels.map((label, i) => ({
        name: label,
        value: props.series[0]?.data[i] ?? 0,
      }));
      chart = (
        <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v))} />
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={props.chartType === "donut" ? "55%" : 0}
            outerRadius="78%"
            paddingAngle={2}
            stroke={theme.colors.background}
            isAnimationActive={animate}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      );
      break;
    }
    case "radar":
      chart = (
        <RadarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <PolarGrid stroke={gridColor} />
          <PolarAngleAxis dataKey="name" tick={{ fill: textColor, fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} />
          {props.series.map((s, i) => (
            <Radar key={s.name} name={s.name} dataKey={s.name} stroke={colors[i]} fill={colors[i]} fillOpacity={0.25} isAnimationActive={animate} />
          ))}
        </RadarChart>
      );
      break;
    default:
      chart = (
        <BarChart data={data} margin={margin} barCategoryGap="18%">
          {axes}
          {props.series.map((s, i) => (
            <Bar key={s.name} dataKey={s.name} fill={colors[i]} radius={[5, 5, 0, 0]} stackId={props.stacked ? "a" : undefined} isAnimationActive={animate} maxBarSize={48} />
          ))}
        </BarChart>
      );
  }

  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
      {(props.title || showLegend) && (
        <div className="flex items-center gap-3 mb-1.5 flex-shrink-0 min-w-0">
          {props.title && (
            <div className="text-[14px] font-medium truncate min-w-0" style={{ color: theme.colors.text }}>
              {props.title}
            </div>
          )}
          {showLegend && (
            <div className="flex items-center gap-2.5 flex-shrink-0 ml-auto">
              {props.series.map((s, i) => (
                <span key={s.name} className="flex items-center gap-1.5 text-[11px]" style={{ color: textColor }}>
                  <span className="w-2 h-2 rounded-sm" style={{ background: colors[i] }} />
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
