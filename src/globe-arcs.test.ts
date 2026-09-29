import { geoOrthographic } from "d3-geo";
import {
  arcAltitude,
  arcPath,
  arcPointAt,
  MESH_MAX_REGIONS,
  pickArcPairs,
  sampleArc,
} from "./globe-arcs";

function ok(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

// 与探针地球同一套参数:球心 (320,190)、半径 168,视角对着东亚
const projection = () =>
  geoOrthographic()
    .translate([320, 190])
    .scale(168)
    .clipAngle(90)
    .rotate([-105, -18]);
const HK: [number, number] = [114.17, 22.32];
const JP: [number, number] = [138.25, 36.2];
const US: [number, number] = [-98.5, 39.8];
const dist = (x: number, y: number) => Math.hypot(x - 320, y - 190);

ok(arcAltitude(HK, US) > arcAltitude(HK, JP), "越远应抬得越高");
ok(arcAltitude([0, 0], [180, 0]) <= 0.34 + 1e-9, "最高不超过半径的 0.34");

{
  const p = projection();
  const points = sampleArc(p, HK, JP);
  const [hx, hy] = p(HK)!;
  ok(
    Math.abs(points[0].x - hx) < 1e-6 && Math.abs(points[0].y - hy) < 1e-6,
    "起点贴着地表",
  );
  ok(
    points.every((pt) => pt.visible),
    "正面的短弧整条可见",
  );
  const mid = points[32];
  const surfaceMid = p([(HK[0] + JP[0]) / 2, (HK[1] + JP[1]) / 2])!;
  ok(dist(mid.x, mid.y) > dist(surfaceMid[0], surfaceMid[1]), "中段抬离地表");
}

{
  const points = sampleArc(projection(), HK, US);
  ok(
    points[0].visible && !points[points.length - 1].visible,
    "正面起点可见、背面终点被挡",
  );
  const outside = points.filter((pt) => dist(pt.x, pt.y) > 168);
  ok(
    outside.length > 0 && outside.every((pt) => pt.visible),
    "伸出轮廓的部分可见",
  );
  ok(
    points.filter((pt) => !pt.visible).every((pt) => dist(pt.x, pt.y) <= 168),
    "被挡的点都在地球圆盘内",
  );
}

ok(
  arcPath([
    { x: 0, y: 0, visible: true },
    { x: 1, y: 1, visible: true },
    { x: 2, y: 2, visible: false },
    { x: 3, y: 3, visible: true },
    { x: 4, y: 4, visible: true },
  ]) === "M0.0 0.0L1.0 1.0M3.0 3.0L4.0 4.0",
  "path 在被挡住的地方断开",
);
{
  const pts = [
    { x: 0, y: 0, visible: true },
    { x: 10, y: 0, visible: true },
    { x: 20, y: 0, visible: false },
  ];
  const at = arcPointAt(pts, 0.25);
  ok(at && at.x === 5 && at.y === 0, "弧上取点插值");
  ok(arcPointAt(pts, 0.75) === null, "被挡住返回 null");
}

{
  const at = (count: number, lon = 0) => ({
    count,
    coordinates: [lon, 0] as [number, number],
  });
  ok(
    pickArcPairs([at(1), at(2), at(3)], [0, 0]).length === 3,
    "地区少时两两相连",
  );
  const many = Array.from({ length: MESH_MAX_REGIONS + 2 }, (_, i) =>
    at(i === 3 ? 9 : 1, i * 10),
  );
  const pairs = pickArcPairs(many, [0, 0]);
  ok(
    pairs.length === many.length - 1 && pairs.every(([hub]) => hub === many[3]),
    "多了从服务器最多的地区放射",
  );
  const tie = Array.from({ length: MESH_MAX_REGIONS + 1 }, (_, i) =>
    at(1, i * 20),
  );
  ok(
    pickArcPairs(tie, [61, 0]).every(([hub]) => hub === tie[3]),
    "一样多时取离默认朝向最近的",
  );
}

console.log("globe-arcs ok");
