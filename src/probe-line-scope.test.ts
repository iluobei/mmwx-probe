import { effectiveProbeLineKey, probeLinesForScope } from "./probe-line-scope";
import type { ProbePingSeries } from "./types";

const line = (key: string, label: string): ProbePingSeries => ({
  key,
  label,
  current_ms: 1,
  loss_pct: 0,
  buckets: [],
});

const lines = [
  line("__avg__", "平均"),
  line("gd-ct", "广东电信"),
  line("google", "Google"),
  line("cloudflare", "Cloudflare"),
];

function equal<T>(actual: T, expected: T, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: ${JSON.stringify(actual)}`);
  }
}

equal(
  probeLinesForScope(lines, "idc").map((item) => item.key),
  ["google", "cloudflare"],
  "overseas scope",
);
equal(
  effectiveProbeLineKey(lines, "idc", "gd-ct"),
  "google",
  "mainland selection must reset overseas",
);
equal(
  effectiveProbeLineKey(lines, "cn", "gd-ct"),
  "gd-ct",
  "valid mainland selection must remain active",
);
equal(
  effectiveProbeLineKey(lines, "all", "google"),
  "google",
  "valid all-scope selection must remain active",
);
