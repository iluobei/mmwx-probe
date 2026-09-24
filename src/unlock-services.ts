// 解锁检测服务目录(外置探针侧),与面板 src/lib/unlock-services.ts 同一份数据、同一顺序。
import {
  siApple,
  siClaude,
  siDazn,
  siGoogle,
  siGooglegemini,
  siGoogleplay,
  siNetflix,
  siReddit,
  siSpotify,
  siSteam,
  siWikipedia,
  siYoutube,
} from "simple-icons";
import type { ProbeUnlock } from "./types";

type BrandIcon = { path: string };

export type UnlockTone = "ok" | "partial" | "bad" | "banned" | "muted";

export type UnlockCategory = "streaming" | "ai" | "other";

export const UNLOCK_CATEGORIES: {
  key: UnlockCategory;
  zh: string;
  en: string;
}[] = [
  { key: "streaming", zh: "流媒体", en: "Streaming" },
  { key: "ai", zh: "AI", en: "AI" },
  { key: "other", zh: "其他", en: "Other" },
];

export type UnlockServiceMeta = {
  key: string;
  label: string;
  short: string;
  icon?: BrandIcon;
  category: UnlockCategory;
  info?: boolean;
};

const S: UnlockCategory = "streaming";
const A: UnlockCategory = "ai";
const O: UnlockCategory = "other";

export const UNLOCK_SERVICES: UnlockServiceMeta[] = [
  {
    key: "netflix",
    label: "Netflix",
    short: "N",
    icon: siNetflix,
    category: S,
  },
  { key: "disneyplus", label: "Disney+", short: "D+", category: S },
  {
    key: "youtube_premium",
    label: "YouTube Premium",
    short: "YT",
    icon: siYoutube,
    category: S,
  },
  { key: "prime_video", label: "Prime Video", short: "PV", category: S },
  { key: "tvb_anywhere", label: "TVB Anywhere+", short: "TVB", category: S },
  { key: "iqiyi", label: "iQIYI 国际版", short: "iQ", category: S, info: true },
  { key: "bing", label: "Bing", short: "B", category: O, info: true },
  {
    key: "apple",
    label: "Apple 地区",
    short: "A",
    icon: siApple,
    category: O,
    info: true,
  },
  { key: "openai", label: "ChatGPT", short: "AI", category: A },
  {
    key: "gemini",
    label: "Gemini",
    short: "G",
    icon: siGooglegemini,
    category: A,
  },
  { key: "claude", label: "Claude", short: "C", icon: siClaude, category: A },
  {
    key: "wikipedia",
    label: "Wikipedia 可编辑",
    short: "W",
    icon: siWikipedia,
    category: O,
  },
  {
    key: "google_play",
    label: "Google Play",
    short: "GP",
    icon: siGoogleplay,
    category: O,
    info: true,
  },
  {
    key: "google_search",
    label: "Google 搜索无验证码",
    short: "G",
    icon: siGoogle,
    category: O,
  },
  {
    key: "steam",
    label: "Steam 货币",
    short: "St",
    icon: siSteam,
    category: O,
    info: true,
  },
  { key: "reddit", label: "Reddit", short: "R", icon: siReddit, category: O },
  { key: "dazn", label: "DAZN", short: "DZ", icon: siDazn, category: S },
  {
    key: "onetrust",
    label: "OneTrust 地区",
    short: "1T",
    category: O,
    info: true,
  },
  {
    key: "youtube_cdn",
    label: "YouTube CDN",
    short: "YC",
    icon: siYoutube,
    category: S,
    info: true,
  },
  {
    key: "netflix_cdn",
    label: "Netflix CDN",
    short: "NC",
    icon: siNetflix,
    category: S,
    info: true,
  },
  {
    key: "sdggge",
    label: "SD Gundam G Generation Eternal",
    short: "SD",
    category: O,
  },
  {
    key: "spotify",
    label: "Spotify 注册",
    short: "S",
    icon: siSpotify,
    category: S,
  },
];

const byKey = new Map(UNLOCK_SERVICES.map((s) => [s.key, s]));

export function unlockServiceMeta(key: string): UnlockServiceMeta {
  return (
    byKey.get(key) ?? {
      key,
      label: key,
      short: key.slice(0, 2).toUpperCase(),
      category: "other",
    }
  );
}

const STATUS_META: Record<
  string,
  { tone: UnlockTone; zh: string; en: string }
> = {
  yes: { tone: "ok", zh: "已解锁", en: "Unlocked" },
  originals_only: { tone: "partial", zh: "仅自制剧", en: "Originals only" },
  no: { tone: "bad", zh: "未解锁", en: "Blocked" },
  banned: { tone: "banned", zh: "IP 被封禁", en: "IP banned" },
  failed: { tone: "muted", zh: "检测失败", en: "Check failed" },
};

export function unlockStatusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.failed;
}

export function isUnlocked(status: string): boolean {
  return status === "yes" || status === "originals_only";
}

export function unlockStatusText(u: ProbeUnlock, zh: boolean): string {
  const meta = unlockServiceMeta(u.service);
  const st = unlockStatusMeta(u.status);
  if (meta.info && u.status === "yes") return u.region || "—";
  const label = zh ? st.zh : st.en;
  return u.region ? `${label} · ${u.region}` : label;
}

export function unlockTitle(u: ProbeUnlock, zh: boolean): string {
  const meta = unlockServiceMeta(u.service);
  const st = unlockStatusMeta(u.status);
  if (meta.info && u.status === "yes") {
    return `${meta.label}: ${u.region || "—"}`;
  }
  const label = zh ? st.zh : st.en;
  return u.region
    ? `${meta.label} · ${label} (${u.region})`
    : `${meta.label} · ${label}`;
}

export function groupUnlocks(
  unlocks: ProbeUnlock[],
): Record<UnlockCategory, ProbeUnlock[]> {
  const order = new Map(UNLOCK_SERVICES.map((s, i) => [s.key, i]));
  const sorted = [...unlocks].sort(
    (a, b) => (order.get(a.service) ?? 999) - (order.get(b.service) ?? 999),
  );
  const out: Record<UnlockCategory, ProbeUnlock[]> = {
    streaming: [],
    ai: [],
    other: [],
  };
  for (const u of sorted) out[unlockServiceMeta(u.service).category].push(u);
  return out;
}
