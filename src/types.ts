export type ThemeName = string;

export interface ProbeAppearance {
  theme: ThemeName;
  color_mode?: "light" | "dark" | "system";
  revision?: string;
}

export interface ProbeBucket {
  ms: number;
  loss: number;
}

export interface ProbePingSeries {
  key?: string;
  label: string;
  isp?: string;
  current_ms: number;
  loss_pct: number;
  buckets: ProbeBucket[];
}

export interface ProbeServer {
  name?: string;
  region?: string;
  region_country?: string;
  region_name?: string;
  region_city?: string;
  online: boolean;
  upload_speed?: number;
  download_speed?: number;
  traffic_used?: number;
  traffic_used_up?: number;
  traffic_used_down?: number;
  traffic_used_total?: number;
  traffic_limit?: number;
  traffic_source?: "xray" | "system";
  traffic_stats_mode?: "both" | "upload" | "download" | "max";
  traffic_adjustment?: number;
  traffic_used_scope?: "configured_period" | "counter_since_reset" | string;
  period_start?: string;
  period_end?: string;
  daily_traffic_scope?:
    "configured_period_and_recent_7d" | "recent_7d" | string;
  daily_traffic_start?: string;
  daily_traffic_end?: string;
  boot_traffic_up?: number;
  boot_traffic_down?: number;
  boot_traffic_scope?: "current_boot" | string;
  cumulative_up?: number;
  cumulative_down?: number;
  cumulative_traffic_scope?: "current_boot" | string;
  daily_traffic?: Array<{
    date: string;
    uplink: number;
    downlink: number;
    total: number;
  }>;
  cpu_pct?: number;
  loadavg?: string;
  mem_used?: number;
  mem_total?: number;
  disk_used?: number;
  disk_total?: number;
  uptime?: number;
  cpu_model?: string;
  cpu_cores?: number;
  cpu_threads?: number;
  os?: string;
  kernel?: string;
  arch?: string;
  ping?: ProbePingSeries[];
  expires_at?: string;
  renewal_price?: number;
  renewal_price_cny?: number;
  renewal_cycle?: "month" | "quarter" | "half_year" | "year";
  renewal_currency?: string;
  provider_name?: string;
  provider_url?: string;
  telecom_paid_peer?: boolean;
  return_routes?: ProbeReturnRoute[];
  unlocks?: ProbeUnlock[];
}

export interface ProbeUnlock {
  service: string;
  status: string;
  region?: string;
  tested_at?: string;
}

export interface ProbeReturnRoute {
  carrier: "telecom" | "unicom" | "mobile";
  region?: string;
  route_type: string;
  tested_at?: string;
}

export interface ForwardChainServerData {
  name: string;
  to_next_ms: number;
  healthy: boolean;
}
export interface ForwardChainGroupData {
  name: string;
  role: "entry" | "mid" | "exit";
  to_next_ms: number;
  servers: ForwardChainServerData[];
}
export interface ForwardChainBucket {
  ts: number;
  e2e_ms: number;
  loss: number;
}
export interface ForwardTrafficServer {
  name: string;
  group: string;
  role: string;
  daily_gb: number[];
  total_gb: number;
}
export interface ForwardChainTraffic {
  days: string[];
  servers: ForwardTrafficServer[];
  total_gb: number;
}
export interface ForwardChainData {
  name: string;
  end_to_end_ms: number;
  loss_pct: number;
  groups: ForwardChainGroupData[];
  bucket_sec: number;
  trend: ForwardChainBucket[];
  traffic?: ForwardChainTraffic | null;
}

export interface TriISPPublicSlot {
  isp: string;
  key: string;
  label: string;
}

export interface TriISPPublic {
  enabled?: boolean;
  targets?: TriISPPublicSlot[];
}

export interface ProbePayload {
  enabled: boolean;
  forward?: ForwardChainData[];
  show_globe?: boolean;
  show_daily_trend?: boolean;
  show_traffic_hotspots?: boolean;
  show_traffic_7d?: boolean;
  show_resource_heatmap?: boolean;
  show_traffic_quota?: boolean;
  show_renewal_timeline?: boolean;
  show_health_score?: boolean;
  /** 三网延迟:哪三个探测点代表电信/联通/移动。主控只下发 isp/key/label ——
   *  host/port/type 属于探测目标与探测方式,对外页面上从网络面板一眼可见,刻意不带。 */
  tri_isp?: TriISPPublic;
  title?: string;
  logo?: string;
  icon?: string;
  appearance?: ProbeAppearance;
  license_badge?: {
    name?: string;
    display_name?: string;
  };
  servers?: ProbeServer[];
}
