import { resourceHistoryFromSeries } from "./resource-history";

function equal<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)}`);
  }
}

// 3 个 300 秒的桶：900、1200、1500（generatedAt 落在最后一个桶里）。
const h = resourceHistoryFromSeries(
  {
    cpu_pct: [
      { t: 900, value: 12.345 },
      { t: 1500, value: 150 },
    ],
    mem_used: [
      { t: 900, value: 512 },
      { t: 1200, value: 768 },
    ],
    mem_total: [
      { t: 900, value: 1024 },
      { t: 1200, value: 1024 },
    ],
    disk_used: [{ t: 1500, value: 30 }],
    disk_total: [{ t: 1500, value: 0 }],
  },
  1542,
  300,
  3,
);
equal(h.times, [900, 1200, 1500], "时间轴");
equal(
  h.cpu,
  [12.3, null, 100],
  "CPU 保留一位小数，越界夹到 100，没样本是 null",
);
equal(h.mem, [50, 75, null], "内存按同一桶的已用/总量换算");
equal(h.disk, [null, null, null], "总量为 0 不能除，记 null 而不是 0%");

const old = resourceHistoryFromSeries(
  { cpu_pct: [{ t: 1200, value: 5 }] },
  1542,
  300,
  3,
);
equal(old.disk, [null, null, null], "老主控不给 disk 列：硬盘整条为空");

console.log("resource-history ok");
