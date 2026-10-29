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
  renewal_cycle?: string;
  tcp_connections?: number;
  udp_connections?: number;
  conn_history?: { tcp: (number | null)[]; udp: (number | null)[] };
  daily_traffic?: Array<{
    date: string;
    total: number;
    uplink?: number;
    downlink?: number;
  }>;
  ping?: Array<{ current_ms: number; loss_pct?: number }>;
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

// ---- 顶部汇总卡片(与主仓 src/lib/probe-overview.ts 同一份逻辑) ----

export type ProbeDailyPoint = {
  date: string;
  up: number;
  down: number;
  total: number;
};

/** 所有服务器每日流量按日期合计,取最近 days 天(按日期升序)。没有任何日流量 → [] */
export function dailyTrafficSeries(
  servers: ProbeOverviewServer[],
  days = 14,
): ProbeDailyPoint[] {
  const byDate = new Map<string, ProbeDailyPoint>();
  for (const s of servers)
    for (const d of s.daily_traffic ?? []) {
      const p = byDate.get(d.date) ?? {
        date: d.date,
        up: 0,
        down: 0,
        total: 0,
      };
      p.up += d.uplink || 0;
      p.down += d.downlink || 0;
      p.total += d.total || 0;
      byDate.set(d.date, p);
    }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}

/** 在线服务器的连接数合计。没有任何一台上报连接数 → undefined */
export function connectionTotals(servers: ProbeOverviewServer[]) {
  const online = servers.filter(
    (s) =>
      s.online &&
      (typeof s.tcp_connections === "number" ||
        typeof s.udp_connections === "number"),
  );
  if (!online.length) return undefined;
  const tcp = online.reduce((a, s) => a + (s.tcp_connections || 0), 0);
  const udp = online.reduce((a, s) => a + (s.udp_connections || 0), 0);
  return { tcp, udp, total: tcp + udp };
}

/** 设了限额的服务器本期用量合计;used 由调用方按计费口径给。一台都没设限额 → undefined */
export function quotaSummary(
  servers: ProbeOverviewServer[],
  used: (s: ProbeOverviewServer) => number | undefined,
  warnPct = 80,
) {
  const limited = servers.filter((s) => (s.traffic_limit ?? 0) > 0);
  if (!limited.length) return undefined;
  let totalUsed = 0;
  let totalLimit = 0;
  let warn = 0;
  for (const s of limited) {
    const u = used(s) ?? 0;
    totalUsed += u;
    totalLimit += s.traffic_limit!;
    if ((u / s.traffic_limit!) * 100 >= warnPct) warn++;
  }
  return {
    used: totalUsed,
    limit: totalLimit,
    pct: (totalUsed / totalLimit) * 100,
    servers: limited.length,
    warn,
  };
}

export const PROBE_LATENCY_GOOD_MS = 100;
export const PROBE_LATENCY_FAIR_MS = 200;

/**
 * 在线服务器的网络质量:每台取各探测目标当前延迟的平均(失败的不计),
 * 再按 <100 / <200 / 其余(含全部超时)分三档;丢包取所有目标的平均。没有任何探测 → undefined
 */
export function latencySummary(servers: ProbeOverviewServer[]) {
  const per = servers
    .filter((s) => s.online && (s.ping?.length ?? 0) > 0)
    .map((s) => {
      const ok = s
        .ping!.filter((p) => p.current_ms >= 0)
        .map((p) => p.current_ms);
      const loss = s.ping!.map((p) => p.loss_pct ?? 0);
      return {
        ms: ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : undefined,
        loss: loss.reduce((a, b) => a + b, 0) / loss.length,
      };
    });
  if (!per.length) return undefined;
  const ok = per.filter((p) => p.ms !== undefined).map((p) => p.ms!);
  return {
    avgMs: ok.length
      ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length)
      : undefined,
    avgLoss: per.reduce((a, p) => a + p.loss, 0) / per.length,
    good: per.filter((p) => p.ms !== undefined && p.ms < PROBE_LATENCY_GOOD_MS)
      .length,
    fair: per.filter(
      (p) =>
        p.ms !== undefined &&
        p.ms >= PROBE_LATENCY_GOOD_MS &&
        p.ms < PROBE_LATENCY_FAIR_MS,
    ).length,
    poor: per.filter((p) => p.ms === undefined || p.ms >= PROBE_LATENCY_FAIR_MS)
      .length,
  };
}

