import { nextColorMode, normalizeColorMode } from "./theme-preference";

function equal<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: got ${String(actual)}, want ${String(expected)}`,
    );
  }
}

equal(nextColorMode("light"), "dark", "light cycles to dark");
equal(nextColorMode("dark"), "system", "dark cycles to system");
equal(nextColorMode("system"), "light", "system cycles to light");
equal(normalizeColorMode("sepia"), "light", "invalid mode uses safe default");
equal(
  normalizeColorMode(undefined, "system"),
  "system",
  "missing mode uses configured fallback",
);
