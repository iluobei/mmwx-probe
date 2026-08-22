import type { ProbeAppearance } from "./types";

export type ProbeColorMode = NonNullable<ProbeAppearance["color_mode"]>;

export function normalizeColorMode(
  value: string | null | undefined,
  fallback: ProbeColorMode = "light",
): ProbeColorMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : fallback;
}

export function nextColorMode(mode: ProbeColorMode): ProbeColorMode {
  if (mode === "light") return "dark";
  if (mode === "dark") return "system";
  return "light";
}
