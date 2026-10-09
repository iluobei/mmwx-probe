// 探针 CPU / 内存 / 硬盘使用率历史（用户反馈「没有这些指标的历史记录」）。
//
// 数据来自 /api/series?metric=system：每个指标一列只含有样本的桶 {t, value}。
// 内存、硬盘给的是已用字节和总量两列，这里按同一个桶对齐后换算成百分比 ——
// 总量缺失或为 0 的桶记 null（线在那里断开），不当成 0%，否则会画出假的谷底。
//
// 与主仓 miaomiaowux-frontend/src/lib/resource-history.ts 同逻辑，改这里要同步改那边。
import type { ProbeMetricPoint } from "./conn-sparkline";

export type ResourceMetric = "cpu" | "mem" | "disk";

export type ResourceSeriesInput = {
  cpu_pct?: ProbeMetricPoint[];
  mem_used?: ProbeMetricPoint[];
  mem_total?: ProbeMetricPoint[];
  disk_used?: ProbeMetricPoint[];
  disk_total?: ProbeMetricPoint[];
};

export type ResourceHistory = {
  times: number[];
  cpu: (number | null)[];
  mem: (number | null)[];
  disk: (number | null)[];
};

const round1 = (v: number) => Math.round(v * 10) / 10;
const clampPct = (v: number) => Math.min(100, Math.max(0, v));

// resourceHistoryFromSeries 摊成定长数组（与 connHistoryFromSeries 同一套时间轴）：
// times 是每个桶的起点（unix 秒），从旧到新。
export function resourceHistoryFromSeries(
  series: ResourceSeriesInput | undefined,
  generatedAt: number,
  bucketSec: number,
  buckets: number,
): ResourceHistory {
  const end = generatedAt - (generatedAt % bucketSec);
  const times = Array.from(
    { length: buckets },
    (_, i) => end - (buckets - 1 - i) * bucketSec,
  );
  const byTime = (points?: ProbeMetricPoint[]) =>
    new Map((points ?? []).map((p) => [p.t, p.value]));

  const cpu = byTime(series?.cpu_pct);
  const ratio = (used?: ProbeMetricPoint[], total?: ProbeMetricPoint[]) => {
    const u = byTime(used);
    const tot = byTime(total);
    return times.map((t) => {
      const a = u.get(t);
      const b = tot.get(t);
      if (typeof a !== "number" || typeof b !== "number" || b <= 0) return null;
      return round1(clampPct((a / b) * 100));
    });
  };
  return {
    times,
    cpu: times.map((t) => {
      const v = cpu.get(t);
      return typeof v === "number" ? round1(clampPct(v)) : null;
    }),
    mem: ratio(series?.mem_used, series?.mem_total),
    disk: ratio(series?.disk_used, series?.disk_total),
  };
}
