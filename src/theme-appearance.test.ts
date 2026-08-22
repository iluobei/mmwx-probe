import { applyAppearance, saveColorModePreference } from "./use-probe";

function check(value: boolean, message: string) {
  if (!value) throw new Error(message);
}

const values = new Map<string, string>();
const classes = new Set<string>();
const classList = {
  [Symbol.iterator]: () => classes[Symbol.iterator](),
  add: (...names: string[]) => names.forEach((name) => classes.add(name)),
  remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
};
let systemDark = false;

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  },
});
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    documentElement: {
      classList,
      dataset: {},
      style: {},
    },
  },
});
Object.defineProperty(globalThis, "matchMedia", {
  configurable: true,
  value: () => ({ matches: systemDark }),
});

saveColorModePreference("dark");
applyAppearance({ theme: "pixel", color_mode: "light" });
check(classes.has("theme-pixel"), "server theme class was not applied");
check(
  classes.has("dark"),
  "local dark preference did not override server default",
);

saveColorModePreference("system");
systemDark = false;
applyAppearance({ theme: "premium", color_mode: "dark" });
check(
  classes.has("theme-premium"),
  "updated server theme class was not applied",
);
check(classes.has("light"), "system light preference was not resolved");
check(!classes.has("theme-pixel"), "stale server theme class was retained");

systemDark = true;
applyAppearance({ theme: "premium", color_mode: "light" });
check(classes.has("dark"), "system dark preference was not resolved");
