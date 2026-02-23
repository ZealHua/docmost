import {
  createTheme,
  CSSVariablesResolver,
  MantineColorsTuple,
  rem,
} from "@mantine/core";

// ─── Brand violet — anchored to #7c3aed (#9370ff system) ─────────────────────
// Index 6 is the primary swatch used by Mantine for buttons, focus rings, etc.
// We keep it at #7c3aed so every Mantine component that references
// primaryColor="violet" lands exactly on our design-system core.
const violet: MantineColorsTuple = [
  "#f3eeff", // 0  — surface tints, chip backgrounds
  "#e8deff", // 1  — hover fills
  "#d3bfff", // 2  — subtle borders
  "#b899ff", // 3  — mid-weight accents
  "#a07af9", // 4  — dark-mode text accents  (#a78bfa family)
  "#9370ff", // 5  — bright accent / active states
  "#7c3aed", // 6  — PRIMARY — buttons, focus, badges
  "#6d28d9", // 7  — pressed / deep fills
  "#5b21b6", // 8  — darkest fills / gradients
  "#3b0764", // 9  — deepest shadow tones
];

// ─── Blue — kept but harmonised toward indigo so it doesn't fight violet ─────
const blue: MantineColorsTuple = [
  "#eef2ff",
  "#e0e7ff",
  "#c7d2fe",
  "#a5b4fc",
  "#818cf8",
  "#6366f1",
  "#4f46e5",
  "#4338ca",
  "#3730a3",
  "#312e81",
];

// ─── Red — unchanged (neutral, no conflict) ───────────────────────────────────
const red: MantineColorsTuple = [
  "#ffebeb",
  "#fad7d7",
  "#eeadad",
  "#e3807f",
  "#da5a59",
  "#d54241",
  "#d43535",
  "#bc2727",
  "#a82022",
  "#93151b",
];

export const theme = createTheme({
  // ── Brand colours ────────────────────────────────────────────────────────
  colors: {
    violet, blue, red,

    // Override the built-in "dark" scale so dark-mode surfaces
    // all carry our violet undertone.
    dark: [
      "#dcd6f7", // dark.0 — primary text in dark mode
      "#bfb8e8", // dark.1 — secondary text
      "#9e95d0", // dark.2 — muted text           (was neutral grey)
      "#6b5fa8", // dark.3 — placeholder / borders
      "#3d2f7a", // dark.4 — subtle border fills   (#0f0b1f family)
      "#261a5e", // dark.5 — component backgrounds
      "#180f40", // dark.6 — panel backgrounds     (≈ #0f0b1f + depth)
      "#110a2e", // dark.7 — page / modal backgrounds
      "#0d0720", // dark.8 — deepest background    (#0f0b1f)
      "#08041a", // dark.9 — absolute darkest
    ] as MantineColorsTuple,
  },
  primaryColor: "violet",        // every default Mantine accent is now violet
  primaryShade: { light: 6, dark: 5 }, // [6] in light, [5] in dark

  // ── Typography — matches the Sora / DM Sans / IBM Plex Mono system ───────
  fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', 'Fira Code', monospace",
  headings: {
    fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif",
    fontWeight: "700",
  },
  fontSizes: {
    xs:  rem(11),
    sm:  rem(12.5),
    md:  rem(14),
    lg:  rem(16),
    xl:  rem(18),
  },

  // ── Shape ────────────────────────────────────────────────────────────────
  defaultRadius: "md",
  radius: {
    xs:  rem(4),
    sm:  rem(6),
    md:  rem(10),
    lg:  rem(14),
    xl:  rem(20),
  },

  // ── Spacing ──────────────────────────────────────────────────────────────
  spacing: {
    xs:  rem(6),
    sm:  rem(10),
    md:  rem(14),
    lg:  rem(20),
    xl:  rem(32),
  },

  // ── Shadows — violet-tinted, not cold grey ───────────────────────────────
  shadows: {
    xs:  "0 1px 4px rgba(109, 40, 217, 0.10)",
    sm:  "0 2px 8px rgba(109, 40, 217, 0.15)",
    md:  "0 4px 16px rgba(109, 40, 217, 0.20)",
    lg:  "0 6px 28px rgba(109, 40, 217, 0.28)",
    xl:  "0 10px 40px rgba(109, 40, 217, 0.35)",
  },

  // ── Focus ring — violet glow instead of default blue ────────────────────
  focusRing: "auto",
  focusClassName: "quantum-focus",

  // ── Cursor ───────────────────────────────────────────────────────────────
  cursorType: "pointer",
});

