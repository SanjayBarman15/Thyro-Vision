// components/admin/logs/LogsFilters.tsx
"use client";

import { LogFilters, LogLevel, ActorRole } from "./types";

interface Props {
  filters: LogFilters;
  onChange: (filters: LogFilters) => void;
  isRefreshing: boolean;
}

const LEVELS: (LogLevel | "ALL")[] = ["ALL", "INFO", "WARN", "ERROR", "FATAL"];
const ROLES: (ActorRole | "ALL")[] = ["ALL", "doctor", "admin", "system"];

const LEVEL_COLORS: Record<string, string> = {
  ALL: "text-white",
  INFO: "text-blue-400",
  WARN: "text-yellow-400",
  ERROR: "text-red-400",
  FATAL: "text-red-300",
};

export default function LogsFilters({
  filters,
  onChange,
  isRefreshing,
}: Props) {
  const update = (key: keyof LogFilters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () =>
    onChange({
      level: "ALL",
      actor_role: "ALL",
      search: "",
      from: "",
      to: "",
    });

  const hasActiveFilters =
    filters.level !== "ALL" ||
    filters.actor_role !== "ALL" ||
    filters.search !== "" ||
    filters.from !== "" ||
    filters.to !== "";

  return (
    <div
      className="bg-[#0f1623] border border-[#1e2736] rounded-lg p-4
                    flex flex-col gap-4"
    >
      {/* ── Row 1: Level tabs + Role + Search ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Level filter — tab style */}
        <div
          className="flex items-center gap-1 bg-[#1e2736] 
                        rounded-lg p-1 flex-wrap"
        >
          {LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => update("level", level)}
              className={`px-3 py-1 text-xs rounded-md transition-colors
                          cursor-pointer font-medium
                          ${
                            filters.level === level
                              ? `bg-[#0f1623] ${LEVEL_COLORS[level]}`
                              : "text-muted-foreground hover:text-white"
                          }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Actor role dropdown */}
        <select
          value={filters.actor_role}
          onChange={(e) => update("actor_role", e.target.value)}
          className="bg-[#1e2736] border border-[#2d3748] text-white
                     text-sm rounded-lg px-3 py-2 cursor-pointer
                     focus:outline-none focus:border-[#4d5768]"
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role === "ALL" ? "All Roles" : role}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by action..."
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            className="w-full bg-[#1e2736] border border-[#2d3748]
                       text-white text-sm rounded-lg px-3 py-2
                       placeholder:text-muted-foreground
                       focus:outline-none focus:border-[#4d5768]"
          />
        </div>

        {/* Reset button — only show when filters active */}
        {hasActiveFilters && (
          <button
            onClick={reset}
            className="px-3 py-2 text-xs text-muted-foreground
                       hover:text-white bg-[#1e2736] rounded-lg
                       border border-[#2d3748] transition-colors
                       cursor-pointer"
          >
            ✕ Reset
          </button>
        )}

        {/* Refreshing indicator */}
        {isRefreshing && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Refreshing...
          </span>
        )}
      </div>

      {/* ── Row 2: Date range ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">Date range:</span>

        <input
          type="datetime-local"
          value={filters.from}
          onChange={(e) => update("from", e.target.value)}
          className="bg-[#1e2736] border border-[#2d3748] text-white
                     text-sm rounded-lg px-3 py-2 cursor-pointer
                     focus:outline-none focus:border-[#4d5768]
                     [color-scheme:dark]"
        />

        <span className="text-xs text-muted-foreground">→</span>

        <input
          type="datetime-local"
          value={filters.to}
          onChange={(e) => update("to", e.target.value)}
          className="bg-[#1e2736] border border-[#2d3748] text-white
                     text-sm rounded-lg px-3 py-2 cursor-pointer
                     focus:outline-none focus:border-[#4d5768]
                     [color-scheme:dark]"
        />

        {/* Quick date shortcuts */}
        <div className="flex gap-2">
          {[
            { label: "Today", hours: 24 },
            { label: "Last 7d", hours: 168 },
            { label: "Last 30d", hours: 720 },
          ].map(({ label, hours }) => (
            <button
              key={label}
              onClick={() => {
                const to = new Date();
                const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
                onChange({
                  ...filters,
                  from: from.toISOString().slice(0, 16),
                  to: to.toISOString().slice(0, 16),
                });
              }}
              className="px-3 py-1.5 text-xs text-muted-foreground
                         hover:text-white bg-[#1e2736] rounded-lg
                         border border-[#2d3748] transition-colors
                         cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
