import { FAMILIES, algosOf, familyName, getAlgo, type AlgoId } from "@/core/info";
import { isCompactWidth, useLayout } from "@/lib/layout";
import { cn, isMac } from "@/lib/utils";
import { useLab } from "@/store/lab";
import { isDarkTheme, useSettings } from "@/store/settings";
import { useUI } from "@/store/ui";
import { exportExperiment } from "./commands";
import {
  Bookmark,
  ChevronDown,
  Compare,
  Download,
  Github,
  Grid,
  Keyboard,
  Mark,
  Moon,
  More,
  PanelLeft,
  Search,
  Share,
  Sliders,
  Sun,
  Upload,
} from "./icons";
import { suggestB } from "./lab/variants";
import {
  Button,
  IconButton,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "./primitives";

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-12 items-center px-2.5 text-sm transition-colors",
        active ? "text-ink" : "text-ink-2 hover:text-ink",
        active && "after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:bg-ink",
      )}
    >
      {children}
    </a>
  );
}

function AlgoSwitcher() {
  const algo = useLab((s) => s.exp.a.algo);
  const setAlgo = useLab((s) => s.setAlgo);
  const info = getAlgo(algo);
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button className="flex h-8 min-w-0 items-center gap-2 rounded border border-rule-strong bg-surface pl-2.5 pr-2 text-left hover:bg-sunken">
          <span className="sr-only">Change algorithm: </span>
          <span className="hidden text-xs text-ink-3 sm:inline">{familyName(info.family)}</span>
          <span className="hidden text-ink-3 sm:inline">/</span>
          <span className="truncate text-sm font-medium">{info.name}</span>
          <ChevronDown className="shrink-0 text-ink-2" />
        </button>
      </MenuTrigger>
      <MenuContent align="start" className="max-h-[70dvh] w-[320px] overflow-y-auto">
        <MenuRadioGroup
          value={algo}
          onValueChange={(v) => setAlgo(v as AlgoId, isCompactWidth(window.innerWidth))}
        >
          {FAMILIES.map((f, i) => (
            <div key={f.id}>
              {i > 0 && <MenuSeparator />}
              <MenuLabel>{f.name}</MenuLabel>
              {algosOf(f.id).map((a) => (
                <MenuRadioItem key={a.id} value={a.id} hint={a.complexity.average}>
                  {a.name}
                </MenuRadioItem>
              ))}
            </div>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  );
}

export function Header({ route }: { route: "explore" | "lab" | "saved" }) {
  const layout = useLayout();
  const open = useUI((s) => s.open);
  const setSetupOpen = useUI((s) => s.setSetupOpen);
  const hasB = useLab((s) => !!s.exp.b);
  const setB = useLab((s) => s.setVariantB);
  const theme = useSettings((s) => s.theme);
  const toggleTheme = useSettings((s) => s.toggleTheme);
  const isLab = route === "lab";
  const narrow = layout === "narrow";
  const dark = isDarkTheme(theme);

  const toggleCompare = () => {
    const s = useLab.getState();
    setB(s.exp.b ? null : suggestB(s.exp));
  };

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-rule bg-surface pr-2">
      <a
        href="#/"
        className="flex h-12 items-center gap-2 px-3 text-ink"
        aria-label="Stride home"
      >
        <Mark />
        <span className={cn("text-md font-semibold tracking-tight", narrow && isLab && "sr-only")}>
          Stride
        </span>
      </a>
      {!(narrow && isLab) && (
        <nav aria-label="Primary" className="hidden items-center sm:flex">
          <NavLink href="#/" active={route === "explore"}>
            Explore
          </NavLink>
          <NavLink href="#/lab" active={route === "lab"}>
            Lab
          </NavLink>
          <NavLink href="#/saved" active={route === "saved"}>
            Saved
          </NavLink>
        </nav>
      )}
      {isLab && (
        <div
          className={cn(
            "flex min-w-0 items-center gap-1.5",
            !narrow && "ml-3 border-l border-rule pl-3",
          )}
        >
          {layout === "medium" && (
            <IconButton label="Setup" variant="outline" onClick={() => setSetupOpen(true)}>
              <PanelLeft />
            </IconButton>
          )}
          <AlgoSwitcher />
          {!narrow && (
            <Button
              variant={hasB ? "primary" : "outline"}
              onClick={toggleCompare}
              aria-pressed={hasB}
              data-tour="compare-btn"
              title="Compare (C)"
            >
              <Compare />
              Compare
            </Button>
          )}
        </div>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          onClick={() => open("palette")}
          className={cn("text-ink-2", narrow ? "w-8 px-0" : "w-auto")}
        >
          <Search />
          {narrow ? (
            <span className="sr-only">Search commands and algorithms</span>
          ) : (
            <span className="flex items-center gap-2">
              <span>
                Search<span className="sr-only"> commands and algorithms</span>
              </span>
              <span className="readout text-2xs text-ink-3">{isMac ? "⌘K" : "Ctrl K"}</span>
            </span>
          )}
        </Button>
        {isLab && !narrow && (
          <>
            <IconButton
              label="Save"
              keys={isMac ? "⌘S" : "Ctrl S"}
              tipSide="bottom"
              onClick={() => open("save")}
            >
              <Bookmark />
            </IconButton>
            <Button variant="outline" onClick={() => open("share")}>
              <Share />
              Share
            </Button>
          </>
        )}
        {isLab && narrow && (
          <Button
            variant={hasB ? "primary" : "ghost"}
            size="icon"
            aria-label="Compare"
            aria-pressed={hasB}
            onClick={toggleCompare}
            data-tour="compare-btn"
          >
            <Compare />
          </Button>
        )}
        <MenuRoot>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More">
              <More />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {narrow && (
              <>
                <MenuItem onSelect={() => (window.location.hash = "/")}>
                  <Grid /> Explore
                </MenuItem>
                <MenuItem onSelect={() => (window.location.hash = "/saved")}>
                  <Bookmark /> Saved experiments
                </MenuItem>
                <MenuSeparator />
              </>
            )}
            {isLab && narrow && (
              <>
                <MenuItem onSelect={() => open("save")}>
                  <Bookmark /> Save experiment
                </MenuItem>
                <MenuItem onSelect={() => open("share")}>
                  <Share /> Share link
                </MenuItem>
              </>
            )}
            {isLab && (
              <MenuItem onSelect={exportExperiment}>
                <Download /> Export as JSON
              </MenuItem>
            )}
            <MenuItem onSelect={() => open("import")}>
              <Upload /> Import experiment
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={toggleTheme}>
              {dark ? <Sun /> : <Moon />} {dark ? "Paper theme" : "Scope theme"}
              {theme === "system" && <span className="ml-auto text-2xs text-ink-3">system</span>}
            </MenuItem>
            <MenuItem onSelect={() => open("shortcuts")} keys="?">
              <Keyboard /> Keyboard shortcuts
            </MenuItem>
            <MenuItem onSelect={() => open("settings")}>
              <Sliders /> Settings
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              onSelect={() =>
                window.open(
                  "https://github.com/Mahan-Imanian/stride",
                  "_blank",
                  "noopener",
                )
              }
            >
              <Github /> Source on GitHub
            </MenuItem>
          </MenuContent>
        </MenuRoot>
      </div>
    </header>
  );
}
