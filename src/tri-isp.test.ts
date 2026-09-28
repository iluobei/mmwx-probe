import { triISPRows } from "./tri-isp";
import type { ProbePingSeries, TriISPPublic } from "./types";

function equal<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)}`);
  }
}

const tri: TriISPPublic = {
  enabled: true,
  targets: [
    { isp: "telecom", key: "he-dx", label: "河北电信" },
    { isp: "unicom", key: "he-cu", label: "河北联通" },
    { isp: "mobile", key: "he-yd", label: "河北移动" },
  ],
};

const series: ProbePingSeries[] = [
  // label 与配置里的不同(管理员改过名)——仍应按 key 匹配上
  { key: "he-dx", label: "改过的名字", current_ms: 10, loss_pct: 0, buckets: [] },
  { key: "he-cu", label: "河北联通", current_ms: 20, loss_pct: 1.5, buckets: [] },
];

const rows = triISPRows(tri, series);

equal(rows.length, 3, "三个槽位都要成行,哪怕没数据");
equal(rows[0].series?.current_ms, 10, "按 key 匹配,不受展示名改动影响");
equal(rows[1].series?.loss_pct, 1.5, "丢包同样取自实测序列");
equal(rows[2].series, undefined, "没探到的槽位 series 为空");
equal(rows[2].label, "河北移动", "展示名取配置里的,不是序列里的");
equal(
  rows.map((r) => r.isp),
  ["telecom", "unicom", "mobile"],
  "顺序即展示顺序,必须与主控一致",
);

equal(triISPRows(undefined, series), [], "未配置时返回空,调用方走原有展示");
equal(
  triISPRows({ enabled: false, targets: tri.targets }, series),
  [],
  "开关关闭时返回空",
);
equal(triISPRows({ enabled: true, targets: [] }, series), [], "没有槽位时返回空");

// 序列里没有 key 的条目(平均态)不能顶替任何槽位 —— 顶替了就是把平均值标成某个运营商。
equal(
  triISPRows<ProbePingSeries>(tri, [
    { label: "平均", current_ms: 5, loss_pct: 0, buckets: [] },
  ]).every((r) => r.series === undefined),
  true,
  "无 key 的平均态不参与匹配",
);

console.log("tri-isp: all assertions passed");

// 一个三网代表点都没探到时,取延迟列表前三个顶上 —— 按主控标的 tri_fallback(配置顺序)。
const zjTri: TriISPPublic = {
  enabled: true,
  targets: [
    { isp: "telecom", key: "zj-dx", label: "浙江电信" },
    { isp: "unicom", key: "zj-lt", label: "浙江联通" },
    { isp: "mobile", key: "zj-yd", label: "浙江移动" },
  ],
};
const fallbackRows = triISPRows<ProbePingSeries>(zjTri, [
  { key: "a", label: "北京电信", current_ms: 1, loss_pct: 0, buckets: [], tri_fallback: 2 },
  { key: "b", label: "上海联通", current_ms: 2, loss_pct: 0, buckets: [] },
  { key: "c", label: "广州移动", current_ms: 3, loss_pct: 0, buckets: [], tri_fallback: 1 },
  { key: "d", label: "成都电信", current_ms: 4, loss_pct: 0, buckets: [], tri_fallback: 3 },
]);
equal(
  fallbackRows.map((r) => r.label),
  ["广州移动", "北京电信", "成都电信"],
  "兜底按主控标的配置顺序取前三个",
);
equal(
  new Set(fallbackRows.map((r) => r.isp)).size,
  3,
  "isp 充当 React key,兜底行也必须唯一",
);
equal(
  triISPRows<ProbePingSeries>(zjTri, [
    { label: "平均", current_ms: 5, loss_pct: 0, buckets: [] },
    { key: "a", label: "A", current_ms: 1, loss_pct: 0, buckets: [] },
    { key: "b", label: "B", current_ms: 2, loss_pct: 0, buckets: [] },
  ]).map((r) => r.label),
  ["A", "B"],
  "旧主控没标时按下发顺序取,平均态不参与",
);
