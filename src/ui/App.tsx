import { Component, lazy, Suspense, useEffect, type ReactNode } from "react";
import { parseHash, useHash } from "@/lib/router";
import { useLayout } from "@/lib/layout";
import { isDarkTheme, useSettings } from "@/store/settings";
import { useUI } from "@/store/ui";
import { CommandPalette } from "./CommandPalette";
import { ImportDialog, SaveDialog, SettingsDialog, ShareDialog, ShortcutsDialog } from "./Dialogs";
import { Explore, Saved } from "./Explore";
import { Header } from "./Header";
import { Button, TooltipProvider } from "./primitives";
import { useShortcuts } from "./shortcuts";
import { Toaster } from "./toast";
import { Tour } from "./Tour";
import { PerfHud } from "./PerfHud";

const Lab = lazy(() => import("./lab/Lab").then((m) => ({ default: m.Lab })));

function useThemeSync() {
  const theme = useSettings((s) => s.theme);
  const motion = useSettings((s) => s.motion);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = isDarkTheme(theme);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#141719" : "#f8f7f3");
    };
    apply();
    mq?.addEventListener?.("change", apply);
    return () => mq?.removeEventListener?.("change", apply);
  }, [theme]);
  useEffect(() => {
    if (motion === "system") delete document.documentElement.dataset.motion;
    else document.documentElement.dataset.motion = motion;
  }, [motion]);
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-[560px] px-6 py-20">
        <p className="label mb-2">Something broke</p>
        <h1 className="text-xl font-semibold">This experiment hit an error.</h1>
        <p className="mt-2 text-ink-2">
          Your saved experiments are safe. Reloading the explore page usually fixes it.
        </p>
        <pre className="readout mt-4 overflow-auto rounded border border-rule bg-sunken p-3 text-xs text-ink-2">
          {this.state.error.message}
        </pre>
        <Button
          className="mt-4"
          variant="primary"
          onClick={() => {
            window.location.hash = "/";
            window.location.reload();
          }}
        >
          Back to Explore
        </Button>
      </div>
    );
  }
}

export default function App() {
  useThemeSync();
  useShortcuts();
  const hash = useHash();
  const route = parseHash(hash);
  const layout = useLayout();
  const setupOpen = useUI((s) => s.setupOpen);
  const setSetupOpen = useUI((s) => s.setSetupOpen);
  const fullHeight = route.name === "lab" && layout !== "narrow";

  useEffect(() => {
    const titles = {
      explore: "Stride · step through algorithms beside their data structures",
      lab: "Lab · Stride",
      saved: "Saved experiments · Stride",
    };
    document.title = titles[route.name];
  }, [route.name]);

  return (
    <TooltipProvider>
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only z-50 bg-ink px-3 py-2 text-surface focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <div className={fullHeight ? "flex h-dvh flex-col overflow-hidden" : "min-h-dvh"}>
        <Header route={route.name} />
        <main
          id="main"
          tabIndex={-1}
          className={fullHeight ? "min-h-0 flex-1 outline-none" : "outline-none"}
        >
          <ErrorBoundary>
            {route.name === "explore" && <Explore />}
            {route.name === "saved" && <Saved />}
            {route.name === "lab" && (
              <Suspense
                fallback={<p className="px-6 py-10 text-sm text-ink-3">Loading the lab…</p>}
              >
                <Lab query={route.query} setupOpen={setupOpen} setSetupOpen={setSetupOpen} />
              </Suspense>
            )}
          </ErrorBoundary>
        </main>
      </div>
      <CommandPalette />
      <ShareDialog />
      <SaveDialog />
      <ImportDialog />
      <ShortcutsDialog />
      <SettingsDialog />
      <Tour />
      <PerfHud />
      <Toaster offset={route.name === "lab" && layout === "narrow" ? 150 : 24} />
    </TooltipProvider>
  );
}
