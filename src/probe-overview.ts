// 普通主题探针页的汇总、健康判定、排序 —— 纯函数,与主仓内置探针 src/lib/probe-overview.ts 同一份逻辑。

export type ProbeOverviewServer = {
  name?: string;
  region?: string;
  online: boolean;
  cpu_pct?: number;
  mem_used?: number;
  mem_total?: number;
  disk_used?: number;
  disk_total?: number;
  upload_speed?: number;
  download_speed?: number;
  traffic_limit?: number;
  expires_at?: string;
  renewal_price_cny?: number;
  daily_traffic?: Array<{ date: string; total: number }>;
  ping?: Array<{ current_ms: number }>;
};

/** 进度条变红的阈值,告警也按它 */
export const PROBE_ALERT_PCT = 90;

export type ProbeHealthIssue = {
  key: "cpu" | "mem" | "disk" | "traffic";
  pct: number;
};

function ratio(used?: number, total?: number): number | undefined {
  if (typeof used !== "number" || typeof total !== "number" || total <= 0)
    return undefined;
  return (used / total) * 100;
}

export function memPct(s: ProbeOverviewServer) {
  return ratio(s.mem_used, s.mem_total);
}
export function diskPct(s: ProbeOverviewServer) {
  return ratio(s.disk_used, s.disk_total);
}

/**
 * 最严重的一项(超过阈值才算)。离线机器的数据是旧的,不判。
 * trafficUsed 由调用方算(计费口径在 probe-traffic 里)。
 */
export function probeHealthIssue(
  s: ProbeOverviewServer,
  trafficUsed?: number,
): ProbeHealthIssue | undefined {
  if (!s.online) return undefined;
  const items: ProbeHealthIssue[] = [];
  if (typeof s.cpu_pct === "number") items.push({ key: "cpu", pct: s.cpu_pct });
  const mem = memPct(s);
  if (mem !== undefined) items.push({ key: "mem", pct: mem });
  const disk = diskPct(s);
  if (disk !== undefined) items.push({ key: "disk", pct: disk });
  const traffic = ratio(trafficUsed, s.traffic_limit);
  if (traffic !== undefined) items.push({ key: "traffic", pct: traffic });
  const worst = items
    .filter((i) => i.pct > PROBE_ALERT_PCT)
    .sort((a, b) => b.pct - a.pct)[0];
  return worst;
}

/** 「已用 / 总量」:按总量选单位,两边同一单位,去掉多余的 .0 */
export function formatCapacity(used: number, total: number): string {
  const GiB = 1024 ** 3;
  const MiB = 1024 ** 2;
  const TiB = 1024 ** 4;
  const unit = total >= TiB ? TiB : total >= GiB ? GiB : MiB;
  const name = unit === TiB ? "TB" : unit === GiB ? "GB" : "MB";
  const fmt = (v: number) => {
    const x = v / unit;
    return (x >= 100 ? x.toFixed(0) : x.toFixed(1)).replace(/\.0$/, "");
  };
  return `${fmt(used)} / ${fmt(total)} ${name}`;
}

/** 只写总量(离线卡片的规格行用) */
export function formatSize(total: number): string {
  return formatCapacity(0, total).replace(/^0 \/ /, "");
}

/**
 * 今日流量:所有服务器 daily_traffic 里「最新的那一天」的合计。
 * 没有任何一台带日流量(流量展示关着)→ undefined,调用方不显示这一格。
 */
export function todayTrafficTotal(
  servers: ProbeOverviewServer[],
): number | undefined {
  let latest = "";
  for (const s of servers)
    for (const d of s.daily_traffic ?? []) if (d.date > latest) latest = d.date;
  if (!latest) return undefined;
  let total = 0;
  for (const s of servers)
    for (const d of s.daily_traffic ?? [])
      if (d.date === latest) total += d.total || 0;
  return total;
}

/** 在线服务器的平均占用;某项没有任何数据 → undefined */
export function averageLoad(servers: ProbeOverviewServer[]) {
  const avg = (values: Array<number | undefined>) => {
    const list = values.filter((v): v is number => typeof v === "number");
    return list.length
      ? list.reduce((a, b) => a + b, 0) / list.length
      : undefined;
  };
  const online = servers.filter((s) => s.online);
  return {
    cpu: avg(online.map((s) => s.cpu_pct)),
    mem: avg(online.map(memPct)),
    disk: avg(online.map(diskPct)),
  };
}

export type ProbeSortKey =
  | "default"
  | "name"
  | "cpu"
  | "mem"
  | "speed"
  | "traffic"
  | "expiry"
  | "latency";

export const PROBE_SORT_KEYS: ProbeSortKey[] = [
  "default",
  "name",
  "cpu",
  "mem",
  "speed",
  "traffic",
  "expiry",
  "latency",
];

/**
 * 排序。没有该项数据的排最后;数值类从大到小(最该关注的在前),
 * 到期日与延迟从小到大。相同时保持原顺序(管理员排好的顺序)。
 */
export function sortProbeServers<
  T extends { server: ProbeOverviewServer; index: number },
>(
  list: T[],
  key: ProbeSortKey,
  trafficUsed: (s: ProbeOverviewServer) => number,
): T[] {
  if (key === "default") return list;
  const value = (s: ProbeOverviewServer): number | string | undefined => {
    switch (key) {
      case "name":
        return s.name || "";
      case "cpu":
        return s.cpu_pct;
      case "mem":
        return memPct(s);
      case "speed":
        return s.upload_speed === undefined && s.download_speed === undefined
          ? undefined
          : (s.upload_speed || 0) + (s.download_speed || 0);
      case "traffic":
        return trafficUsed(s);
      case "expiry":
        return s.expires_at || undefined;
      case "latency": {
        const ms = (s.ping ?? [])
          .map((p) => p.current_ms)
          .filter((v) => v >= 0);
        return ms.length ? Math.min(...ms) : undefined;
      }
    }
  };
  const ascending = key === "name" || key === "expiry" || key === "latency";
  return [...list].sort((a, b) => {
    const va = value(a.server);
    const vb = value(b.server);
    if (va === undefined && vb === undefined) return a.index - b.index;
    if (va === undefined) return 1;
    if (vb === undefined) return -1;
    let cmp: number;
    if (typeof va === "string" && typeof vb === "string")
      cmp = va.localeCompare(vb, "zh-CN");
    else cmp = (va as number) - (vb as number);
    if (!ascending) cmp = -cmp;
    return cmp || a.index - b.index;
  });
}

/** 「37 分钟前」这类相对时间 */
export function relativeTime(iso: string, now = Date.now(), zh = true): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const sec = Math.max(0, Math.round((now - t) / 1000));
  const min = Math.round(sec / 60);
  const hour = Math.round(sec / 3600);
  const day = Math.round(sec / 86400);
  if (zh) {
    if (sec < 60) return "刚刚";
    if (min < 60) return `${min} 分钟前`;
    if (hour < 48) return `${hour} 小时前`;
    return `${day} 天前`;
  }
  if (sec < 60) return "just now";
  if (min < 60) return `${min} min ago`;
  if (hour < 48) return `${hour} h ago`;
  return `${day} d ago`;
}
