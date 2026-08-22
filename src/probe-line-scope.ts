import type { ProbePingSeries } from "./types";

export type ProbeLineScope = "all" | "cn" | "idc";

const mainlandCarrierPattern = /电信|联通|移动/;

export function isMainlandProbeLine(line: ProbePingSeries): boolean {
  return mainlandCarrierPattern.test(line.label);
}

export function probeLinesForScope(
  lines: ProbePingSeries[],
  scope: ProbeLineScope,
): ProbePingSeries[] {
  if (scope === "all") return lines;
  const mainland = scope === "cn";
  return lines.filter(
    (line) =>
      (line.key || line.label) !== "__avg__" &&
      isMainlandProbeLine(line) === mainland,
  );
}

export function effectiveProbeLineKey(
  lines: ProbePingSeries[],
  scope: ProbeLineScope,
  selectedKey: string,
): string {
  const visible = probeLinesForScope(lines, scope);
  if (visible.some((line) => (line.key || line.label) === selectedKey)) {
    return selectedKey;
  }
  return visible[0]?.key || visible[0]?.label || "";
}
