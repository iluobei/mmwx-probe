import {
  effectiveProbeRange,
  probeRangeBucketCount,
  probeRangeBucketSec,
  probeRangeOptions,
} from "./probe-ranges";

function equal<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)}`);
  }
}

const keys = (days?: number) => probeRangeOptions(days).map((o) => o.key);

equal(keys(1), ["1h", "6h", "24h"], "保留 1 天只有 24 小时以内");
equal(keys(undefined), ["1h", "6h", "24h"], "老主控没下发时同 1 天");
equal(keys(2), ["1h", "6h", "24h", "2d"], "保留 2 天");
equal(keys(5), ["1h", "6h", "24h", "3d", "5d"], "保留 5 天");
equal(keys(7), ["1h", "6h", "24h", "3d", "7d"], "保留 7 天");
equal(keys(30), ["1h", "6h", "24h", "3d", "7d"], "封顶 7 天");
equal(
  [probeRangeBucketSec("1h"), probeRangeBucketSec("3d"), probeRangeBucketSec("7d")],
  [300, 3600, 7200],
  "兜底桶宽与主控一致",
);
equal(
  [probeRangeBucketCount("24h"), probeRangeBucketCount("3d"), probeRangeBucketCount("7d")],
  [48, 72, 84],
  "兜底桶数与主控一致",
);
equal(effectiveProbeRange("7d", probeRangeOptions(3)), "1h", "超出保留期回落 1h");
equal(effectiveProbeRange("3d", probeRangeOptions(3)), "3d", "范围仍在时保留");

console.log("probe-ranges ok");
