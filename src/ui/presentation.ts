import { useUI } from "@/store/ui";

export function enterPresentation() {
  useUI.getState().setPresent(true);
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen?.().catch(() => undefined);
}

export function exitPresentation() {
  useUI.getState().setPresent(false);
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
}
