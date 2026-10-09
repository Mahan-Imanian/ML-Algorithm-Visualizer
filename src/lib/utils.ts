import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const PUBLIC_URL = "https://mahan-imanian.github.io/ML-Algorithm-Visualizer/";

export function appBaseUrl(): string {
  if (typeof location === "undefined") return PUBLIC_URL;
  if (location.protocol === "chrome-extension:") return PUBLIC_URL;
  return `${location.origin}${location.pathname}`;
}

export function downloadText(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
