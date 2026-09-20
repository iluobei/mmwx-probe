import type { TriISPPublic } from "./types";

/** 一条三网展示行:配置里的槽位 + 它在本机的实测序列(没探到就是 undefined)。 */
export type TriISPRow<S> = {
  isp: string;
  label: string;
  series?: S;
};

/**
 * triISPRows 把「三网配置」与「某台服务器的实测序列」对起来,产出三行展示数据。
 *
 * 按 **key** 匹配而不是 label:label 是展示名,管理员随时可能改,
 * 按 label 匹配会在改名当天让三行集体变空。
 *
 * 匹配不到的槽位仍然保留(series 为空),由调用方画成「无数据」——
 * 直接跳过会让三行变两行,而「移动没数据」本身就是要给人看的信息。
 *
 * 与主控 miaomiaowuX 的 src/lib/tri-isp-targets.ts 保持同一套语义:
 * 两处画的是同一份数据,匹配规则不一致会让同一台机器在内外探针上显示不同。
 */
export function triISPRows<S extends { key?: string }>(
  tri: TriISPPublic | undefined,
  series: S[],
): TriISPRow<S>[] {
  if (!tri?.enabled || !tri.targets?.length) return [];
  const byKey = new Map<string, S>();
  for (const s of series) {
    if (s.key) byKey.set(s.key, s);
  }
  return tri.targets.map((t) => ({
    isp: t.isp,
    label: t.label,
    series: byKey.get(t.key),
  }));
}
