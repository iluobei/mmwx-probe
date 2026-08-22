import { useEffect, useRef, useState } from "react";
import type { ProbeAppearance, ProbePayload, ThemeName } from "./types";
import { applyProbeDocumentBranding } from "./document-branding";
import { normalizeColorMode, type ProbeColorMode } from "./theme-preference";

const APPEARANCE_CACHE = "mmwx-probe-appearance";
const COLOR_MODE_PREFERENCE = "mmwx-probe-color-mode";

function normalizeTheme(value?: string): ThemeName {
  const theme = value?.trim();
  return theme && /^[A-Za-z0-9_-]{1,64}$/.test(theme) ? theme : "pixel";
}

export function applyAppearance(input?: ProbeAppearance) {
  const cached = (() => {
    try {
      return JSON.parse(
        localStorage.getItem(APPEARANCE_CACHE) || "null",
      ) as ProbeAppearance | null;
    } catch {
      return null;
    }
  })();
  const appearance = input || cached || { theme: "pixel", color_mode: "light" };
  const theme = normalizeTheme(appearance.theme);
  const colorMode = readColorModePreference(appearance.color_mode);
  const root = document.documentElement;
  for (const className of Array.from(root.classList)) {
    if (className.startsWith("theme-")) root.classList.remove(className);
  }
  root.classList.remove("light", "dark");
  root.classList.add(`theme-${theme}`);
  const dark =
    colorMode === "dark" ||
    (colorMode === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.add(dark ? "dark" : "light");
  root.style.colorScheme = dark ? "dark" : "light";
  root.dataset.themeReady = "true";
  if (input) {
    try {
      localStorage.setItem(APPEARANCE_CACHE, JSON.stringify(input));
    } catch {
      // Theme switching must keep working when storage is blocked.
    }
  }
}

export function readColorModePreference(
  fallback?: ProbeAppearance["color_mode"],
): ProbeColorMode {
  try {
    return normalizeColorMode(
      localStorage.getItem(COLOR_MODE_PREFERENCE),
      normalizeColorMode(fallback),
    );
  } catch {
    return normalizeColorMode(fallback);
  }
}

export function saveColorModePreference(mode: ProbeColorMode) {
  try {
    localStorage.setItem(COLOR_MODE_PREFERENCE, mode);
  } catch {
    // Applying the selected mode for the current page still succeeds.
  }
}

export function useProbe(): { data?: ProbePayload; error?: string } {
  const [data, setData] = useState<ProbePayload>();
  const [error, setError] = useState<string>();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let stopped = false;
    let ws: WebSocket | undefined;

    const accept = (payload: ProbePayload) => {
      if (stopped) return;
      applyAppearance(payload.appearance);
      setData(payload);
      setError(undefined);
      applyProbeDocumentBranding(payload.title, payload.icon);
    };
    const poll = async () => {
      try {
        const response = await fetch("/api/probe", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        accept((await response.json()) as ProbePayload);
      } catch (cause) {
        if (!stopped)
          setError(cause instanceof Error ? cause.message : String(cause));
      }
    };
    const startPolling = () => {
      if (timer.current) return;
      void poll();
      timer.current = window.setInterval(poll, 5000);
    };

    applyAppearance();
    // Keep polling as a fallback even when the WebSocket handshake succeeds.
    // Some proxies leave an idle WebSocket open without forwarding later frames,
    // which otherwise freezes realtime speed at the first snapshot.
    startPolling();
    try {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${location.host}/api/stream`);
      ws.onmessage = (event) => {
        try {
          accept(JSON.parse(event.data) as ProbePayload);
        } catch {
          /* wait for next frame */
        }
      };
      ws.onerror = startPolling;
      ws.onclose = startPolling;
    } catch {
      startPolling();
    }

    return () => {
      stopped = true;
      ws?.close();
      if (timer.current) window.clearInterval(timer.current);
      timer.current = undefined;
    };
  }, []);

  return { data, error };
}
