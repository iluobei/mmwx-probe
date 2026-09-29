import { connCount } from "./App";
import {
  connBucketLabel,
  connSparklineMax,
  connSparklinePath,
} from "./conn-sparkline";
import type { ProbeConnHistory } from "./types";

// 视图坐标系。preserveAspectRatio=none 横向拉满容器，线宽靠 non-scaling-stroke 保持 1.5px。
const W = 120;
const H = 40;
const PAD = 3;

// ConnSparkline TCP / UDP 两条线同图、共用纵轴；颜色走 --conn-tcp / --conn-udp（styles.css），
// 主题可以覆盖。每格一个透明热区，悬停看该格的数值。labels 是每格的时间说明，
// 不给就按列表的 12 × 5 分钟说「约 N 分钟前」。
export function ConnSparkline({
  history,
  labels,
  className,
}: {
  history: ProbeConnHistory;
  labels?: string[];
  className?: string;
}) {
  const n = Math.max(history.tcp.length, history.udp.length);
  if (n === 0) return null;
  const max = connSparklineMax(history);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className ? `conn-sparkline ${className}` : "conn-sparkline"}
      role="img"
      aria-label="近 1 小时系统连接数"
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
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={(i * W) / n}
          y={0}
          width={W / n}
          height={H}
          fill="transparent"
        >
          <title>
            {`${labels?.[i] ?? connBucketLabel(i, n)}\nTCP ${connCount(history.tcp[i] ?? undefined)} · UDP ${connCount(history.udp[i] ?? undefined)}`}
          </title>
        </rect>
      ))}
    </svg>
  );
}

export function ConnLegendDot({ kind }: { kind: "tcp" | "udp" }) {
  return <i aria-hidden="true" className={`conn-legend-dot ${kind}`} />;
}
