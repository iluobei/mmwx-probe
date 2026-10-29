import {
  averageLoad,
  connectionTotals,
  dailyTrafficSeries,
  latencySummary,
  monthlyCost,
  nextExpiry,
  quotaSummary,
  formatCapacity,
  formatSize,
  probeHealthIssue,
  relativeTime,
  sortProbeServers,
  todayTrafficTotal,
  type ProbeOverviewServer,
  kpiColumns,
  connHistoryTotals,
  upcomingExpiries,
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

describe("probe overview summary", () => {
  const GB2 = 1024 ** 3;
  it("daily series merges servers by date and keeps the last N days", () => {
    const a: ProbeOverviewServer = {
      online: true,
      daily_traffic: [
        { date: "2026-10-26", total: 1, uplink: 1, downlink: 0 },
        { date: "2026-10-27", total: 2, uplink: 1, downlink: 1 },
        { date: "2026-10-28", total: 3, uplink: 2, downlink: 1 },
      ],
    };
    const b: ProbeOverviewServer = {
      online: true,
      daily_traffic: [{ date: "2026-10-28", total: 4, uplink: 4, downlink: 0 }],
    };
    const s = dailyTrafficSeries([a, b], 2);
    assert.deepEqual(
      s.map((d) => [d.date, d.total, d.up, d.down]),
      [
        ["2026-10-27", 2, 1, 1],
        ["2026-10-28", 7, 6, 1],
      ],
    );
    assert.deepEqual(dailyTrafficSeries([{ online: true }]), []);
  });
  it("connection totals only count online servers that report", () => {
    assert.equal(connectionTotals([{ online: true }]), undefined);
    assert.deepEqual(
      connectionTotals([
        { online: true, tcp_connections: 3, udp_connections: 1 },
        { online: false, tcp_connections: 99 },
        { online: true, tcp_connections: 2 },
      ]),
      { tcp: 5, udp: 1, total: 6 },
    );
  });
  it("quota summary over limited servers", () => {
    const q = quotaSummary(
      [
        { online: true, traffic_limit: 100 * GB2 },
        { online: true, traffic_limit: 100 * GB2 },
        { online: true },
      ],
      (s) => (s.traffic_limit ? 90 * GB2 : undefined),
      80,
    );
    assert.ok(q);
    assert.equal(q!.servers, 2);
    assert.equal(q!.warn, 2);
    assert.equal(Math.round(q!.pct), 90);
    assert.equal(
      quotaSummary([{ online: true }], () => 1),
      undefined,
    );
  });
  it("latency summary buckets by average ms", () => {
    const l = latencySummary([
      { online: true, ping: [{ current_ms: 20, loss_pct: 0 }] },
      { online: true, ping: [{ current_ms: 150, loss_pct: 2 }] },
      { online: true, ping: [{ current_ms: -1, loss_pct: 100 }] },
      { online: false, ping: [{ current_ms: 1 }] },
    ]);
    assert.ok(l);
    assert.equal(l!.good, 1);
    assert.equal(l!.fair, 1);
    assert.equal(l!.poor, 1);
    assert.equal(l!.avgMs, 85);
    assert.equal(Math.round(l!.avgLoss), 34);
    assert.equal(latencySummary([{ online: true }]), undefined);
  });
  it("monthly cost and next expiry", () => {
    assert.equal(
      monthlyCost([
        { online: true, renewal_price_cny: 120, renewal_cycle: "year" },
        { online: true, renewal_price_cny: 30, renewal_cycle: "month" },
        { online: true, renewal_price_cny: 999, renewal_cycle: "permanent" },
      ]),
      40,
    );
    assert.equal(monthlyCost([{ online: true }]), undefined);
    const now = new Date("2026-10-28T00:00:00").getTime();
    assert.deepEqual(
      nextExpiry(
        [
          { online: true, name: "a", expires_at: "2026-11-10" },
          { online: true, name: "b", expires_at: "2026-10-30" },
        ],
        now,
      ),
      { name: "b", days: 3 },
    );
  });
});

describe("kpiColumns", () => {
  it("balances rows instead of leaving a half-empty second row", () => {
    assert.equal(kpiColumns(6, 1120), 3);
    assert.equal(kpiColumns(4, 1120), 2);
    assert.equal(kpiColumns(4, 1400), 4);
    assert.equal(kpiColumns(4, 700), 2);
    assert.equal(kpiColumns(5, 1120), 3);
    assert.equal(kpiColumns(6, 2000), 6);
  });
  it("keeps two columns on phones and three when unmeasured", () => {
    assert.equal(kpiColumns(6, 390), 2);
    assert.equal(kpiColumns(6, 0), 3);
    assert.equal(kpiColumns(1, 390), 1);
  });
});

describe("kpi aside helpers", () => {
  it("sums connection history aligned to the latest sample", () => {
    const r = connHistoryTotals([
      {
        name: "a",
        conn_history: { tcp: [1, 2, 3], udp: [0, 1, 1] },
      } as ProbeOverviewServer,
      {
        name: "b",
        conn_history: { tcp: [10, null], udp: [5, 5] },
      } as ProbeOverviewServer,
      { name: "c" } as ProbeOverviewServer,
    ]);
    assert.deepEqual(r, { tcp: [1, 12, 3], udp: [0, 6, 6] });
    assert.equal(
      connHistoryTotals([{ name: "x" } as ProbeOverviewServer]),
      undefined,
    );
  });
  it("returns the nearest expiries including already expired ones", () => {
    const now = new Date("2026-10-29T00:00:00Z").getTime();
    const r = upcomingExpiries(
      [
        { name: "far", expires_at: "2026-12-30" } as ProbeOverviewServer,
        { name: "soon", expires_at: "2026-11-02" } as ProbeOverviewServer,
        { name: "gone", expires_at: "2026-10-20" } as ProbeOverviewServer,
        { name: "none" } as ProbeOverviewServer,
      ],
      now,
      2,
    );
    assert.deepEqual(
      r.map((x) => x.name),
      ["gone", "soon"],
    );
    assert.ok(r[0].days < 0);
  });
});
