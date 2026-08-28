// components/admin/performance/TiradsChart.tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TiradsItem } from "./types";
import { useEffect, useState } from "react";

interface Props {
  data: TiradsItem[];
}

// ── TI-RADS level colors ──────────────────────────────────
const TIRADS_COLORS: Record<string, string> = {
  TR1: "#22c55e", // green  — benign
  TR2: "#84cc16", // lime   — not suspicious
  TR3: "#eab308", // yellow — mildly suspicious
  TR4: "#f97316", // orange — moderately suspicious
  TR5: "#ef4444", // red    — highly suspicious
};

// ── Empty state ───────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-2">
      <p className="text-sm text-muted-foreground">No predictions yet</p>
      <span className="text-xs text-muted-foreground">
        Data appears here after first scan
      </span>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e2736] border border-[#2d3748] rounded-lg p-3">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="text-sm text-muted-foreground">
        {payload[0].value} prediction{payload[0].value !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function TiradsChart({ data }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card className="bg-[#0f1623] border-[#1e2736]">
        <CardHeader>
          <CardTitle className="text-white text-base">TI-RADS Distribution</CardTitle>
          <CardDescription>Prediction count per TI-RADS category</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
           <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </CardContent>
      </Card>
    );
  }

  // Fill missing TR levels with 0 so chart always shows all 5
  const allLevels = ["TR1", "TR2", "TR3", "TR4", "TR5"];
  const filledData = allLevels.map((level) => ({
    tirads_level: level,
    count: data.find((d) => d.tirads_level === level)?.count ?? 0,
  }));

  return (
    <Card className="bg-[#0f1623] border-[#1e2736]">
      <CardHeader>
        <CardTitle className="text-white text-base">
          TI-RADS Distribution
        </CardTitle>
        <CardDescription>Prediction count per TI-RADS category</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={filledData}
              margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#1e2736"
                vertical={false}
              />
              <XAxis
                dataKey="tirads_level"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {filledData.map((entry) => (
                  <Cell
                    key={entry.tirads_level}
                    fill={TIRADS_COLORS[entry.tirads_level]}
                    opacity={entry.count === 0 ? 0.2 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
