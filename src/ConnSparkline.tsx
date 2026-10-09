import { useState } from "react";
import { connCount } from "./App";
import {
  connBucketLabel,
  connHoverIndex,
  connSparklineMax,
  connSparklinePath,
} from "./conn-sparkline";
import type { ProbeConnHistory } from "./types";

// 视图坐标系。preserveAspectRatio=none 横向拉满容器，线宽靠 non-scaling-stroke 保持 1.5px。
const W = 120;
const H = 40;
const PAD = 3;

// ConnSparkline TCP / UDP 两条线同图、共用纵轴；颜色走 --conn-tcp / --conn-udp（styles.css），
// 主题可以覆盖。鼠标悬停处显示竖线、两条线上的圆点和该格的时间与数值。
// labels 是每格的时间说明，不给就按列表的 12 × 5 分钟说「约 N 分钟前」。
//
// 尺寸 class 挂在外层 span 上、svg 撑满它：圆点和提示框按百分比定位，才能和拉伸后的折线对齐。
// 外层用 span 不用 div：经典卡片里它包在按钮里（按钮里只能放行内内容）。
export function ConnSparkline({
  history,
  labels,
  className,
}: {
  history: ProbeConnHistory;
  labels?: string[];
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(history.tcp.length, history.udp.length);
  if (n === 0) return null;
  const max = connSparklineMax(history);
  const xPct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yPct = (v: number) =>
    ((PAD + (H - 2 * PAD) * (1 - v / (max > 0 ? max : 1))) / H) * 100;
  const tcp = hover === null ? undefined : history.tcp[hover];
  const udp = hover === null ? undefined : history.udp[hover];
  return (
    <span
      className={className ? `conn-sparkline ${className}` : "conn-sparkline"}
      onPointerMove={(event) => {
        const r = event.currentTarget.getBoundingClientRect();
        setHover(connHoverIndex((event.clientX - r.left) / r.width, n));
      }}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="系统连接数"
      >
        <line
          className="conn-sparkline-base"
          x1={0}
          x2={W}
          y1={H - PAD}
          y2={H - PAD}
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="conn-sparkline-tcp"
          d={connSparklinePath(history.tcp, max, W, H, PAD)}
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="conn-sparkline-udp"
          d={connSparklinePath(history.udp, max, W, H, PAD)}
          vectorEffect="non-scaling-stroke"
        />
        {hover !== null && (
          <line
            className="conn-sparkline-guide"
            x1={(xPct(hover) / 100) * W}
            x2={(xPct(hover) / 100) * W}
            y1={0}
            y2={H}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {hover !== null && (
        <>
          {typeof tcp === "number" && (
            <i
              className="conn-sparkline-dot tcp"
              style={{ left: `${xPct(hover)}%`, top: `${yPct(tcp)}%` }}
            />
          )}
          {typeof udp === "number" && (
            <i
              className="conn-sparkline-dot udp"
              style={{ left: `${xPct(hover)}%`, top: `${yPct(udp)}%` }}
            />
          )}
          <span
            className="conn-sparkline-tip"
            style={{ left: `${Math.min(85, Math.max(15, xPct(hover)))}%` }}
          >
            <small>{labels?.[hover] ?? connBucketLabel(hover, n)}</small>
            TCP {connCount(tcp ?? undefined)} · UDP {connCount(udp ?? undefined)}
          </span>
        </>
      )}
    </span>
  );
}

export function ConnLegendDot({
  kind,
}: {
  kind: "tcp" | "udp" | "cpu" | "mem" | "disk";
}) {
  return <i aria-hidden="true" className={`conn-legend-dot ${kind}`} />;
}

type ResourceSparkHistory = {
  cpu: (number | null)[];
  mem: (number | null)[];
  disk: (number | null)[];
};

const RESOURCE_KEYS = ["cpu", "mem", "disk"] as const;
const RESOURCE_LABELS = { cpu: "CPU", mem: "内存", disk: "硬盘" } as const;

// ResourceSparkline CPU / 内存 / 硬盘使用率同图，纵轴固定 0–100%（不按最大值缩放 ——
// 30% 的 CPU 被拉满整个高度会让人以为机器快挂了）。交互与 ConnSparkline 一致。
export function ResourceSparkline({
  history,
  labels,
  className,
}: {
  history: ResourceSparkHistory;
  labels?: string[];
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(
    history.cpu.length,
    history.mem.length,
    history.disk.length,
  );
  if (n === 0) return null;
  const xPct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yPct = (v: number) => ((PAD + (H - 2 * PAD) * (1 - v / 100)) / H) * 100;
  const fmt = (v: number | null | undefined) =>
    typeof v === "number" ? `${v.toFixed(1)}%` : "—";
  return (
    <span
      className={className ? `conn-sparkline ${className}` : "conn-sparkline"}
      onPointerMove={(event) => {
        const r = event.currentTarget.getBoundingClientRect();
        setHover(connHoverIndex((event.clientX - r.left) / r.width, n));
      }}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="资源使用率"
      >
        <line
          className="conn-sparkline-base"
          x1={0}
          x2={W}
          y1={H - PAD}
          y2={H - PAD}
          vectorEffect="non-scaling-stroke"
        />
        {RESOURCE_KEYS.map((k) => (
          <path
            key={k}
            className={`res-sparkline-line ${k}`}
            d={connSparklinePath(history[k], 100, W, H, PAD)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {hover !== null && (
          <line
            className="conn-sparkline-guide"
            x1={(xPct(hover) / 100) * W}
            x2={(xPct(hover) / 100) * W}
            y1={0}
            y2={H}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {hover !== null && (
        <>
          {RESOURCE_KEYS.map((k) => {
            const v = history[k][hover];
            return typeof v === "number" ? (
              <i
                key={k}
                className={`conn-sparkline-dot ${k}`}
                style={{ left: `${xPct(hover)}%`, top: `${yPct(v)}%` }}
              />
            ) : null;
          })}
          <span
            className="conn-sparkline-tip"
            style={{ left: `${Math.min(85, Math.max(15, xPct(hover)))}%` }}
          >
            <small>{labels?.[hover] ?? connBucketLabel(hover, n)}</small>
            {RESOURCE_KEYS.map(
              (k) => `${RESOURCE_LABELS[k]} ${fmt(history[k][hover])}`,
            ).join(" · ")}
          </span>
        </>
      )}
    </span>
  );
}
