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

export type UnlockServiceMeta = {
  key: string;
  label: string;
  short: string;
  icon?: BrandIcon;
  info?: boolean;
};

export const UNLOCK_SERVICES: UnlockServiceMeta[] = [
  { key: "netflix", label: "Netflix", short: "N", icon: siNetflix },
  { key: "disneyplus", label: "Disney+", short: "D+" },
  {
    key: "youtube_premium",
    label: "YouTube Premium",
    short: "YT",
    icon: siYoutube,
  },
  { key: "prime_video", label: "Prime Video", short: "PV" },
  { key: "tvb_anywhere", label: "TVB Anywhere+", short: "TVB" },
  { key: "iqiyi", label: "iQIYI 国际版", short: "iQ", info: true },
  { key: "bing", label: "Bing", short: "B", info: true },
  { key: "apple", label: "Apple 地区", short: "A", icon: siApple, info: true },
  { key: "openai", label: "ChatGPT", short: "AI" },
  { key: "gemini", label: "Gemini", short: "G", icon: siGooglegemini },
  { key: "claude", label: "Claude", short: "C", icon: siClaude },
  {
    key: "wikipedia",
    label: "Wikipedia 可编辑",
    short: "W",
    icon: siWikipedia,
  },
  {
    key: "google_play",
    label: "Google Play",
    short: "GP",
    icon: siGoogleplay,
    info: true,
  },
  {
    key: "google_search",
    label: "Google 搜索无验证码",
    short: "G",
    icon: siGoogle,
  },
  { key: "steam", label: "Steam 货币", short: "St", icon: siSteam, info: true },
  { key: "reddit", label: "Reddit", short: "R", icon: siReddit },
  { key: "dazn", label: "DAZN", short: "DZ", icon: siDazn },
  { key: "onetrust", label: "OneTrust 地区", short: "1T", info: true },
  {
    key: "youtube_cdn",
    label: "YouTube CDN",
    short: "YC",
    icon: siYoutube,
    info: true,
  },
  {
    key: "netflix_cdn",
    label: "Netflix CDN",
    short: "NC",
    icon: siNetflix,
    info: true,
  },
  { key: "sdggge", label: "SD Gundam G Generation Eternal", short: "SD" },
  { key: "spotify", label: "Spotify 注册", short: "S", icon: siSpotify },
];

const byKey = new Map(UNLOCK_SERVICES.map((s) => [s.key, s]));

export function unlockServiceMeta(key: string): UnlockServiceMeta {
  return (
    byKey.get(key) ?? { key, label: key, short: key.slice(0, 2).toUpperCase() }
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
