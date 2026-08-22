import { DEFAULT_PROBE_TITLE, probeDocumentTitle } from "./document-branding";

function equal(actual: string, expected: string, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: got ${actual}, want ${expected}`);
  }
}

equal(probeDocumentTitle("  My Probe  "), "My Probe", "custom title");
equal(probeDocumentTitle(""), DEFAULT_PROBE_TITLE, "empty title fallback");
equal(
  probeDocumentTitle(undefined),
  DEFAULT_PROBE_TITLE,
  "missing title fallback",
);
