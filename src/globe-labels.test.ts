import {
  flagTwemojiFile,
  globeLabelWidth,
  layoutGlobeLabels,
  type GlobeLabelMetrics,
} from "./globe-labels";

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

const m: GlobeLabelMetrics = {
  height: 14,
  flag: 11,
  digit: 6,
  padding: 3,
  gap: 2,
  offset: 6,
  dotRadius: 4,
};
const sphere = { cx: 200, cy: 200, r: 160 };

const overlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

describe("globe labels", () => {
  it("width hugs the content: no trailing space after a single digit", () => {
    assert.equal(globeLabelWidth(2, m), 3 + 11 + 2 + 6 + 3);
    assert.equal(globeLabelWidth(12, m), 3 + 11 + 2 + 12 + 3);
  });

  it("places a lone label to the right of its dot", () => {
    const [label] = layoutGlobeLabels(
      [{ code: "HK", count: 4, x: 200, y: 200 }],
      m,
      sphere,
    );
    assert.equal(label.x, 206);
    assert.equal(label.y, 193);
    assert.equal(label.leader, undefined);
  });

  it("never overlaps labels or covers other dots, even when crowded", () => {
    const pts = [
      { code: "HK", count: 6, x: 200, y: 200 },
      { code: "MO", count: 1, x: 197, y: 201 },
      { code: "TW", count: 4, x: 215, y: 194 },
      { code: "PH", count: 2, x: 214, y: 214 },
      { code: "VN", count: 1, x: 186, y: 203 },
      { code: "JP", count: 3, x: 240, y: 172 },
      { code: "KR", count: 2, x: 225, y: 172 },
    ];
    const labels = layoutGlobeLabels(pts, m, sphere);
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        assert.ok(
          !overlap(labels[i], labels[j]),
          `${labels[i].code} × ${labels[j].code}`,
        );
      }
      for (const p of pts) {
        if (p.code === labels[i].code) continue;
        const dot = { x: p.x - 4, y: p.y - 4, width: 8, height: 8 };
        assert.ok(
          !overlap(labels[i], dot),
          `${labels[i].code} covers ${p.code}`,
        );
      }
    }
    // 多的先放:香港一定有标签
    assert.ok(labels.some((l) => l.code === "HK"));
  });

  it("skips a label rather than stacking it", () => {
    // 9 个点挤在一个 3×3 的格子里,放不下的必须跳过而不是叠上去
    const pts = Array.from({ length: 9 }, (_, i) => ({
      code: `A${i}`,
      count: 1,
      x: 200 + (i % 3) * 3,
      y: 200 + Math.floor(i / 3) * 3,
    }));
    const labels = layoutGlobeLabels(pts, m, sphere);
    assert.ok(labels.length < pts.length);
  });

  it("maps country codes to twemoji flag files", () => {
    assert.equal(flagTwemojiFile("hk"), "1f1ed-1f1f0");
    assert.equal(flagTwemojiFile("TW"), "1f1f9-1f1fc");
    assert.equal(flagTwemojiFile("X"), "");
  });
});

console.log("ok");
