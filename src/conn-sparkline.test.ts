import {
  connBucketLabel,
  connHistoryFromSeries,
  connHoverIndex,
  connSparklineMax,
  connSparklinePath,
} from "./conn-sparkline";

function equal<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)}`);
  }
}

equal(
  connSparklineMax({ tcp: [10, null, 30], udp: [50, 2, null] }),
  50,
  "TCP / UDP 共用一个最大值",
);
equal(
  connSparklineMax({ tcp: [null, null], udp: [null, null] }),
  0,
  "全是 null 时最大值为 0",
);

// 3 格铺满宽 100：x = 0 / 50 / 100；高 10，max 20 → 0 在底（10），20 在顶（0）
equal(
  connSparklinePath([0, 10, 20], 20, 100, 10),
  "M0 10L50 5L100 0",
  "连续的点连成一条线，纵轴从 0 起",
);
equal(
  connSparklinePath([4, 4, null, 4, 4], 4, 40, 10),
  "M0 0L10 0M30 0L40 0",
  "null 的格让线断开，不补 0",
);
equal(
  connSparklinePath([null, 5, null], 5, 20, 10),
  "M10 0h0.01",
  "孤立点画成一个圆点",
);
equal(connSparklinePath([7], 7, 20, 10), "M10 0h0.01", "只有一格也画成圆点");
equal(connSparklinePath([0, 0], 0, 10, 10, 1), "M0 9L10 9", "全是 0 时贴底");
equal(connSparklinePath([0, 8], 8, 10, 10, 1), "M0 9L10 1", "上下留白");

equal(connBucketLabel(11, 12), "最近 5 分钟", "最新一格");
equal(connBucketLabel(10, 12), "约 5 分钟前", "倒数第二格");
equal(connBucketLabel(0, 12), "约 55 分钟前", "最早一格");

// generatedAt 10000、桶宽 300 → 末桶 9900，3 个桶 = 9300 / 9600 / 9900
const fromSeries = connHistoryFromSeries(
  [{ t: 9600, value: 10.4 }],
  [
    { t: 9300, value: 2 },
    { t: 9900, value: 3.6 },
  ],
  10000,
  300,
  3,
);
equal(fromSeries.times, [9300, 9600, 9900], "桶起点");
equal(fromSeries.tcp, [null, 10, null], "TCP 摊成定长、缺的桶为 null");
equal(fromSeries.udp, [2, null, 4], "UDP 四舍五入");

equal(
  [0, 1, 0.5, 0.04, 0.05, -0.3, 1.4].map((f) => connHoverIndex(f, 12)),
  [0, 11, 6, 0, 1, 0, 11],
  "悬停位置换算成格子,与折线横坐标对齐并夹在两端",
);
equal(connHoverIndex(0.7, 1), 0, "只有一格");

console.log("conn-sparkline ok");
