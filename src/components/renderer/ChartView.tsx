"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import type { ChartElement } from "@/lib/schema";
import type { Theme } from "@/lib/schema";
import { z } from "zod";

type ChartProps = z.infer<typeof ChartElement>["props"];

const FALLBACK_COLORS = ["#f5a623", "#4f9cf9", "#43c98a", "#e66df2", "#f0554d", "#3ecfcf"];

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

  const tooltipStyle = {
    background: theme.colors.surface,
    border: `1px solid ${gridColor}`,
    borderRadius: 8,
    color: theme.colors.text,
    fontSize: 13,
  };

  const fmt = (v: number) => `${props.valuePrefix ?? ""}${v.toLocaleString()}${props.valueSuffix ?? ""}`;

  const common = (
    <>
      {props.showGrid && <CartesianGrid stroke={gridColor} vertical={false} />}
      <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 12 }} axisLine={{ stroke: gridColor }} tickLine={false} />
      <YAxis tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmt(v)} width={56} />
      <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v))} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
      {props.showLegend && props.series.length > 1 && (
        <Legend wrapperStyle={{ fontSize: 12, color: textColor }} />
      )}
    </>
  );

  let chart: React.ReactElement;
  switch (props.chartType) {
    case "line":
      chart = (
        <LineChart data={data}>
          {common}
          {props.series.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={colors[i]} strokeWidth={2.5} dot={{ r: 3, fill: colors[i] }} isAnimationActive={animate} />
          ))}
        </LineChart>
      );
      break;
    case "area":
      chart = (
        <AreaChart data={data}>
          {common}
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
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmt(Number(v))} />
          {props.showLegend && <Legend wrapperStyle={{ fontSize: 12, color: textColor }} />}
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={props.chartType === "donut" ? "55%" : 0}
            outerRadius="85%"
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
        <RadarChart data={data}>
          <PolarGrid stroke={gridColor} />
          <PolarAngleAxis dataKey="name" tick={{ fill: textColor, fontSize: 12 }} />
          <Tooltip contentStyle={tooltipStyle} />
          {props.series.map((s, i) => (
            <Radar key={s.name} name={s.name} dataKey={s.name} stroke={colors[i]} fill={colors[i]} fillOpacity={0.25} isAnimationActive={animate} />
          ))}
        </RadarChart>
      );
      break;
    default:
      chart = (
        <BarChart data={data}>
          {common}
          {props.series.map((s, i) => (
            <Bar key={s.name} dataKey={s.name} fill={colors[i]} radius={[5, 5, 0, 0]} stackId={props.stacked ? "a" : undefined} isAnimationActive={animate} maxBarSize={56} />
          ))}
        </BarChart>
      );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {props.title && (
        <div className="text-[15px] font-medium mb-2" style={{ color: theme.colors.text }}>
          {props.title}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
