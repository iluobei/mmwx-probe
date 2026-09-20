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
