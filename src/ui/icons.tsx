import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Play = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 3v10l8-5z" fill="currentColor" stroke="none" />
  </Svg>
);
export const Pause = (p: P) => (
  <Svg {...p}>
    <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" stroke="none" />
  </Svg>
);
export const StepFwd = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 3.5v9l6-4.5z" fill="currentColor" stroke="none" />
    <path d="M12 3.5v9" />
  </Svg>
);
export const StepBack = (p: P) => (
  <Svg {...p}>
    <path d="M12.5 3.5v9l-6-4.5z" fill="currentColor" stroke="none" />
    <path d="M4 3.5v9" />
  </Svg>
);
export const ToStart = (p: P) => (
  <Svg {...p}>
    <path d="M3 3v10" />
    <path d="M8 8l5-4.5v9zM4.5 8l3.5-3v6z" fill="currentColor" stroke="none" />
  </Svg>
);
export const ToEnd = (p: P) => (
  <Svg {...p}>
    <path d="M13 3v10" />
    <path d="M8 8L3 3.5v9zM11.5 8L8 5v6z" fill="currentColor" stroke="none" />
  </Svg>
);
export const Restart = (p: P) => (
  <Svg {...p}>
    <path d="M3 8a5 5 0 1 0 1.6-3.7" />
    <path d="M3 2.5V5.5h3" />
  </Svg>
);
export const FlagPrev = (p: P) => (
  <Svg {...p}>
    <path d="M10 3L5 8l5 5" />
    <path d="M13 3v10" />
  </Svg>
);
export const FlagNext = (p: P) => (
  <Svg {...p}>
    <path d="M6 3l5 5-5 5" />
    <path d="M3 3v10" />
  </Svg>
);
export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4" />
    <path d="M10 10l3.5 3.5" />
  </Svg>
);
export const Share = (p: P) => (
  <Svg {...p}>
    <path d="M8 2.5v8M5 5.5l3-3 3 3" />
    <path d="M3 8.5v5h10v-5" />
  </Svg>
);
export const Bookmark = (p: P) => (
  <Svg {...p}>
    <path d="M4 2.5h8v11l-4-3-4 3z" />
  </Svg>
);
export const More = (p: P) => (
  <Svg {...p}>
    <path d="M3 8h.5M8 8h.5M13 8h.5" strokeWidth={2.2} />
  </Svg>
);
export const Close = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
  </Svg>
);
export const ChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M4 6l4 4 4-4" />
  </Svg>
);
export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M6 4l4 4-4 4" />
  </Svg>
);
export const Check = (p: P) => (
  <Svg {...p}>
    <path d="M3 8.5l3 3 7-7" />
  </Svg>
);
export const Wall = (p: P) => (
  <Svg {...p}>
    <path d="M3 3h10v10H3z" fill="currentColor" />
  </Svg>
);
export const Weight = (p: P) => (
  <Svg {...p}>
    <path d="M3 3h10v10H3z" />
    <path d="M3 9l6-6M3 13l10-10M7 13l6-6" strokeWidth={1} />
  </Svg>
);
export const Erase = (p: P) => (
  <Svg {...p}>
    <path d="M3 3h10v10H3z" strokeDasharray="2 2" />
  </Svg>
);
export const StartPin = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="4.5" fill="currentColor" />
  </Svg>
);
export const TargetPin = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5" />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
  </Svg>
);
export const Maze = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 2.5h11v11h-11zM2.5 6h5M10 2.5v6M5.5 9.5v4M8.5 11h5" />
  </Svg>
);
export const Dice = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 2.5h11v11h-11z" />
    <path d="M5.5 5.5h.5M10 5.5h.5M5.5 10h.5M10 10h.5M7.75 7.75h.5" strokeWidth={2} />
  </Svg>
);
export const Compare = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 3h4.5v10H2.5zM9 3h4.5v10H9z" />
  </Svg>
);
export const Sliders = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 4.5h11M2.5 11.5h11" />
    <path d="M5 3v3M11 10v3" strokeWidth={2} />
  </Svg>
);
export const Upload = (p: P) => (
  <Svg {...p}>
    <path d="M8 10.5v-8M5 5.5l3-3 3 3" />
    <path d="M2.5 10.5v3h11v-3" />
  </Svg>
);
export const Download = (p: P) => (
  <Svg {...p}>
    <path d="M8 2.5v8M5 7.5l3 3 3-3" />
    <path d="M2.5 10.5v3h11v-3" />
  </Svg>
);
export const Trash = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
  </Svg>
);
export const Keyboard = (p: P) => (
  <Svg {...p}>
    <path d="M1.5 4h13v8h-13z" />
    <path d="M4 6.5h.5M6.5 6.5H7M9 6.5h.5M11.5 6.5h.5M5 9.5h6" />
  </Svg>
);
export const Plus = (p: P) => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
);
export const Minus = (p: P) => (
  <Svg {...p}>
    <path d="M3 8h10" />
  </Svg>
);
export const Link = (p: P) => (
  <Svg {...p}>
    <path d="M7 9.5l2.5-2.5M6 6l-2 2a2.1 2.1 0 0 0 3 3l1-1M10 10l2-2a2.1 2.1 0 0 0-3-3l-1 1" />
  </Svg>
);
export const Grid = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z" />
  </Svg>
);
export const Panel = (p: P) => (
  <Svg {...p}>
    <path d="M2 3h12v10H2zM10 3v10" />
  </Svg>
);
export const PanelLeft = (p: P) => (
  <Svg {...p}>
    <path d="M2 3h12v10H2zM6 3v10" />
  </Svg>
);
export const Sun = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
  </Svg>
);
export const Moon = (p: P) => (
  <Svg {...p}>
    <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" />
  </Svg>
);
export const Info = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7v4M8 5h.01" />
  </Svg>
);
export const Warn = (p: P) => (
  <Svg {...p}>
    <path d="M8 2l6.5 11.5h-13z" />
    <path d="M8 6.5v3M8 11.5h.01" />
  </Svg>
);
export const Github = (p: P) => (
  <svg
    width={p.size ?? 16}
    height={p.size ?? 16}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.6 3.9.3.3.5.8.5 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2z" />
  </svg>
);

export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="2 2 12 12"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 14V5h3v3h3v3h3v3z" fill="rgb(var(--st-closed))" />
      <path d="M2 2h3v3H2zM5 5h3v3H5zM8 8h3v3H8zM11 11h3v3h-3z" fill="rgb(var(--signal))" />
      <path d="M2 11h3v3H2z" fill="currentColor" />
      <path d="M11 2h3v3h-3zM12 3v1h1V3z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
