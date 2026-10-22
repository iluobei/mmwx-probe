import {
  averageLoad,
  formatCapacity,
  formatSize,
  probeHealthIssue,
  relativeTime,
  sortProbeServers,
  todayTrafficTotal,
  type ProbeOverviewServer,
} from "./probe-overview";

function ok(condition: unknown, message = "assertion failed") {
  if (!condition) throw new Error(message);
}
const assert = {
  ok,
  equal: (a: unknown, b: unknown, message?: string) =>
    ok(a === b, message ?? `${String(a)} !== ${String(b)}`),
  deepEqual: (a: unknown, b: unknown, message?: string) =>
    ok(
      JSON.stringify(a) === JSON.stringify(b),
      message ?? `${JSON.stringify(a)} !== ${JSON.stringify(b)}`,
    ),
};
const describe = (_name: string, fn: () => void) => fn();
const it = (_name: string, fn: () => void) => fn();

const GB = 1024 ** 3;

describe("probe overview", () => {
  it("formats capacity with one unit and no trailing .0", () => {
    assert.equal(formatCapacity(1.0 * GB, 8 * GB), "1 / 8 GB");
    assert.equal(formatCapacity(1.5 * GB, 2 * GB), "1.5 / 2 GB");
    assert.equal(formatCapacity(18.4 * GB, 20 * GB), "18.4 / 20 GB");
    assert.equal(
      formatCapacity(300 * 1024 ** 2, 512 * 1024 ** 2),
      "300 / 512 MB",
    );
    assert.equal(formatCapacity(150 * GB, 500 * GB), "150 / 500 GB");
    assert.equal(formatSize(20 * GB), "20 GB");
  });

  it("reports the worst metric above 90%, ignoring offline servers", () => {
    const s: ProbeOverviewServer = {
      online: true,
      cpu_pct: 38,
      mem_used: 1.5,
      mem_total: 2,
      disk_used: 92.1,
      disk_total: 100,
      traffic_limit: 100,
    };
    assert.deepEqual(probeHealthIssue(s, 30), { key: "disk", pct: 92.1 });
    assert.equal(probeHealthIssue({ ...s, disk_used: 50 }, 30), undefined);
    assert.deepEqual(
      probeHealthIssue({ ...s, disk_used: 50 }, 95)?.key,
      "traffic",
    );
    assert.equal(probeHealthIssue({ ...s, online: false }, 99), undefined);
  });

  it("sums the latest day of daily traffic across servers", () => {
    assert.equal(
      todayTrafficTotal([
        {
          online: true,
          daily_traffic: [
            { date: "2026-10-21", total: 5 },
            { date: "2026-10-22", total: 7 },
          ],
        },
        { online: true, daily_traffic: [{ date: "2026-10-22", total: 3 }] },
        { online: false },
      ]),
      10,
    );
    assert.equal(todayTrafficTotal([{ online: true }]), undefined);
  });

  it("averages only online servers that report the metric", () => {
    const a = averageLoad([
      { online: true, cpu_pct: 10, mem_used: 1, mem_total: 4 },
      { online: true, cpu_pct: 30 },
      { online: false, cpu_pct: 90 },
    ]);
    assert.equal(a.cpu, 20);
    assert.equal(a.mem, 25);
    assert.equal(a.disk, undefined);
  });

  it("sorts with missing values last and keeps original order on ties", () => {
    const list = [
      { index: 0, server: { online: true, name: "b", cpu_pct: 5 } },
      { index: 1, server: { online: true, name: "a" } },
      { index: 2, server: { online: true, name: "c", cpu_pct: 50 } },
      { index: 3, server: { online: true, name: "d", cpu_pct: 5 } },
    ];
    const used = () => 0;
    assert.deepEqual(
      sortProbeServers(list, "cpu", used).map((x) => x.index),
      [2, 0, 3, 1],
    );
    assert.deepEqual(
      sortProbeServers(list, "name", used).map((x) => x.server.name),
      ["a", "b", "c", "d"],
    );
    assert.equal(sortProbeServers(list, "default", used), list);
  });

  it("formats relative time", () => {
    const now = Date.parse("2026-10-22T01:49:00Z");
    assert.equal(relativeTime("2026-10-22T01:12:00Z", now), "37 分钟前");
    assert.equal(relativeTime("2026-10-22T01:48:40Z", now), "刚刚");
    assert.equal(relativeTime("2026-10-20T01:00:00Z", now), "2 天前");
  });
});

console.log("ok");
