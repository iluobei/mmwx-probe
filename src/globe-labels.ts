// 地球亮点旁的小标签(旗帜 + 服务器数量)的摆放。与主仓内置探针 src/lib/globe-labels.ts 同一份逻辑。
//
// 地区挨得近时(香港 / 澳门 / 台湾…)标签很容易叠成一团,所以:
//   - 服务器多的地区先放;
//   - 每个标签依次试右、左、上、下、四个斜角,再试稍远一圈的上下左右,
//     挑第一个不和已放标签重叠、也不压住别的亮点、不明显伸出地球的位置;
//   - 都放不下就不放 —— 亮点还在,悬停仍有提示,宁可少一个标签也不叠。
// 坐标都是 SVG 用户单位;尺寸由调用方按「屏幕像素 → 用户单位」换算后传进来。

export type GlobeLabelPoint = {
  code: string;
  count: number;
  x: number;
  y: number;
};

export type GlobeLabelMetrics = {
  /** 标签高度 */
  height: number;
  /** 旗帜宽度 */
  flag: number;
  /** 一个数字的宽度(等宽数字) */
  digit: number;
  /** 左右内边距 */
  padding: number;
  /** 旗帜与数字之间的空隙 */
  gap: number;
  /** 标签离亮点的距离 */
  offset: number;
  /** 亮点自身占的半径(别的标签不许压住) */
  dotRadius: number;
};

export type GlobeLabel = {
  code: string;
  count: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 离亮点较远、需要画引线时给出引线终点 */
  leader?: { x1: number; y1: number; x2: number; y2: number };
};

type Box = { x: number; y: number; w: number; h: number };

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function globeLabelWidth(count: number, m: GlobeLabelMetrics): number {
  return m.padding * 2 + m.flag + m.gap + String(count).length * m.digit;
}

export function layoutGlobeLabels(
  points: GlobeLabelPoint[],
  m: GlobeLabelMetrics,
  sphere: { cx: number; cy: number; r: number },
): GlobeLabel[] {
  const dots: Array<Box & { code: string }> = points.map((p) => ({
    code: p.code,
    x: p.x - m.dotRadius,
    y: p.y - m.dotRadius,
    w: m.dotRadius * 2,
    h: m.dotRadius * 2,
  }));
  const placed: GlobeLabel[] = [];
  const order = [...points].sort(
    (a, b) => b.count - a.count || a.code.localeCompare(b.code),
  );
  for (const p of order) {
    const w = globeLabelWidth(p.count, m);
    const h = m.height;
    const o = m.offset;
    const far = o * 3;
    const candidates: Array<[number, number]> = [
      [o, -h / 2],
      [-o - w, -h / 2],
      [-w / 2, -o - h],
      [-w / 2, o],
      [o, -o - h],
      [-o - w, -o - h],
      [o, o],
      [-o - w, o],
      [far, -h / 2],
      [-far - w, -h / 2],
      [-w / 2, -far - h],
      [-w / 2, far],
    ];
    for (let i = 0; i < candidates.length; i++) {
      const [dx, dy] = candidates[i];
      const box = { x: p.x + dx, y: p.y + dy, w, h };
      const ccx = box.x + w / 2 - sphere.cx;
      const ccy = box.y + h / 2 - sphere.cy;
      if (Math.hypot(ccx, ccy) > sphere.r + h) continue;
      if (
        placed.some((q) =>
          overlaps(box, { x: q.x, y: q.y, w: q.width, h: q.height }),
        )
      )
        continue;
      if (dots.some((d) => d.code !== p.code && overlaps(box, d))) continue;
      const label: GlobeLabel = {
        code: p.code,
        count: p.count,
        x: box.x,
        y: box.y,
        width: w,
        height: h,
      };
      if (i >= 8) {
        // 外圈:画一条引线接回亮点,免得看不出是谁的标签
        const ex = dx < 0 ? box.x + w : dx > 0 ? box.x : box.x + w / 2;
        const ey =
          dy < -h / 2 ? box.y + h : dy > -h / 2 ? box.y : box.y + h / 2;
        label.leader = { x1: p.x, y1: p.y, x2: ex, y2: ey };
      }
      placed.push(label);
      break;
    }
  }
  return placed;
}

/** 两位国家代码 → twemoji 本地资源文件名(区域指示符号对) */
export function flagTwemojiFile(code: string): string {
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  return [...upper]
    .map((c) => (0x1f1e6 + c.charCodeAt(0) - 65).toString(16))
    .join("-");
}
