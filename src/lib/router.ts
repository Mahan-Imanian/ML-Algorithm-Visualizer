import { useSyncExternalStore } from "react";

export type Route =
  | { name: "explore" }
  | { name: "saved" }
  | { name: "lab"; query: URLSearchParams };

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, "");
  const [path, qs = ""] = h.split("?");
  const query = new URLSearchParams(qs);
  if (path === "/lab") return { name: "lab", query };
  if (path === "/saved") return { name: "saved" };
  return { name: "explore" };
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
}

export function navigate(path: string) {
  if (window.location.hash === `#${path}`) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else window.location.hash = path;
}

export function replaceHash(path: string) {
  const url = `${window.location.pathname}${window.location.search}#${path}`;
  window.history.replaceState(window.history.state, "", url);
}
