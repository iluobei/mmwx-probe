// 探针曲线（延迟 / 丢包 / 连接数）可选的时间范围。与主仓内置探针的 src/lib/probe-ranges.ts
// 同一套规则，改一边记得同步另一边。
//
// 1h / 6h / 24h 固定；超过 24 小时的范围按主控下发的 history_days 给出 —— 它就是
// 「系统设置 → 探针 → 延迟采样点(天)」，主控的小时层只保留这么多天。桶宽由主控定
// （probeSeriesRangeFor），这里只负责按钮，以及接口还没回来时的兜底桶宽/桶数。

export type ProbeRangeOption = { key: string; label: string };

export function probeRangeOptions(historyDays?: number): ProbeRangeOption[] {
  const out: ProbeRangeOption[] = [
    { key: "1h", label: "1 小时" },
    { key: "6h", label: "6 小时" },
    { key: "24h", label: "24 小时" },
  ];
  const days = Math.min(7, Math.max(1, Math.floor(historyDays ?? 1)));
  const picks = [3, 7].filter((d) => d <= days);
  if (days >= 2 && !picks.includes(days)) picks.push(days);
  picks.sort((a, b) => a - b);
  for (const d of picks) out.push({ key: `${d}d`, label: `${d} 天` });
  return out;
}

// 与主控 probeSeriesRangeFor 一致：1h 每桶 5 分钟、6h 10 分钟、24h 30 分钟、
// 3 天以内 1 小时、更长 2 小时。
export function probeRangeBucketSec(key: string): number {
  if (key === "1h") return 300;
  if (key === "6h") return 600;
  if (key === "24h") return 1800;
  return Number.parseInt(key, 10) <= 3 ? 3600 : 7200;
}

export function probeRangeBucketCount(key: string): number {
  if (key === "1h") return 12;
  if (key === "6h") return 36;
  if (key === "24h") return 48;
  const days = Number.parseInt(key, 10);
  return days <= 3 ? days * 24 : days * 12;
}

// 保留期调短后，之前选中的范围可能已经不在按钮里了 —— 回落 1h，而不是去请求一个主控不认的范围。
export function effectiveProbeRange(
  range: string,
  options: ProbeRangeOption[],
): string {
  return options.some((o) => o.key === range) ? range : "1h";
}
