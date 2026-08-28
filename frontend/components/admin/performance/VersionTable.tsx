// components/admin/performance/VersionTable.tsx
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GitBranch } from "lucide-react";
import { VersionItem } from "./types";

interface Props {
  data: VersionItem[];
  title?: string;
  description?: string;
}

// ── Empty state ───────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <GitBranch className="w-8 h-8 text-muted-foreground opacity-40" />
      <p className="text-sm font-medium text-muted-foreground">
        No model versions recorded yet
      </p>
      <span className="text-xs text-muted-foreground text-center max-w-xs">
        Click "Log Performance" after each model retrain to populate this table.
      </span>
    </div>
  );
}

// ── Accuracy badge ────────────────────────────────────────
function AccuracyBadge({
  accuracy,
  correct,
}: {
  accuracy: number | null;
  correct: number;
}) {
  if (accuracy === null) {
    return (
      <Badge className="bg-[#1e2736] text-muted-foreground border-[#2d3748]">
        —
      </Badge>
    );
  }
  // 0% with no correct predictions → neutral grey instead of alarming red
  if (accuracy === 0 && correct === 0) {
    return (
      <Badge className="bg-[#1e2736] text-muted-foreground border-[#2d3748]">
        0%
      </Badge>
    );
  }
  if (accuracy >= 80) {
    return (
      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
        {accuracy}%
      </Badge>
    );
  }
  if (accuracy >= 60) {
    return (
      <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
        {accuracy}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
      {accuracy}%
    </Badge>
  );
}

// ── Inference time badge ──────────────────────────────────
function InferenceBadge({ ms }: { ms: number | null }) {
  if (!ms) {
    return (
      <Badge className="bg-[#1e2736] text-muted-foreground border-[#2d3748]">
        —
      </Badge>
    );
  }
  const seconds = ms / 1000;
  if (seconds < 3) {
    return (
      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
        {seconds.toFixed(1)}s
      </Badge>
    );
  }
  if (seconds <= 7) {
    return (
      <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
        {seconds.toFixed(1)}s
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
      {seconds.toFixed(1)}s
    </Badge>
  );
}

// ── TI-RADS distribution mini display ────────────────────
function TiradsDistribution({
  distribution,
}: {
  distribution: Record<string, number> | null;
}) {
  if (!distribution || Object.keys(distribution).length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <div className="flex gap-2 flex-wrap">
      {Object.entries(distribution)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([level, count]) => (
          <span key={level} className="text-xs text-muted-foreground">
            <span className="text-white">{level}</span>:{count}
          </span>
        ))}
    </div>
  );
}

// ── Model versions from metadata ──────────────────────────
function ModelVersions({
  metadata,
}: {
  metadata: Record<string, string> | null;
}) {
  if (!metadata)
    return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {metadata.roi_detector && (
        <span className="font-mono text-xs text-muted-foreground">
          <span className="text-[#64748b]">ROI: </span>
          {metadata.roi_detector}
        </span>
      )}
      {metadata.feature_classifier && (
        <span className="font-mono text-xs text-muted-foreground">
          <span className="text-[#64748b]">CLS: </span>
          {metadata.feature_classifier}
        </span>
      )}
      {metadata.rule_engine && (
        <span className="font-mono text-xs text-muted-foreground">
          <span className="text-[#64748b]">Rule: </span>
          {metadata.rule_engine}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function VersionTable({
  data,
  title = "Model Version Comparison",
  description = "Performance metrics across all deployed pipeline versions",
}: Props) {
  return (
    <Card className="bg-[#0f1623] border-[#1e2736]">
      <CardHeader>
        <CardTitle className="text-white text-base">
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-[#1e2736] hover:bg-transparent">
                  <TableHead className="text-muted-foreground">
                    Pipeline Version
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Model Versions
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Predictions
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Accuracy
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Avg Confidence
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Inference Time
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    TI-RADS Dist.
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Feedback Rate
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Recorded
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => (
                  <TableRow
                    key={`${item.model_version}-${index}`}
                    className="border-[#1e2736] hover:bg-[#1e2736]/50"
                  >
                    {/* Pipeline version */}
                    <TableCell className="font-mono text-xs text-white">
                      {item.pipeline_version ?? item.model_version ?? "—"}
                    </TableCell>

                    {/* Both model versions from metadata */}
                    <TableCell>
                      <ModelVersions metadata={item.model_metadata ?? null} />
                    </TableCell>

                    {/* Total predictions */}
                    <TableCell className="text-white">
                      {item.total_predictions?.toLocaleString() ?? "0"}
                    </TableCell>

                    {/* Accuracy */}
                    <TableCell>
                      <AccuracyBadge
                        accuracy={
                          item.accuracy !== null && item.accuracy !== undefined
                            ? Number(item.accuracy.toFixed(1))
                            : null
                        }
                        correct={item.correct_predictions ?? 0}
                      />
                    </TableCell>

                    {/* Avg confidence */}
                    <TableCell className="text-white">
                      {item.avg_confidence
                        ? `${(item.avg_confidence * 100).toFixed(1)}%`
                        : "—"}
                    </TableCell>

                    {/* Inference time */}
                    <TableCell>
                      <InferenceBadge ms={item.avg_inference_ms ?? null} />
                    </TableCell>

                    {/* TI-RADS distribution */}
                    <TableCell>
                      <TiradsDistribution
                        distribution={item.tirads_distribution ?? null}
                      />
                    </TableCell>

                    {/* Feedback rate */}
                    <TableCell className="text-white">
                      {item.feedback_rate ? `${item.feedback_rate}%` : "—"}
                    </TableCell>

                    {/* Recorded at */}
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(item.recorded_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
