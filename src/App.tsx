import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Lottie from "lottie-react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Gauge,
  Globe2,
  HardDrive,
  LayoutGrid,
  List,
  MapPin,
  MemoryStick,
  Monitor,
  PieChart,
  Server,
  Wallet,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  siAlmalinux,
  siAlpinelinux,
  siApple,
  siArchlinux,
  siCentos,
  siDebian,
  siFedora,
  siFreebsd,
  siGentoo,
  siKalilinux,
  siLinux,
  siLinuxmint,
  siNixos,
  siOpensuse,
  siProxmox,
  siRedhat,
  siRockylinux,
  siUbuntu,
} from "simple-icons";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ProbeBucket,
  ProbePingSeries,
  ProbeReturnRoute,
  ProbeServer,
} from "./types";
import { useProbe } from "./use-probe";
import { ThemeSwitch } from "./ThemeSwitch";
import { Twemoji } from "./Twemoji";
import { displayServerName } from "./server-name";
import {
  billableTraffic,
  bootTraffic,
  dailyTrafficRows,
  hasTrafficPeriod,
  trafficFormulaLabel,
  trafficRuleLabel,
  trafficUsageLabel,
  type TrafficRange,
} from "./traffic-display";
import commonRouteAnimation from "./assets/return-route/common.json";
import premiumRouteAnimation from "./assets/return-route/premium.json";
import {
  effectiveProbeLineKey,
  probeLinesForScope,
  type ProbeLineScope,
} from "./probe-line-scope";

const colors = [
  "#8b5cf6",
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];
const RegionGlobe = lazy(() =>
  import("./RegionGlobe").then((module) => ({ default: module.RegionGlobe })),
);
const PremiumProbePage = lazy(() =>
  import("./PremiumProbePage").then((module) => ({
    default: module.PremiumProbePage,
  })),
);
const ranges = [
  {
    key: "1h",
    label: "1 小时",
    bucketLabel: (index: number, count: number) => `-${(count - index) * 5}m`,
  },
  {
    key: "6h",
    label: "6 小时",
    bucketLabel: (index: number, count: number) =>
      `-${(((count - index) * 10) / 60).toFixed(1)}h`,
  },
  {
    key: "24h",
    label: "24 小时",
    bucketLabel: (index: number, count: number) =>
      `-${(((count - index) * 30) / 60).toFixed(0)}h`,
  },
] as const;
type RangeKey = (typeof ranges)[number]["key"];

function formatAxisDateTime(unixSeconds: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(unixSeconds * 1000));
}

