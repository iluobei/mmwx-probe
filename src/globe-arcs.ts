import { geoDistance, geoInterpolate, type GeoProjection } from "d3-geo";

// 与主仓内置探针的 src/lib/globe-arcs.ts 同一套几何,改一边记得同步另一边。
//
// 探针地球上地区之间的 3D 弧线:沿大圆走、中段抬离地表,越远抬得越高(长弧会伸出地球轮廓),
// 绕到背面被地球挡住的那段不画。

interface ArcPoint {
  x: number;
  y: number;
  visible: boolean;
}

/** 弧顶离地高度,按地球半径的比例:两地越远越高,对跖点最高约 0.34。 */
export function arcAltitude(
  from: [number, number],
  to: [number, number],
): number {
  return 0.06 + 0.28 * (geoDistance(from, to) / Math.PI);
}

/**
 * 沿大圆取 segments+1 个点,按 sin(πt) 抬离地表后投到屏幕上。
 *
 * 正射投影是线性的:离地心 r 倍远的点,屏幕位置就是地表点相对球心的偏移乘 r ——
 * 所以不用自己做三维旋转,地表点直接交给 projection(它不裁背面)算,再按高度放大偏移。
 * 被挡住 = 在背面半球,且投影落在地球圆盘之内;抬高后伸出轮廓的背面部分仍然看得见。
 */
export function sampleArc(
  projection: GeoProjection,
  from: [number, number],
  to: [number, number],
  segments = 64,
): ArcPoint[] {
  const [cx, cy] = projection.translate();
  const radius = projection.scale();
  const center = projection.invert?.([cx, cy]);
  if (!center) return [];
  const interpolate = geoInterpolate(from, to);
  const altitude = arcAltitude(from, to);
  const points: ArcPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const surface = interpolate(t);
    const projected = projection(surface);
    if (!projected) continue;
    const lift = 1 + altitude * Math.sin(Math.PI * t);
    const dx = (projected[0] - cx) * lift;
    const dy = (projected[1] - cy) * lift;
    const front = geoDistance(surface, center) <= Math.PI / 2;
    points.push({
      x: cx + dx,
      y: cy + dy,
      visible: front || dx * dx + dy * dy > radius * radius,
    });
  }
  return points;
}

/** 看得见的连续片段拼成 SVG path,被挡住的地方断开。 */
export function arcPath(points: ArcPoint[]): string {
  let d = "";
  let open = false;
  for (const p of points) {
    if (!p.visible) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    open = true;
  }
  return d;
}

/** 弧上 t∈[0,1] 处的位置(相邻采样点间线性插值);那里被地球挡住时返回 null。 */
export function arcPointAt(
  points: ArcPoint[],
  t: number,
): { x: number; y: number } | null {
  if (points.length === 0) return null;
  const f = Math.min(Math.max(t, 0), 1) * (points.length - 1);
  const i = Math.floor(f);
  const a = points[i];
  const b = points[Math.min(i + 1, points.length - 1)];
  if (!a.visible || !b.visible) return null;
  const u = f - i;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

/** 地区不超过这么多时两两相连;再多就改成从中心地区放射出去,免得连成一团。 */
export const MESH_MAX_REGIONS = 8;

/**
 * 放射中心取服务器最多的地区;一样多时取离 viewCenter(地球默认朝向)最近的,
 * 让中心一打开就在画面中间,而不是恰好挂在地球边上。
 */
export function pickArcPairs<
  T extends { count: number; coordinates: [number, number] },
>(locations: T[], viewCenter: [number, number]): Array<[T, T]> {
  if (locations.length < 2) return [];
  if (locations.length <= MESH_MAX_REGIONS) {
    const pairs: Array<[T, T]> = [];
    for (let i = 0; i < locations.length; i++) {
      for (let j = i + 1; j < locations.length; j++) {
        pairs.push([locations[i], locations[j]]);
      }
    }
    return pairs;
  }
  const hub = locations.reduce((best, item) => {
    if (item.count !== best.count) return item.count > best.count ? item : best;
    return geoDistance(item.coordinates, viewCenter) <
      geoDistance(best.coordinates, viewCenter)
      ? item
      : best;
  });
  return locations
    .filter((item) => item !== hub)
    .map((item): [T, T] => [hub, item]);
}