// ─── CSS Variables Resolver ───────────────────────────────────────────────────
export const mantineCssResolver: CSSVariablesResolver = (theme) => ({
  variables: {
    // ── Typography ──────────────────────────────────────────────────────────
    "--input-error-size": theme.fontSizes.sm,

    // ── Brand violet shortcuts ───────────────────────────────────────────────
    "--quantum-violet-core":    "#7c3aed", // primary
    "--quantum-violet-bright":  "#9370ff", // active / hover
    "--quantum-violet-light":   "#a78bfa", // text / icon accents
    "--quantum-violet-pale":    "#c4b5fd", // light fills / gradients
    "--quantum-violet-ghost":   "rgba(147, 112, 255, 0.12)", // surface tints
    "--quantum-violet-border":  "rgba(147, 112, 255, 0.22)", // borders
    "--quantum-violet-glow-sm": "0 0 12px rgba(109, 40, 217, 0.4)",
    "--quantum-violet-glow-md": "0 0 24px rgba(109, 40, 217, 0.55)",
    "--quantum-violet-glow-lg": "0 0 40px rgba(109, 40, 217, 0.7)",

    // ── Orbit ring colour (re-usable in any component) ───────────────────────
    "--quantum-orbit-primary":  "rgba(167, 139, 250, 0.65)",
    "--quantum-orbit-secondary":"rgba(167, 139, 250, 0.18)",

    // ── Animation durations ─────────────────────────────────────────────────
    "--quantum-dur-breathe":    "2.8s",
    "--quantum-dur-shimmer":    "3.5s",
    "--quantum-dur-orbit-slow": "3.5s",
    "--quantum-dur-orbit-fast": "2.4s",

    // ── Scrollbar ─────────────────────────────────────────────────────────────
    "--quantum-scrollbar-thumb":       "rgba(147, 112, 255, 0.22)",
    "--quantum-scrollbar-thumb-hover": "rgba(147, 112, 255, 0.48)",

    // ── Sidebar positioning ───────────────────────────────────────────────────
    "--quantum-sidebar-toggle-offset": "-13px",
    "--quantum-sidebar-border-inset":  "12%",

    // ── Glass / Frosted effect ────────────────────────────────────────────────
    "--quantum-glass-blur":     "16px",
    "--quantum-glass-bg-light": "rgba(253, 251, 255, 0.85)",
    "--quantum-glass-bg-dark":  "rgba(11, 7, 26, 0.85)",
  },

  light: {
    // ── Dark-variant overrides ───────────────────────────────────────────────
    "--mantine-color-dark-light-color": "#4e5359",
    "--mantine-color-dark-light-hover": "var(--mantine-color-gray-light-hover)",

    // ── Light-mode background surfaces ──────────────────────────────────────
    "--quantum-surface-1":  "#faf8ff",   // input pill, card bg
    "--quantum-surface-2":  "#f3eeff",   // subtle chip / badge bg
    "--quantum-text-body":  "rgba(30, 10, 60, 0.82)",
    "--quantum-text-muted": "rgba(109, 40, 217, 0.45)",

    // ── Focus ring ───────────────────────────────────────────────────────────
    "--mantine-color-violet-outline":  "rgba(124, 58, 237, 0.45)",
  },

  dark: {
    // ── Dark-variant overrides ───────────────────────────────────────────────
    "--mantine-color-dark-light-color": "var(--mantine-color-gray-4)",
    "--mantine-color-dark-light-hover": "var(--mantine-color-default-hover)",

    // ── Dark-mode background surfaces — the key upgrade ─────────────────────
    // Replaces the neutral black with violet-tinted darks (#0f0b1f family)
    "--quantum-surface-1":  "#0f0b1f",   // primary card / input backgrounds
    "--quantum-surface-2":  "rgba(15, 11, 31, 0.85)", // frosted glass variant
    "--quantum-surface-3":  "#110a2e",   // deeper panels / sidebars
    "--quantum-text-body":  "rgba(220, 210, 255, 0.82)",
    "--quantum-text-muted": "rgba(196, 176, 255, 0.35)",

    // ── Dark-mode body background ────────────────────────────────────────────
    // Set this on <html> or <body> via a global style:
    //   body { background: var(--quantum-bg); }
    "--quantum-bg":         "#0d0720",

    // ── Focus ring ───────────────────────────────────────────────────────────
    "--mantine-color-violet-outline":  "rgba(167, 139, 250, 0.5)",
  },
});