function HorizontalChart({
  children,
  width,
}: {
  children: ReactNode;
  width: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);
  return (
    <div className="chart-scroll-frame">
      <div className="chart-fixed-y-axis" aria-hidden="true">
        <div className="chart-scroll-inner" style={{ width, minWidth: "100%" }}>
          {children}
        </div>
      </div>
      <div
        ref={ref}
        className="chart-scroll"
        style={{ touchAction: "pan-x pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !ref.current) return;
          drag.current = { x: e.clientX, left: ref.current.scrollLeft };
          ref.current.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current && ref.current)
            ref.current.scrollLeft =
              drag.current.left - (e.clientX - drag.current.x);
        }}
        onPointerUp={(e) => {
          drag.current = null;
          ref.current?.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div className="chart-scroll-inner" style={{ width, minWidth: "100%" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function bytes(value = 0, decimal = true): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = Math.max(0, value);
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(decimal && i >= 2 ? 1 : 0)} ${units[i]}`;
}

function signedBytes(value: number): string {
  if (value === 0) return bytes(0, false);
  return `${value > 0 ? "+" : "−"}${bytes(Math.abs(value), false)}`;
}

function speed(value = 0): string {
  return `${bytes(value)}/s`;
}
function bitSpeed(bytesPerSecond = 0): string {
  let value = Math.max(0, bytesPerSecond) * 8;
  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unit]}`;
}
function speedScale(bytesPerSecond: number): {
  percent: number;
  label: string;
} {
  const bps = Math.max(0, bytesPerSecond) * 8;
  const steps = [1e6, 10e6, 100e6, 1e9, 10e9, 100e9, 1e12];
  const ceiling =
    steps.find((value) => bps <= value) || steps[steps.length - 1];
  return {
    percent: Math.min(100, (bps / ceiling) * 100),
    label: bitSpeed(ceiling / 8),
  };
}
const cycleLabel = {
  month: "月",
  quarter: "季",
  half_year: "半年",
  year: "年",
} as const;
function expiring(server: ProbeServer): boolean {
  if (!server.expires_at) return false;
  const days =
    (new Date(`${server.expires_at}T23:59:59`).getTime() - Date.now()) /
    86400000;
  return days >= 0 && days <= 30;
}
function expired(server: ProbeServer): boolean {
  return (
    !!server.expires_at &&
    new Date(`${server.expires_at}T23:59:59`).getTime() < Date.now()
  );
}
function remainingDays(value?: string): string {
  if (!value) return "";
  const days = Math.ceil(
    (new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86400000,
  );
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天到期";
  return `剩余 ${days} 天`;
}
function regionFlag(region?: string): string {
  const points = [...(region?.trim() || "")].map(
    (char) => char.codePointAt(0) || 0,
  );
  if (
    points.length === 2 &&
    points.every((point) => point >= 0x1f1e6 && point <= 0x1f1ff)
  )
    return region!.trim();
  const country = region
    ?.trim()
    .split(/[·,\s]+/)[0]
    ?.toUpperCase();
  if (!country || !/^[A-Z]{2}$/.test(country)) return "";
  return String.fromCodePoint(
    ...[...country].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}
function countryCodeFromRegion(value?: string): string {
  const text = value?.trim() || "";
  const flag = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u)?.[0];
  if (flag) {
    return [...flag]
      .map((char) =>
        String.fromCharCode((char.codePointAt(0) || 0) - 0x1f1e6 + 65),
      )
      .join("");
  }
  const code = text.split(/[·,\s]+/)[0]?.toUpperCase() || "";
  return /^[A-Z]{2}$/.test(code) ? code : "";
}
function probeCountryCode(server: ProbeServer): string {
  return (
    countryCodeFromRegion(server.region_country) ||
    countryCodeFromRegion(server.region)
  );
}
function SpeedSummary({
  label,
  value,
  direction,
}: {
  label: string;
  value: number;
  direction: "up" | "down";
}) {
  const scale = speedScale(value);
  return (
    <div className={`speed-summary ${direction}`}>
      <div>
        <span>
          {direction === "up" ? <ArrowUp size={19} /> : <ArrowDown size={19} />}
          {label}
        </span>
        <strong>{bitSpeed(value)}</strong>
      </div>
      <div className="speed-progress">
        <i style={{ width: `${scale.percent}%` }} />
        <small>{scale.label}</small>
      </div>
    </div>
  );
}
function pct(used = 0, total = 0): number {
  return total > 0 ? Math.min(100, (used * 100) / total) : 0;
}

function Meter({
  icon,
  label,
  value,
  percent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <div className="metric">
      <div className="metric-head">
        <span>
          {icon}
          {label}
        </span>
        <strong>{value}</strong>
      </div>
      <div className="meter">
        <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  );
}

function TrafficDialog({
  server,
  close,
}: {
  server: ProbeServer;
  close: () => void;
}) {
  const hasPeriod = hasTrafficPeriod(server);
  const [range, setRange] = useState<TrafficRange>(() =>
    hasPeriod ? "period" : "recent7",
  );
  const rows = dailyTrafficRows(server, range);
  const total = rows.reduce(
    (sum, row) => sum + (row.total || row.uplink + row.downlink),
    0,
  );
  const formula = trafficFormulaLabel(server);
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h2>{server.name} · 原始上下行日流量趋势</h2>
          <button type="button" aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <div className="traffic-dialog-toolbar">
          <div className="traffic-range" role="group" aria-label="趋势范围">
            {hasPeriod && (
              <button
                type="button"
                className={range === "period" ? "active" : ""}
                onClick={() => setRange("period")}
              >
                当前周期
              </button>
            )}
            <button
              type="button"
              className={range === "recent7" ? "active" : ""}
              onClick={() => setRange("recent7")}
            >
              最近 7 日
            </button>
          </div>
          <strong>
            {range === "period" ? "当前周期" : "最近 7 日"}原始合计：
            {bytes(total, false)}
          </strong>
          <small>
            趋势展示原始上、下行，不应用计费方向或对账调整；卡片按
            {trafficRuleLabel(server)}计费
            {formula ? `（${formula}）` : ""}。
          </small>
        </div>
        <div className="chart">
          {rows.length === 0 ? (
            <div className="empty traffic-empty">暂无每日流量趋势数据</div>
          ) : (
            <HorizontalChart width={Math.max(760, rows.length * 82)}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rows}
                  margin={{ top: 8, right: 12, bottom: 0, left: 8 }}
                >
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    minTickGap={28}
                  />
                  <YAxis
                    width={62}
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => bytes(Number(value), false)}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    labelFormatter={(value) => String(value)}
                    formatter={(value, name) => [
                      bytes(Number(value)),
                      name === "uplink" || name === "上行" ? "上行" : "下行",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="uplink"
                    name="上行"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="downlink"
                    name="下行"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </HorizontalChart>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function systemTitle(server: ProbeServer): string {
  return (
    [server.os, server.kernel, server.arch].filter(Boolean).join(" · ") ||
    "系统信息未上报"
  );
}
const systemIcons = [
  { terms: ["alma"], icon: siAlmalinux },
  { terms: ["alpine"], icon: siAlpinelinux },
  { terms: ["arch"], icon: siArchlinux },
  { terms: ["centos"], icon: siCentos },
  { terms: ["debian"], icon: siDebian },
  { terms: ["fedora"], icon: siFedora },
  { terms: ["freebsd"], icon: siFreebsd },
  { terms: ["gentoo"], icon: siGentoo },
  { terms: ["kali"], icon: siKalilinux },
  { terms: ["mint"], icon: siLinuxmint },
  { terms: ["nixos", "nix os"], icon: siNixos },
  { terms: ["opensuse", "open suse", "suse"], icon: siOpensuse },
  { terms: ["proxmox"], icon: siProxmox },
  { terms: ["red hat", "redhat", "rhel"], icon: siRedhat },
  { terms: ["rocky"], icon: siRockylinux },
  { terms: ["ubuntu"], icon: siUbuntu },
  { terms: ["darwin", "macos", "mac os"], icon: siApple },
];
function SystemIcon({ server }: { server: ProbeServer }) {
  const os = (server.os || "").toLowerCase();
  if (os.includes("windows")) return <Monitor size={16} />;
  const icon =
    systemIcons.find(({ terms }) => terms.some((term) => os.includes(term)))
      ?.icon ?? siLinux;
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      role="img"
      viewBox="0 0 24 24"
      fill={`#${icon.hex}`}
    >
      <path d={icon.path} />
    </svg>
  );
}

function averagePing(series: ProbePingSeries[]): ProbePingSeries {
  const count = series[0]?.buckets.length || 0;
  const buckets: ProbeBucket[] = Array.from({ length: count }, (_, index) => {
    const values = series.map((item) => item.buckets[index]).filter(Boolean);
    const ms = values.filter((v) => v.ms >= 0).map((v) => v.ms);
    const loss = values.filter((v) => v.loss >= 0).map((v) => v.loss);
    return {
      ms: ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : -1,
      loss: loss.length ? loss.reduce((a, b) => a + b, 0) / loss.length : -1,
    };
  });
  const current = series
    .filter((item) => item.current_ms >= 0)
    .map((item) => item.current_ms);
  return {
    key: "__avg__",
    label: "平均",
    current_ms: current.length
      ? current.reduce((a, b) => a + b, 0) / current.length
      : -1,
    loss_pct: series.length
      ? series.reduce((sum, item) => sum + item.loss_pct, 0) / series.length
      : 0,
    buckets,
  };
}

function lossScale(rows: Array<Record<string, string | number | null>>) {
  const peak = Math.max(
    0,
    ...rows.flatMap((row) =>
      Object.entries(row)
        .filter(([key]) => key !== "time")
        .map(([, value]) => (typeof value === "number" ? value : 0)),
    ),
  );
  const scales = [
    { max: 0.1, step: 0.025 },
    { max: 0.2, step: 0.05 },
    { max: 0.5, step: 0.1 },
    { max: 1, step: 0.25 },
    { max: 2, step: 0.5 },
    { max: 5, step: 1 },
    { max: 10, step: 2 },
    { max: 20, step: 5 },
    { max: 50, step: 10 },
    { max: 100, step: 25 },
  ];
  const selected =
    scales.find((item) => peak <= item.max) ?? scales[scales.length - 1];
  return {
    max: selected.max,
    ticks: Array.from(
      { length: Math.round(selected.max / selected.step) + 1 },
      (_, index) => Number((index * selected.step).toFixed(3)),
    ),
  };
}

function formatLossTick(value: number): string {
  const digits = value < 0.1 ? 3 : value < 1 ? 2 : value < 10 ? 1 : 0;
  return `${value.toFixed(digits).replace(/\.?0+$/, "")}%`;
}

function TrendDialog({
  serverIndex,
  initial,
  targetKey,
  title,
  mode,
  close,
}: {
  serverIndex: number;
  initial: ProbePingSeries[];
  targetKey: string;
  title: string;
  mode: "latency" | "loss";
  close: () => void;
}) {
  const [range, setRange] = useState<RangeKey>("1h");
  const [series, setSeries] = useState<ProbePingSeries[]>(initial);
  const [lineScope, setLineScope] = useState<ProbeLineScope>("all");
  const [selectedLineKey, setSelectedLineKey] = useState(targetKey);
  const [loading, setLoading] = useState(false);
  const [timeMeta, setTimeMeta] = useState({
    generatedAt: Math.floor(Date.now() / 1000),
    bucketSec: 300,
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/series?server=${serverIndex}&range=${range}&all=1`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{
          success: boolean;
          series?: ProbePingSeries;
          all_series?: ProbePingSeries[];
          generated_at?: number;
          bucket_sec?: number;
        }>;
      })
      .then((payload) => {
        if (payload.success) {
          setSeries([
            ...(payload.series
              ? [{ ...payload.series, key: "__avg__", label: "平均" }]
              : []),
            ...(payload.all_series || []),
          ]);
          setTimeMeta({
            generatedAt: payload.generated_at ?? Math.floor(Date.now() / 1000),
            bucketSec:
              payload.bucket_sec ??
              (range === "1h" ? 300 : range === "6h" ? 600 : 1800),
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, serverIndex]);

  const visibleSeries = useMemo(
    () => probeLinesForScope(series, lineScope),
    [series, lineScope],
  );
  const effectiveLineKey = effectiveProbeLineKey(
    series,
    lineScope,
    selectedLineKey,
  );

  useEffect(() => {
    if (effectiveLineKey !== selectedLineKey) {
      setSelectedLineKey(effectiveLineKey);
    }
  }, [effectiveLineKey, selectedLineKey]);

  const rows = useMemo(
    () =>
      Array.from(
        { length: visibleSeries[0]?.buckets.length || 0 },
        (_, index) => {
          const row: Record<string, string | number | null> = {
            time: formatAxisDateTime(
              timeMeta.generatedAt -
                (timeMeta.generatedAt % timeMeta.bucketSec) -
                ((visibleSeries[0]?.buckets.length || 0) - 1 - index) *
                  timeMeta.bucketSec,
            ),
          };
          for (const item of visibleSeries) {
            const bucket = item.buckets[index];
            const value = mode === "loss" ? bucket?.loss : bucket?.ms;
            row[item.key || item.label] =
              value !== undefined && value >= 0 ? value : null;
          }
          return row;
        },
      ),
    [visibleSeries, mode, timeMeta],
  );
  const dynamicLossScale = useMemo(() => lossScale(rows), [rows]);

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2>
            {title} · {mode === "loss" ? "丢包率趋势" : "延迟趋势"}
          </h2>
          <button aria-label="关闭" onClick={close}>
            ×
          </button>
        </header>
        <div className="ranges">
          {ranges.map((item) => (
            <button
              type="button"
              className={range === item.key ? "active" : ""}
              onClick={() => setRange(item.key)}
              key={item.key}
            >
              {item.label}
            </button>
          ))}
          <span className="ranges-sep" />
          {(["all", "cn", "idc"] as const).map((scope) => (
            <button
              type="button"
              className={lineScope === scope ? "active" : ""}
              onClick={() => setLineScope(scope)}
              key={scope}
            >
              {scope === "all" ? "全部" : scope === "cn" ? "内地" : "海外"}
            </button>
          ))}
          {visibleSeries.length > 0 && (
            <select
              aria-label="当前探测线路"
              value={effectiveLineKey}
              onChange={(event) => setSelectedLineKey(event.target.value)}
            >
              {visibleSeries.map((item) => {
                const key = item.key || item.label;
                return (
                  <option value={key} key={key}>
                    {item.label}
                  </option>
                );
              })}
            </select>
          )}
        </div>
        <div className="chart">
          {loading && <div className="loading-overlay">加载中…</div>}
          {!loading && visibleSeries.length === 0 && (
            <div className="chart-empty">
              该服务器未配置{lineScope === "cn" ? "内地" : "海外"}探测点
            </div>
          )}
          <HorizontalChart width={Math.max(760, rows.length * 82)}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
              >
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  minTickGap={28}
                />
                <YAxis
                  width={52}
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  unit={mode === "loss" ? undefined : "ms"}
                  domain={
                    mode === "loss" ? [0, dynamicLossScale.max] : undefined
                  }
                  ticks={mode === "loss" ? dynamicLossScale.ticks : undefined}
                  tickFormatter={
                    mode === "loss"
                      ? (value) => formatLossTick(Number(value))
                      : undefined
                  }
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(value, _name, item) => [
                    `${Number(value).toFixed(mode === "loss" ? 1 : 0)}${mode === "loss" ? "%" : "ms"}`,
                    visibleSeries.find(
                      (line) => (line.key || line.label) === item.dataKey,
                    )?.label || String(item.dataKey),
                  ]}
                />
                {visibleSeries.map((item, index) => {
                  const key = item.key || item.label;
                  const active = key === effectiveLineKey;
                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={item.label}
                      stroke={
                        key === "__avg__"
                          ? "var(--foreground, #2f2350)"
                          : colors[index % colors.length]
                      }
                      strokeWidth={active ? 2.5 : 1}
                      strokeOpacity={active ? 1 : 0.45}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </HorizontalChart>
        </div>
        {visibleSeries.length > 1 && (
          <div className="legend">
            {visibleSeries.map((item, index) => {
              const key = item.key || item.label;
              return (
                <span
                  className={key === effectiveLineKey ? "active" : ""}
                  key={key}
                >
                  <i
                    style={{
                      background:
                        key === "__avg__"
                          ? "var(--foreground, #2f2350)"
                          : colors[index % colors.length],
                    }}
                  />
                  {item.label}
                </span>
              );
            })}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}

function PingPanel({
  ping,
  serverIndex,
}: {
  ping: ProbePingSeries[];
  serverIndex: number;
}) {
  const [mode, setMode] = useState<"latency" | "loss" | null>(null);
  const [selected, setSelected] = useState("__avg__");
  const average = averagePing(ping);
  const lines = [{ ...average, key: "__avg__" }, ...ping];
  const current =
    selected === "__avg__"
      ? average
      : ping.find((item) => (item.key || item.label) === selected) || average;
  const blocks = (kind: "latency" | "loss") =>
    current.buckets.map((bucket, index) => {
      const value = kind === "loss" ? bucket.loss : bucket.ms;
      const level =
        value < 0
          ? "none"
          : kind === "loss"
            ? value >= 20
              ? "bad"
              : value > 0
                ? "warn"
                : "good"
            : value >= 200
              ? "warn"
              : "good";
      return <i key={index} className={level} />;
    });
  return (
    <>
      <div className="ping-grid">
        <div className="ping-head">
          <span>
            <Clock size={14} />
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="__avg__">平均</option>
              {ping.map((item) => (
                <option
                  key={item.key || item.label}
                  value={item.key || item.label}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </span>
          <strong>
            {current.current_ms < 0
              ? "超时"
              : `${current.current_ms.toFixed(0)} ms`}
          </strong>
        </div>
        <div className="ping-head">
          <span>
            <Wifi size={14} />
            丢包率
          </span>
          <strong className={current.loss_pct > 0 ? "warning" : ""}>
            {current.loss_pct.toFixed(1)}%
          </strong>
        </div>
        <button
          className="ping-blocks"
          type="button"
          aria-label="查看延迟趋势"
          onClick={() => setMode("latency")}
        >
          {blocks("latency")}
        </button>
        <button
          className="ping-blocks"
          type="button"
          aria-label="查看丢包率趋势"
          onClick={() => setMode("loss")}
        >
          {blocks("loss")}
        </button>
      </div>
      {mode && (
        <TrendDialog
          serverIndex={serverIndex}
          initial={lines}
          targetKey={selected}
          title={current.label}
          mode={mode}
          close={() => setMode(null)}
        />
      )}
    </>
  );
}

const routeCarrierLabels = {
  telecom: "电信",
  unicom: "联通",
  mobile: "移动",
} as const;
const goldRoutes = new Set(["CN2GIA", "CTGGIA", "9929", "CMIN2", "163PP"]);
function displayReturnRoute(route: string): string {
  return route.toUpperCase().replace(/[^A-Z0-9]/g, "") === "CMIN"
    ? "CMI"
    : route;
}

function ReturnRouteIcon({ premium }: { premium: boolean }) {
  return (
    <Lottie
      animationData={premium ? premiumRouteAnimation : commonRouteAnimation}
      aria-hidden="true"
      className="route-badge-icon"
      loop
    />
  );
}

function ReturnRouteBadges({
  routes,
  telecomPaidPeer,
}: {
  routes: ProbeReturnRoute[];
  telecomPaidPeer?: boolean;
}) {
  const byCarrier = new Map(routes.map((route) => [route.carrier, route]));
  return (
    <div className="return-route-badges">
      {(["telecom", "unicom", "mobile"] as const).map((carrier) => {
        const route = byCarrier.get(carrier);
        const detectedRouteType = displayReturnRoute(
          route?.route_type || "Unknown",
        );
        const routeType =
          carrier === "telecom" &&
          telecomPaidPeer &&
          detectedRouteType === "163"
            ? "163 PP"
            : detectedRouteType;
        const premium = goldRoutes.has(
          routeType.toUpperCase().replace(/[^A-Z0-9]/g, ""),
        );
        return (
          <div
            className="route-badge"
            key={carrier}
            title={route?.region ? `${route.region} · ${routeType}` : routeType}
          >
            <div
              className={
                premium
                  ? "route-badge-animation gold"
                  : "route-badge-animation silver"
              }
            >
              <ReturnRouteIcon premium={premium} />
            </div>
            <div
              className={
                premium ? "route-badge-text gold" : "route-badge-text silver"
              }
            >
              <small>{routeCarrierLabels[carrier]}</small>
              <strong>{routeType}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServerCard({ server, index }: { server: ProbeServer; index: number }) {
  const [trafficOpen, setTrafficOpen] = useState(false);
  const name = server.name || `服务器 ${index + 1}`;
  const flag = regionFlag(server.region_country || server.region);
  const trafficUsed = billableTraffic(server);
  const currentBoot = bootTraffic(server);
  const formula = trafficFormulaLabel(server);
  return (
    <article className="server-card">
      <div className="server-title">
        <span className={server.online ? "status online" : "status"} />
        <h2>
          <Twemoji>
            {displayServerName(name, `服务器 ${index + 1}`, flag)}
          </Twemoji>
        </h2>
        <span title={systemTitle(server)}>
          <SystemIcon server={server} />
        </span>
      </div>
      <div className="metrics">
        {server.cpu_pct !== undefined && (
          <Meter
            icon={<Cpu size={14} />}
            label="CPU"
            value={`${server.cpu_pct.toFixed(1)}%`}
            percent={server.cpu_pct}
          />
        )}
        {server.mem_total !== undefined && (
          <Meter
            icon={<MemoryStick size={14} />}
            label="内存"
            value={`${pct(server.mem_used, server.mem_total).toFixed(1)}%`}
            percent={pct(server.mem_used, server.mem_total)}
          />
        )}
        {server.disk_total !== undefined && (
          <Meter
            icon={<HardDrive size={14} />}
            label="硬盘"
            value={`${pct(server.disk_used, server.disk_total).toFixed(1)}%`}
            percent={pct(server.disk_used, server.disk_total)}
          />
        )}
        {trafficUsed !== undefined && (
          <button
            type="button"
            className="metric metric-button"
            onClick={() => setTrafficOpen(true)}
          >
            <div className="metric-head">
              <span>
                <PieChart size={14} />
                {trafficUsageLabel(server)}
              </span>
              <strong>
                {server.traffic_limit
                  ? `${bytes(trafficUsed, false)} / ${bytes(server.traffic_limit, false)}`
                  : bytes(trafficUsed, false)}
              </strong>
            </div>
            <div className="meter">
              <i
                style={{
                  width: `${pct(trafficUsed, server.traffic_limit)}%`,
                }}
              />
            </div>
            <span className="metric-hover-detail">
              <small>计费规则：{trafficRuleLabel(server)}</small>
              {formula && <small>计费用量 = {formula}</small>}
              {(server.traffic_used_up !== undefined ||
                server.traffic_used_down !== undefined) && (
                <small>
                  原始周期 ↑ {bytes(server.traffic_used_up, false)} · ↓{" "}
                  {bytes(server.traffic_used_down, false)}
                </small>
              )}
              {server.traffic_adjustment !== undefined &&
                server.traffic_adjustment !== 0 && (
                  <small>
                    对账调整：{signedBytes(server.traffic_adjustment)}
                  </small>
                )}
              {server.period_start && server.period_end && (
                <small>
                  {server.period_start} — {server.period_end}
                </small>
              )}
              {!!server.daily_traffic?.length && (
                <small>点击查看原始上下行趋势</small>
              )}
            </span>
          </button>
        )}
      </div>
      {(server.upload_speed !== undefined ||
        server.download_speed !== undefined) && (
        <div className="speed">
          <span className="download">
            <ArrowDown size={16} />
            {speed(server.download_speed)}
          </span>
          <span className="upload">
            <ArrowUp size={16} />
            {speed(server.upload_speed)}
          </span>
        </div>
      )}
      {(currentBoot.uplink !== undefined ||
        currentBoot.downlink !== undefined) && (
        <div className="cumulative-traffic">
          <small>本次开机网卡</small>
          <span>↓ {bytes(currentBoot.downlink, false)}</span>
          <span>↑ {bytes(currentBoot.uplink, false)}</span>
        </div>
      )}
      {!!server.ping?.length && (
        <PingPanel ping={server.ping} serverIndex={index} />
      )}
      {!!server.return_routes?.length && (
        <ReturnRouteBadges
          routes={server.return_routes}
          telecomPaidPeer={server.telecom_paid_peer}
        />
      )}
      {(server.expires_at || server.renewal_price !== undefined) && (
        <div className="server-meta">
          {server.expires_at &&
            (server.provider_url ? (
              <a
                href={server.provider_url}
                target="_blank"
                rel="noopener noreferrer"
                className={expiring(server) || expired(server) ? "warning" : ""}
                title={
                  server.provider_name
                    ? `前往 ${server.provider_name} 续费`
                    : "前往服务商续费"
                }
              >
                <CalendarClock size={13} />
                {remainingDays(server.expires_at)}
              </a>
            ) : (
              <span
                className={expiring(server) || expired(server) ? "warning" : ""}
              >
                <CalendarClock size={13} />
                {remainingDays(server.expires_at)}
              </span>
            ))}
          {server.renewal_price !== undefined && (
            <span>
              <Wallet size={13} />
              {server.renewal_price_cny !== undefined
                ? `¥${server.renewal_price_cny.toFixed(2)}`
                : `${server.renewal_currency || "CNY"} ${server.renewal_price}`}{" "}
              / {cycleLabel[server.renewal_cycle || "month"]}
              {server.renewal_price_cny !== undefined &&
                server.renewal_currency !== "CNY" && (
                  <small>
                    （{server.renewal_currency} {server.renewal_price}）
                  </small>
                )}
            </span>
          )}
        </div>
      )}
      {trafficOpen && (
        <TrafficDialog server={server} close={() => setTrafficOpen(false)} />
      )}
    </article>
  );
}

function TableMetric({ label, percent }: { label: string; percent?: number }) {
  return (
    <div className="table-metric">
      <span className="table-metric-head">
        <small>{label}</small>
        <span>{percent === undefined ? "—" : `${percent.toFixed(1)}%`}</span>
      </span>
      <div className="meter">
        {percent !== undefined && (
          <i style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        )}
      </div>
    </div>
  );
}

function TableResources({ server }: { server: ProbeServer }) {
  const memory = server.mem_total
    ? pct(server.mem_used, server.mem_total)
    : undefined;
  const disk = server.disk_total
    ? pct(server.disk_used, server.disk_total)
    : undefined;
  return (
    <div className="table-resources">
      <div className="table-resource-row">
        <TableMetric label="CPU" percent={server.cpu_pct} />
      </div>
      <div className="table-resource-row">
        <TableMetric label="内存" percent={memory} />
      </div>
      <div className="table-resource-row">
        <TableMetric label="硬盘" percent={disk} />
      </div>
      <div className="table-resource-row">
        <TableTraffic server={server} label={trafficUsageLabel(server)} />
      </div>
    </div>
  );
}

function TablePing({
  ping,
  serverIndex,
}: {
  ping?: ProbePingSeries[];
  serverIndex: number;
}) {
  const [latencyOpen, setLatencyOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  if (!ping?.length) return <span className="dash">—</span>;
  const average = averagePing(ping);
  const lines = [{ ...average, key: "__avg__" }, ...ping];
  return (
    <>
      <div className="table-ping-pair">
        <button
          className="table-ping"
          type="button"
          onClick={() => setLatencyOpen(true)}
        >
          <span>
            <small>延迟</small>
            <strong>
              {average.current_ms < 0
                ? "超时"
                : `${average.current_ms.toFixed(0)} ms`}
            </strong>
          </span>
          <em>
            {average.buckets.map((bucket, index) => (
              <i
                key={index}
                className={
                  bucket.ms < 0 && bucket.loss < 0
                    ? "none"
                    : bucket.ms < 0
                      ? "bad"
                      : bucket.ms >= 200
                        ? "warn"
                        : "good"
                }
              />
            ))}
          </em>
        </button>
        <button
          className="table-ping"
          type="button"
          onClick={() => setLossOpen(true)}
        >
          <span>
            <small>丢包</small>
            <b>{average.loss_pct.toFixed(1)}%</b>
          </span>
          <em>
            {average.buckets.map((bucket, index) => (
              <i
                key={index}
                className={
                  bucket.loss < 0
                    ? "none"
                    : bucket.loss >= 20
                      ? "bad"
                      : bucket.loss > 0
                        ? "warn"
                        : "good"
                }
              />
            ))}
          </em>
        </button>
      </div>
      {latencyOpen && (
        <TrendDialog
          serverIndex={serverIndex}
          initial={lines}
          targetKey="__avg__"
          title="平均"
          mode="latency"
          close={() => setLatencyOpen(false)}
        />
      )}
      {lossOpen && (
        <TrendDialog
          serverIndex={serverIndex}
          initial={lines}
          targetKey="__avg__"
          title="平均"
          mode="loss"
          close={() => setLossOpen(false)}
        />
      )}
    </>
  );
}

function TableTraffic({
  server,
  label,
}: {
  server: ProbeServer;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const trafficUsed = billableTraffic(server);
  const formula = trafficFormulaLabel(server);
  if (trafficUsed === undefined) return <span className="dash">—</span>;
  return (
    <>
      <button
        type="button"
        className="table-traffic table-traffic-button"
        onClick={() => setOpen(true)}
      >
        <span className="table-metric-head">
          <small>{label || trafficUsageLabel(server)}</small>
          <span>
            {server.traffic_limit
              ? `${bytes(trafficUsed, false)} / ${bytes(server.traffic_limit, false)}`
              : bytes(trafficUsed, false)}
          </span>
        </span>
        <small>计费规则：{trafficRuleLabel(server)}</small>
        {formula && <small>计费用量 = {formula}</small>}
        {(server.traffic_used_up !== undefined ||
          server.traffic_used_down !== undefined) && (
          <small>
            原始周期 ↑ {bytes(server.traffic_used_up, false)} · ↓{" "}
            {bytes(server.traffic_used_down, false)}
          </small>
        )}
        {server.traffic_adjustment !== undefined &&
          server.traffic_adjustment !== 0 && (
            <small>对账调整：{signedBytes(server.traffic_adjustment)}</small>
          )}
        {server.period_start && server.period_end && (
          <small>
            {server.period_start} — {server.period_end}
          </small>
        )}
        {!!server.traffic_limit && (
          <div className="meter">
            <i
              style={{
                width: `${pct(trafficUsed, server.traffic_limit)}%`,
              }}
            />
          </div>
        )}
      </button>
      {open && <TrafficDialog server={server} close={() => setOpen(false)} />}
    </>
  );
}

function TableBootTraffic({ server }: { server: ProbeServer }) {
  const currentBoot = bootTraffic(server);
  if (currentBoot.uplink === undefined && currentBoot.downlink === undefined) {
    return <span className="dash">—</span>;
  }
  return (
    <span className="table-cumulative">
      <span>↑ {bytes(currentBoot.uplink, false)}</span>
      <span>↓ {bytes(currentBoot.downlink, false)}</span>
    </span>
  );
}

function TableRenewal({ server }: { server: ProbeServer }) {
  if (!server.expires_at && server.renewal_price === undefined)
    return <span className="dash">—</span>;
  return (
    <div className="table-renewal">
      {server.expires_at &&
        (server.provider_url ? (
          <a
            href={server.provider_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <CalendarClock size={13} /> {remainingDays(server.expires_at)}
          </a>
        ) : (
          <span>
            <CalendarClock size={13} /> {remainingDays(server.expires_at)}
          </span>
        ))}
      {server.renewal_price !== undefined && (
        <span>
          <Wallet size={13} />
          {server.renewal_price_cny !== undefined
            ? `¥${server.renewal_price_cny.toFixed(2)}`
            : `${server.renewal_currency || "CNY"} ${server.renewal_price}`}{" "}
          / {cycleLabel[server.renewal_cycle || "month"]}
        </span>
      )}
    </div>
  );
}

function ServerTable({ servers }: { servers: ProbeServer[] }) {
  return (
    <section className="server-table-wrap">
      <div className="table-scroll">
        <table className="server-table">
          <thead>
            <tr>
              <th>服务器</th>
              <th>状态</th>
              <th>资源与流量</th>
              <th>网速</th>
              <th>本次开机网卡</th>
              <th>延迟</th>
              <th>三网回程</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server, index) => {
              return (
                <tr key={`${server.name}-${index}`}>
                  <td className="table-name">
                    <span className="table-name-line">
                      {server.provider_url ? (
                        <a
                          href={server.provider_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Twemoji>
                            {displayServerName(
                              server.name,
                              `服务器 ${index + 1}`,
                              regionFlag(
                                server.region_country || server.region,
                              ),
                            )}
                          </Twemoji>
                        </a>
                      ) : (
                        <Twemoji>
                          {displayServerName(
                            server.name,
                            `服务器 ${index + 1}`,
                            regionFlag(server.region_country || server.region),
                          )}
                        </Twemoji>
                      )}
                      <span title={systemTitle(server)}>
                        <SystemIcon server={server} />
                      </span>
                    </span>
                    <TableRenewal server={server} />
                  </td>
                  <td>
                    <span className="table-status">
                      <i className={server.online ? "online" : ""} />
                      {server.online ? "在线" : "离线"}
                    </span>
                  </td>
                  <td>
                    <TableResources server={server} />
                  </td>
                  <td>
                    <span className="table-speed">
                      <span aria-label={`上传 ${speed(server.upload_speed)}`}>
                        <ArrowUp size={14} aria-hidden="true" />
                        <small>上传</small>
                        {speed(server.upload_speed)}
                      </span>
                      <span aria-label={`下载 ${speed(server.download_speed)}`}>
                        <ArrowDown size={14} aria-hidden="true" />
                        <small>下载</small>
                        {speed(server.download_speed)}
                      </span>
                    </span>
                  </td>
                  <td>
                    <TableBootTraffic server={server} />
                  </td>
                  <td>
                    <TablePing ping={server.ping} serverIndex={index} />
                  </td>
                  <td className="table-routes">
                    {server.return_routes?.length ? (
                      <ReturnRouteBadges
                        routes={server.return_routes}
                        telecomPaidPeer={server.telecom_paid_peer}
                      />
                    ) : (
                      <span className="dash">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProbeLicenseNameplate({
  name,
  displayName,
}: {
  name?: string;
  displayName?: string;
}) {
  const label = [name?.trim(), displayName?.trim()].filter(Boolean).join(" · ");
  const plateRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const starsRef = useRef<HTMLSpanElement>(null);
  const shineRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const plate = plateRef.current;
    const text = textRef.current;
    const stars = starsRef.current;
    const shine = shineRef.current;
    if (!plate || !text || !stars || !shine) return;

    const palette = ["#f9a8d4", "#f472b6", "#ec4899", "#fbcfe8", "#ff8fc7"];
    const random = (min: number, max: number) =>
      min + Math.random() * (max - min);
    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const easeOutBack = (value: number) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
    };
    const easeInBack = (value: number) => {
      const c1 = 1.70158;
      return (c1 + 1) * value * value * value - c1 * value * value;
    };

    stars.innerHTML = "";
    const height = stars.clientHeight || 24;
    const makeStar = (topFor: (size: number) => number) => {
      const star = document.createElement("i");
      star.className = "spark";
      star.style.color = palette[Math.floor(Math.random() * palette.length)];
      const size = Math.round(random(8, 13));
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      star.style.top = `${Math.round(topFor(size))}px`;
      star.style.left = `${Math.round(random(0, 12))}px`;
      stars.appendChild(star);
    };
    for (let index = 0; index < 5; index++)
      makeStar((size) => random(0, Math.max(0, height - size)));
    makeStar((size) => -size * 0.6);
    makeStar((size) => height - size * 0.4);

    let width = plate.offsetWidth;
    const updateWidth = () => {
      width = plate.offsetWidth;
    };
    window.addEventListener("resize", updateWidth);
    let frameID = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const progress = ((now - start) % 5500) / 5500;
      const reveal = clamp(progress / 0.36, 0, 1);
      let rotateX = 0;
      let scale = 1;
      let opacity = 1;
      if (progress < 0.08) {
        const amount = progress / 0.08;
        const eased = easeOutBack(amount);
        rotateX = -92 * (1 - eased);
        scale = 0.86 + 0.14 * eased;
        opacity = clamp(amount * 2.2, 0, 1);
      } else if (progress > 0.85) {
        const amount = (progress - 0.85) / 0.15;
        const eased = easeInBack(amount);
        rotateX = 84 * eased;
        scale = 1 - 0.14 * eased;
        opacity = clamp(1 - amount * 1.5, 0, 1);
      }
      const starOpacity =
        progress < 0.04
          ? progress / 0.04
          : progress < 0.32
            ? 1
            : progress < 0.37
              ? clamp(1 - (progress - 0.32) / 0.05, 0, 1)
              : 0;
      const shineProgress = clamp((progress - 0.42) / 0.28, 0, 1);
      const shineActive = progress >= 0.42 && progress <= 0.7;
      const shineOpacity = shineActive
        ? shineProgress < 0.1
          ? shineProgress / 0.1
          : shineProgress > 0.85
            ? clamp((1 - shineProgress) / 0.15, 0, 1)
            : 1
        : 0;

      plate.style.opacity = String(opacity);
      plate.style.transform = `perspective(340px) rotateX(${rotateX.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      text.style.clipPath = `inset(0 ${((1 - reveal) * 100).toFixed(2)}% 0 0)`;
      stars.style.transform = `translateX(${(13 + reveal * (width - 26)).toFixed(1)}px)`;
      stars.style.opacity = String(starOpacity);
      shine.style.transform = `translateX(${(((-55 + shineProgress * 165) / 100) * width).toFixed(1)}px) skewX(-16deg)`;
      shine.style.opacity = String(shineOpacity);
      frameID = requestAnimationFrame(frame);
    };
    frameID = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(frameID);
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  if (!label) return null;
  return (
    <span ref={plateRef} className="probe-license-nameplate">
      <strong ref={textRef} className="probe-license-text">
        {label}
      </strong>
      <span className="probe-license-shine-clip" aria-hidden="true">
        <span ref={shineRef} className="probe-license-shine" />
      </span>
      <span ref={starsRef} className="probe-license-stars" aria-hidden="true" />
    </span>
  );
}

export function App() {
  const { data, error } = useProbe();
  const [view, setView] = useState<"card" | "list">(() =>
    localStorage.getItem("probe-view") === "list" ? "list" : "card",
  );
  const [filter, setFilter] = useState<
    "all" | "online" | "offline" | "expiring" | "expired" | "renewal"
  >("all");
  const [region, setRegion] = useState("all");
  const [globeOpen, setGlobeOpen] = useState(false);
  const setMode = (next: "card" | "list") => {
    setView(next);
    localStorage.setItem("probe-view", next);
  };
  if (!data && !error)
    return (
      <main className="center">
        <Activity className="pulse" />
        正在连接主控…
      </main>
    );
  if (error && !data)
    return (
      <main className="center error">
        主控暂时不可用
        <br />
        <small>{error}</small>
      </main>
    );
  if (!data?.enabled) return <main className="center">探针尚未启用</main>;
  if (data.appearance?.theme === "premium") {
    return (
      <Suspense
        fallback={<main className="center">正在加载 Premium 主题…</main>}
      >
        <PremiumProbePage data={data} isLoading={false} isError={false} />
      </Suspense>
    );
  }
  const title = data.title?.trim() || "服务器状态";
  const servers = data.servers || [];
  const onlineCount = servers.filter((server) => server.online).length;
  const expiringCount = servers.filter(expiring).length;
  const expiredCount = servers.filter(expired).length;
  const renewalCount = servers.filter(
    (server) => expiring(server) || expired(server),
  ).length;
  const regions = [
    ...new Set(
      servers
        .map((server) => server.region?.trim())
        .filter((value): value is string => !!value),
    ),
  ].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const globeRegions = servers.map(probeCountryCode).filter(Boolean);
  const selectFilter = (next: typeof filter) => {
    setFilter(next);
    setRegion("all");
  };
  const selectRegion = (next: string) => {
    setRegion(next);
    setFilter("all");
  };
  const clearFilters = () => {
    setFilter("all");
    setRegion("all");
  };
  const hasExpiry = servers.some((server) => !!server.expires_at);
  const visible = servers.filter((server) => {
    const matchesStatus =
      filter === "all" ||
      (filter === "online" && server.online) ||
      (filter === "offline" && !server.online) ||
      (filter === "expiring" && expiring(server)) ||
      (filter === "expired" && expired(server)) ||
      (filter === "renewal" && (expiring(server) || expired(server)));
    return (
      matchesStatus && (region === "all" || server.region?.trim() === region)
    );
  });
  const hasSpeed = servers.some(
    (server) =>
      server.upload_speed !== undefined || server.download_speed !== undefined,
  );
  const totalUpload = servers.reduce(
    (sum, server) => sum + (server.upload_speed || 0),
    0,
  );
  const totalDownload = servers.reduce(
    (sum, server) => sum + (server.download_speed || 0),
    0,
  );
  return (
    <div
      className={
        data.license_badge ? "app-shell has-license-footer" : "app-shell"
      }
    >
      <header className="topbar">
        <div>
          {data.logo && <img src={data.logo} alt="" />}
          <h1>{title}</h1>
        </div>
        <nav>
          <ThemeSwitch appearance={data.appearance} />
          <button
            aria-label="卡片视图"
            title="卡片视图"
            className={view === "card" ? "active" : ""}
            onClick={() => setMode("card")}
          >
            <LayoutGrid size={18} />
          </button>
          <button
            aria-label="列表视图"
            title="列表视图"
            className={view === "list" ? "active" : ""}
            onClick={() => setMode("list")}
          >
            <List size={18} />
          </button>
        </nav>
      </header>
      <section className="dashboard-summary">
        <article className="summary-card">
          <header>
            <span>
              <Server size={18} />
              节点情况
            </span>
            {hasExpiry && (
              <button
                className="expiry-shortcut"
                onClick={() => selectFilter("renewal")}
              >
                <CalendarClock size={14} />
                待续费 <b>{renewalCount}</b>
              </button>
            )}
          </header>
          <div className="node-stats">
            <button onClick={() => selectFilter("all")}>
              <strong>{servers.length}</strong>
              <span>
                <Server size={14} />
                总节点
              </span>
            </button>
            <button onClick={() => selectFilter("online")} className="online">
              <strong>{onlineCount}</strong>
              <span>
                <CheckCircle2 size={14} />
                在线节点
              </span>
            </button>
            <button onClick={() => selectFilter("offline")} className="offline">
              <strong>{servers.length - onlineCount}</strong>
              <span>
                <XCircle size={14} />
                离线节点
              </span>
            </button>
          </div>
        </article>
        {hasSpeed && (
          <article className="summary-card">
            <header>
              <span>
                <Gauge size={18} />
                网络情况
              </span>
              <small>实时汇总</small>
            </header>
            <div className="network-stats">
              <SpeedSummary
                label="总下行网速"
                value={totalDownload}
                direction="down"
              />
              <SpeedSummary
                label="总上行网速"
                value={totalUpload}
                direction="up"
              />
            </div>
          </article>
        )}
      </section>
      {data.show_globe && regions.length > 0 && (
        <section className={`globe-card ${globeOpen ? "open" : ""}`}>
          <button
            className="globe-toggle"
            type="button"
            aria-expanded={globeOpen}
            onClick={() => setGlobeOpen((value) => !value)}
          >
            <span>
              <Globe2 size={18} />
              地区分布
            </span>
            <span>
              {regions.length} 个地区
              <ChevronDown size={17} />
            </span>
          </button>
          {globeOpen && (
            <Suspense
              fallback={<div className="globe-loading">正在加载国界数据…</div>}
            >
              <RegionGlobe regions={globeRegions} />
            </Suspense>
          )}
        </section>
      )}
      <section className="probe-toolbar">
        <div className="filters">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => selectFilter("all")}
          >
            全部 {servers.length}
          </button>
          <button
            className={filter === "online" ? "active" : ""}
            onClick={() => selectFilter("online")}
          >
            在线 {onlineCount}
          </button>
          <button
            className={filter === "offline" ? "active" : ""}
            onClick={() => selectFilter("offline")}
          >
            离线 {servers.length - onlineCount}
          </button>
          {hasExpiry && (
            <>
              <button
                className={filter === "renewal" ? "active warning" : "warning"}
                onClick={() => selectFilter("renewal")}
              >
                待续费 {renewalCount}
              </button>
              <button
                className={filter === "expiring" ? "active warning" : "warning"}
                onClick={() => selectFilter("expiring")}
              >
                即将到期 {expiringCount}
              </button>
              <button
                className={filter === "expired" ? "active danger" : "danger"}
                onClick={() => selectFilter("expired")}
              >
                已到期 {expiredCount}
              </button>
            </>
          )}
          {regions.length > 0 && (
            <label className="region-filter">
              <MapPin size={14} />
              <select
                aria-label="地区筛选"
                value={region}
                onChange={(event) => selectRegion(event.target.value)}
              >
                <option value="all">全部地区</option>
                {regions.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>
      <main key={view} className={`servers ${view}`}>
        {visible.length ? (
          view === "card" ? (
            visible.map((server) => (
              <ServerCard
                key={server.name}
                server={server}
                index={servers.indexOf(server)}
              />
            ))
          ) : (
            <ServerTable servers={visible} />
          )
        ) : (
          <div className="empty">
            <span>暂无符合筛选条件的服务器</span>
            <button type="button" onClick={clearFilters}>
              查看全部
            </button>
          </div>
        )}
      </main>
      <footer>
        Powered by{" "}
        <a
          href="https://github.com/mmwx-group"
          target="_blank"
          rel="noreferrer"
        >
          MMWX Group
        </a>
      </footer>
      {data.license_badge && (
        <div className="probe-license-footer">
          <ProbeLicenseNameplate
            name={data.license_badge.name}
            displayName={data.license_badge.display_name}
          />
        </div>
      )}
    </div>
  );
}
