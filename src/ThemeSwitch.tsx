import { useEffect, useState } from "react";
import { Moon, Sun, SunMoon } from "lucide-react";
import type { ProbeAppearance } from "./types";
import { nextColorMode, type ProbeColorMode } from "./theme-preference";
import {
  applyAppearance,
  readColorModePreference,
  saveColorModePreference,
} from "./use-probe";

const labels: Record<ProbeColorMode, string> = {
  light: "浅色主题",
  dark: "深色主题",
  system: "跟随系统主题",
};

export function ThemeSwitch({
  appearance,
  className,
}: {
  appearance?: ProbeAppearance;
  className?: string;
}) {
  const [mode, setMode] = useState<ProbeColorMode>(() =>
    readColorModePreference(appearance?.color_mode),
  );

  useEffect(() => {
    const next = readColorModePreference(appearance?.color_mode);
    setMode(next);
    applyAppearance(appearance);
  }, [appearance]);

  useEffect(() => {
    if (mode !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyAppearance(appearance);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [appearance, mode]);

  const cycle = () => {
    const next = nextColorMode(mode);
    saveColorModePreference(next);
    setMode(next);
    applyAppearance(appearance);
  };
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : SunMoon;

  return (
    <button
      type="button"
      className={
        className ? `probe-theme-switch ${className}` : "probe-theme-switch"
      }
      aria-label={labels[mode]}
      title={labels[mode]}
      onClick={cycle}
    >
      <Icon size={18} aria-hidden="true" />
      <span className="visually-hidden">{labels[mode]}</span>
    </button>
  );
}
