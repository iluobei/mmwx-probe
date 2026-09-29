// 探针卡片上的系统连接数小折线图（TCP / UDP 画在同一张图里）。与主仓内置探针的
// src/lib/conn-sparkline.ts 同一套算法，改一边记得同步另一边。
//
// 数据来自公开接口的 conn_history：近 1 小时 12 格、每格 5 分钟均值，从旧到新；
// 没样本的格是 null（agent 断线 / 刚重启），线在那里断开，不补 0 —— 补 0 会画出假的谷底。

import type { ProbeConnHistory } from "./types";

const CONN_BUCKET_MINUTES = 5;

export type ProbeMetricPoint = { t: number; value: number };

// connHistoryFromSeries 把 /api/series?metric=system 的点列（只含有样本的桶）摊成定长数组，
// 没样本的桶为 null —— 与列表的 conn_history 同形，弹窗与抽屉能共用同一个折线图组件。
// times 是每个桶的起点（unix 秒），给横轴/悬停提示用。
export function connHistoryFromSeries(
  tcp: ProbeMetricPoint[] | undefined,
  udp: ProbeMetricPoint[] | undefined,
  generatedAt: number,
  bucketSec: number,
  buckets: number,
): ProbeConnHistory & { times: number[] } {
  const end = generatedAt - (generatedAt % bucketSec);
  const times = Array.from(
    { length: buckets },
    (_, i) => end - (buckets - 1 - i) * bucketSec,
  );
  const pick = (points?: ProbeMetricPoint[]) => {
    const byTime = new Map(
      (points ?? []).map((p) => [p.t, Math.round(p.value)]),
    );
    return times.map((t) => byTime.get(t) ?? null);
  };
  return { tcp: pick(tcp), udp: pick(udp), times };
}

// 两条线共用纵轴、从 0 起：UDP 通常比 TCP 小一两个数量级，各自归一化会让两条线看起来一样高，
// 读图的人就分不出谁多谁少了。全是 0 时返回 0，由 connSparklinePath 画成贴底的线。
export function connSparklineMax(history: ProbeConnHistory): number {
  let max = 0;
  for (const v of [...history.tcp, ...history.udp]) {
    if (typeof v === "number" && v > max) max = v;
  }
  return max;
}

const round = (v: number) => Math.round(v * 100) / 100;

// connSparklinePath 把一条序列画成 SVG path（坐标系 width × height，上下各留 pad）。
// 前后都是 null 的孤立点补一段极短的横线，配合 round 线帽显示成圆点，否则单独的 M 画不出东西。
export function connSparklinePath(
  values: (number | null)[],
  max: number,
  width: number,
  height: number,
  pad = 0,
): string {
  const n = values.length;
  const scale = max > 0 ? max : 1;
  const x = (i: number) => (n <= 1 ? width / 2 : (i / (n - 1)) * width);
  const y = (v: number) => pad + (height - 2 * pad) * (1 - v / scale);
  let d = "";
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (typeof v !== "number") continue;
    const prev = i > 0 ? values[i - 1] : null;
    const next = i < n - 1 ? values[i + 1] : null;
    const point = `${round(x(i))} ${round(y(v))}`;
    if (typeof prev === "number") {
      d += `L${point}`;
    } else {
      d += `M${point}`;
      if (typeof next !== "number") d += "h0.01";
    }
  }
  return d;
}

// connBucketLabel 第 i 格（共 n 格）的时间说明。只说相对时间：不带时间戳是有意的，
// 主控按下标给数据，不依赖访客浏览器的时钟。
export function connBucketLabel(i: number, n: number): string {
  const ago = (n - 1 - i) * CONN_BUCKET_MINUTES;
  return ago <= 0 ? "最近 5 分钟" : `约 ${ago} 分钟前`;
}

/** 悬停位置(0~1,相对图宽)落在哪一格:与 connSparklinePath 的横坐标一致,第 i 格在 i/(n-1)。 */
export function connHoverIndex(fraction: number, n: number): number {
  if (n <= 1) return 0;
  return Math.min(n - 1, Math.max(0, Math.round(fraction * (n - 1))));
}
