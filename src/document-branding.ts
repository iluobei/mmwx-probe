export const DEFAULT_PROBE_TITLE = "妙妙屋X";
export const DEFAULT_PROBE_ICON = "/favicon.svg";

export function probeDocumentTitle(title?: string): string {
  return title?.trim() || DEFAULT_PROBE_TITLE;
}

export function applyProbeDocumentBranding(title?: string, icon?: string) {
  document.title = probeDocumentTitle(title);
  let favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }
  favicon.href = icon?.trim() || DEFAULT_PROBE_ICON;
}