const CYCLE_MONTHS: Record<string, number> = {
  month: 1,
  quarter: 3,
  half_year: 6,
  year: 12,
  two_year: 24,
  three_year: 36,
  five_year: 60,
};

/** 按续费周期折算的月均成本(人民币);永久 / 没填价格或周期的不计。一台都没有 → undefined */
export function monthlyCost(servers: ProbeOverviewServer[]) {
  let total = 0;
  let any = false;
  for (const s of servers) {
    const months = CYCLE_MONTHS[s.renewal_cycle ?? ""];
    if (!months || typeof s.renewal_price_cny !== "number") continue;
    total += s.renewal_price_cny / months;
    any = true;
  }
  return any ? total : undefined;
}

/** 最近要到期的一台(含已到期的,天数为负)。没有任何到期日 → undefined */
export function nextExpiry(servers: ProbeOverviewServer[], now = Date.now()) {
  let best: { name: string; days: number } | undefined;
  for (const s of servers) {
    if (!s.expires_at) continue;
    const days = Math.ceil(
      (new Date(`${s.expires_at}T23:59:59`).getTime() - now) / 86400000,
    );
    if (!best || days < best.days) best = { name: s.name ?? "", days };
  }
  return best;
}

/**
 * 汇总格排几列。auto-fit 会按宽度塞满第一行、剩下的格子在第二行留一大块空白(6 格在 2000px
 * 宽屏上排成 5 + 2 就很难看);改成按「至少 minCell 宽」算出一行最多放几格,放不下时按行数
 * 均分,让各行格数一样(6 格 → 3 + 3、4 格 → 2 + 2)。宽度没量到时按 3 列。手机(<640)固定两列。
 */
export function kpiColumns(
  count: number,
  width: number,
  minCell = 320,
): number {
  if (count <= 1) return 1;
  if (width <= 0) return Math.min(count, 3);
  if (width < 640) return 2;
  const max = Math.max(2, Math.floor(width / minCell));
  if (max >= count) return count;
  const rows = Math.ceil(count / max);
  return Math.ceil(count / rows);
}

/**
 * 全部服务器连接数历史按时间点求和(汇总格右栏小图用)。各台的采样条数可能不同,按「最近」对齐
 * (从末尾往前数),没数据的点当 0;一台都没有历史就返回 undefined。
 */
export function connHistoryTotals(servers: ProbeOverviewServer[]) {
  let len = 0;
  for (const s of servers)
    len = Math.max(
      len,
      s.conn_history?.tcp.length ?? 0,
      s.conn_history?.udp.length ?? 0,
    );
  if (!len) return undefined;
  const tcp = new Array<number>(len).fill(0);
  const udp = new Array<number>(len).fill(0);
  for (const s of servers) {
    const h = s.conn_history;
    if (!h) continue;
    const add = (src: (number | null)[], dst: number[]) => {
      const off = len - src.length;
      src.forEach((v, i) => {
        if (v !== null && v !== undefined) dst[off + i] += v;
      });
    };
    add(h.tcp, tcp);
    add(h.udp, udp);
  }
  return { tcp, udp };
}

/** 最近到期的几台(含已过期,天数为负),按剩余天数升序。 */
export function upcomingExpiries(
  servers: ProbeOverviewServer[],
  now = Date.now(),
  limit = 3,
) {
  const list: { name: string; days: number }[] = [];
  for (const s of servers) {
    if (!s.expires_at) continue;
    const end = new Date(`${s.expires_at}T23:59:59`).getTime();
    if (Number.isNaN(end)) continue;
    list.push({ name: s.name || "", days: Math.floor((end - now) / 86400000) });
  }
  return list.sort((a, b) => a.days - b.days).slice(0, limit);
}
