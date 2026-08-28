// app/admin/benchmark/page.tsx
import { createAdminClient } from "@/utils/supabase/server";
import BenchmarkClient from "@/components/admin/benchmark/BenchmarkClient";
import {
  parseBenchmarkSummary,
  parseBenchmarkResult,
} from "@/components/admin/benchmark/types";

export const metadata = {
  title: "Benchmark — ThyroVision Admin",
};

export default async function BenchmarkPage() {
  const adminSupabase = await createAdminClient();

  // 1. Fetch latest benchmark run
  const { data: latestRunRaw, error: runError } = await adminSupabase
    .from("benchmark_runs")
    .select(
      "*, benchmark_avg_iou:avg_iou, benchmark_bbox_accuracy:bbox_accuracy, benchmark_bbox_correct_count:bbox_correct_count, benchmark_iou_threshold:iou_threshold, benchmark_avg_roi_ms:avg_roi_ms, benchmark_bbox_regressions:bbox_regressions, benchmark_bbox_improvements:bbox_improvements, benchmark_tirads_accuracy:tirads_accuracy, benchmark_tirads_correct_count:tirads_correct_count, benchmark_feature_accuracy:feature_accuracy, benchmark_confusion_matrix:confusion_matrix, benchmark_avg_xception_ms:avg_xception_ms, benchmark_tirads_regressions:tirads_regressions, benchmark_tirads_improvements:tirads_improvements, benchmark_dataset_size:dataset_size",
    )
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Fetch associated results if run exists
  let results: any[] = [];
  let summary = null;

  if (latestRunRaw) {
    summary = parseBenchmarkSummary(latestRunRaw);

    const { data: resultsRaw, error: resultsError } = await adminSupabase
      .from("benchmark_results")
      .select(
        "*, result_id:id, performance_id:benchmark_run_id, benchmark_images(file_url, description)",
      )
      .eq("benchmark_run_id", latestRunRaw.id)
      .order("image_index", { ascending: true });

    const parsedResults = (resultsRaw || []).map(parseBenchmarkResult);

    // ── Batch sign URLs for performance ──────────────────────
    const STORAGE_BUCKET =
      process.env.SUPABASE_STORAGE_BUCKET || "thyrovision-images";
    const pathsToSign: string[] = [];
    const pathToImages: Record<string, any[]> = {};

    parsedResults.forEach((r) => {
      const img = r.benchmark_images;
      // Handle both object and array formats seen in types.ts
      const imgData = Array.isArray(img) ? img[0] : img;
      const urlOrPath = imgData?.file_url;

      if (urlOrPath) {
        let path = urlOrPath;
        // If it's a full URL containing the bucket, extract the path
        if (urlOrPath.includes(STORAGE_BUCKET)) {
          path = urlOrPath.split(`${STORAGE_BUCKET}/`)[1];
        }

        // Only sign if it's not a full external URL
        if (path && !path.startsWith("http")) {
          pathsToSign.push(path);
          if (!pathToImages[path]) pathToImages[path] = [];
          pathToImages[path].push(imgData);
        }
      }
    });

    if (pathsToSign.length > 0) {
      try {
        const { data: signedUrls } = await adminSupabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrls(pathsToSign, 3600);

        signedUrls?.forEach((item) => {
          if (item.signedUrl && item.path && pathToImages[item.path]) {
            pathToImages[item.path].forEach((img) => {
              if (img) img.file_url = item.signedUrl;
            });
          }
        });
      } catch (e) {
        console.error("Failed to sign URLs in Server Component:", e);
      }
    }
    results = parsedResults;
  }

  return (
    <BenchmarkClient
      initialData={{
        summary: summary,
        results: results,
      }}
    />
  );
}
