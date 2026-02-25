# Sidebar CSS Architecture Documentation

## File Hierarchy & Inheritance Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CSS INHERITANCE CHAIN                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   theme.ts (ROOT)                                                           │
│   └── Defines all CSS variables (--quantum-*, --mantine-*)                  │
│         ↓                                                                   │
│   app-shell.module.css (LAYOUT)                                             │
│   └── Base surface backgrounds for .navbar, .header, .aside                 │
│         ↓                                                                   │
│   space-sidebar.module.css (SIDEBAR MAIN)                                   │
│   └── Structure, sections, menu items, toggle button                        │
│         ↓                                                                   │
│   ├── tree.module.css (PAGE TREE)                                           │
│   │   └── Nested inside .sectionPages                                       │
│   │                                                                         │
│   └── sidebar-bottom-nav.module.css (FOOTER)                                │
│       └── Glass effect container, user avatar, workspace pill               │
│                                                                             │
│   Related Components:                                                       │
│   ├── notification-popover.module.css                                       │
│   └── custom-avatar.module.css                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. theme.ts — Design Token Source

**Location**: `apps/client/src/theme.ts`

**Purpose**: Root configuration file that defines all design tokens (CSS variables) used throughout the application.

### CSS Variables Output

| Variable | Value | Usage |
|----------|-------|-------|
| `--quantum-violet-core` | `#7c3aed` | Primary violet color |
| `--quantum-violet-bright` | `#9370ff` | Active/hover states |
| `--quantum-violet-light` | `#a78bfa` | Text/icon accents |
| `--quantum-violet-pale` | `#c4b5fd` | Light fills/gradients |
| `--quantum-violet-ghost` | `rgba(147, 112, 255, 0.12)` | Surface tints |
| `--quantum-violet-border` | `rgba(147, 112, 255, 0.22)` | Borders |
| `--quantum-violet-glow-sm` | `0 0 12px rgba(109, 40, 217, 0.4)` | Small glow |
| `--quantum-violet-glow-md` | `0 0 24px rgba(109, 40, 217, 0.55)` | Medium glow |
| `--quantum-orbit-primary` | `rgba(167, 139, 250, 0.65)` | Orbital ring color |
| `--quantum-dur-shimmer` | `3.5s` | Shimmer animation duration |
| `--quantum-dur-orbit-slow` | `3.5s` | Orbit animation duration |
| `--quantum-scrollbar-thumb` | `rgba(147, 112, 255, 0.22)` | Scrollbar color |
| `--quantum-glass-blur` | `16px` | Glass blur amount |

### Light/Dark Mode Variables

| Variable | Light Mode | Dark Mode |
|----------|------------|-----------|
| `--quantum-surface-1` | `#faf8ff` | `#0f0b1f` |
| `--quantum-surface-2` | `#f3eeff` | `rgba(15, 11, 31, 0.85)` |
| `--quantum-text-body` | `rgba(30, 10, 60, 0.82)` | `rgba(220, 210, 255, 0.82)` |
| `--quantum-bg` | — | `#0d0720` |

---

## 2. app-shell.module.css — Layout Foundation

**Location**: `apps/client/src/components/layouts/global/app-shell.module.css`

**Purpose**: Defines base surface backgrounds for layout containers (header, navbar, aside).

### Classes

| Class | Effect | Visual Result |
|-------|--------|---------------|
| `.header`, `.navbar`, `.aside` | Base background | Light: `rgba(248, 245, 255, 0.97)` / Dark: `rgba(11, 7, 26, 0.98)` |
| `.resizeHandle` | Draggable resize bar between panels | 3px width, violet gradient, expands to 5px on hover with glow |

### Inheritance Flow
```
app-shell.module.css
    └── .navbar background is OVERRIDDEN by space-sidebar.module.css .navbar
```

---

## 3. space-sidebar.module.css — Main Sidebar Styles

**Location**: `apps/client/src/features/space/components/sidebar/space-sidebar.module.css`

**Purpose**: Core sidebar styling including structure, sections, menu items, brand, and toggle button.

### Structure Classes

| Class | Purpose | Key Properties |
|-------|---------|----------------|
| `.navbar` | Main container | `height: 100%`, `padding: var(--mantine-spacing-md)`, violet-tinted background, right-edge shimmer border via `::after` |
| `.section` | Content sections | Negative margins for full-width dividers, gradient border on bottom |
| `.sectionPages` | Pages tree section | `overflow-y: hidden`, `flex: 1` |
| `.menuItems` | Menu items wrapper | Horizontal padding adjustments |

### Brand Classes

| Class | Purpose | Visual Effect |
|-------|---------|---------------|
| `.brand` | Logo container | Flex row, hover background |
| `.brandMark` | Logo icon (24x24) | Radial gradient purple, inset highlight, outer glow |
| `.brandName` | "OpenMemo" text | Shimmer gradient text animation (`brandShimmer` 5s) |

### Menu Item Classes

| Class | Purpose | Key Styles |
|-------|---------|------------|
| `.menu` | Menu item row | `padding: 6px 8px`, `border-radius: 6px`, violet ghost hover |
| `.menuItemInner` | Content wrapper | Flex container with `flex: 1` |
| `.menuItemIcon` | Left icon | `margin-right: 10px`, violet-tinted color |
| `.menuItemShortcut` | Right shortcut badge | `Ctrl + K` pill style |

### Active State Classes

| Class | Effect | Visual |
|-------|--------|--------|
| `.activeButton` | Active menu item | Violet background tint, left accent bar (2px), inner glow |
| `.activeButton .menuItemInner` | Active text | Shimmer gradient animation (`nodeShimmer` 3.5s) |
| `.activeButton .menuItemIcon` | Active icon | Solid violet color |

### Pages Section Classes

| Class | Purpose | Styles |
|-------|---------|--------|
| `.pagesHeader` | "PAGES" label | Uppercase, small font, violet-muted color |
| `.pageLink` | Page link item | Similar to `.menu` but smaller |

### Toggle Button Classes

| Class | Purpose | Visual Effect |
|-------|---------|---------------|
| `.sidebarToggle` | Button container | Absolute positioned, right: -13px, center vertical |
| `.sidebarToggleIcon` | Circular button | 26px, radial gradient purple, gloss sheen via `::after` |
| `.sidebarToggleRing` | Orbit animation | Rotating border ring (`toggleOrbit` 3.5s) |
| `.sidebarToggleCollapsed` | Collapsed state | Pulsing glow animation (`collapsedPulse` 2.4s) |

### Scrollbar Styles
```css
.navbar ::-webkit-scrollbar       { width: 3px; }
.navbar ::-webkit-scrollbar-thumb { background: var(--quantum-scrollbar-thumb); }
```

### Animations Defined

| Animation | Duration | Used By |
|-----------|----------|---------|
| `brandShimmer` | 5s | `.brandName` |
| `nodeShimmer` | 3.5s | `.activeButton .menuItemInner` |
| `toggleOrbit` | 3.5s | `.sidebarToggleRing` |
| `collapsedPulse` | 2.4s | `.sidebarToggleCollapsed .sidebarToggleIcon` |

---

## 4. sidebar-bottom-nav.module.css — Footer Section

**Location**: `apps/client/src/features/space/components/sidebar/sidebar-bottom-nav.module.css`

**Purpose**: Glass-effect footer with user avatar and workspace switcher.

### Container Classes

| Class | Purpose | Key Properties |
|-------|---------|----------------|
| `.bottomNav` | Main container | Flex row, `gap: 10px`, frosted glass background (`backdrop-filter: blur(16px)`), luminous top divider via `::before` |

**Glass Effect Implementation**:
```css
background: light-dark(
  linear-gradient(180deg, rgba(253, 251, 255, 0.75), rgba(250, 248, 255, 0.92)),
  linear-gradient(180deg, rgba(15, 11, 31, 0.75), rgba(11, 7, 26, 0.92))
);
backdrop-filter: blur(16px) saturate(1.2);
```

### User Avatar Classes

| Class | Purpose | Styles |
|-------|---------|--------|
| `.userAvatarWrapper` | Avatar container | Hover glow, active scale(0.95) |

### Workspace Pill Classes

| Class | Purpose | Styles |
|-------|---------|--------|
| `.workspaceSection` | Pill container | `flex: 1`, `min-width: 0` |
| `.workspacePill` | Button pill | Gradient background, border, inset highlight, hover intensify |
| `.workspaceName` | Workspace name text | 12px, semi-bold, ellipsis overflow |
| `.workspaceChevron` | Dropdown chevron | Transition for transform on hover |

### Menu Dropdown Classes

| Class | Purpose | Styles |
|-------|---------|--------|
| `.menu` | Dropdown container | Glass background, blur, entrance animation (`menuEnter`) |
| `.menuLabel` | Section labels | Uppercase, small, violet-muted |
| `.menuItem` | Menu item | Hover violet ghost |
| `.themeItem` | Theme submenu item | Same as `.menuItem` |
| `.checkIcon` | Selected checkmark | Pop animation (`checkPop`) |

### Animations Defined

| Animation | Duration | Used By |
|-----------|----------|---------|
| `menuEnter` | 0.2s | `.menu` (scale + fade from bottom) |
| `checkPop` | 0.2s | `.checkIcon` |

### Unused Classes (Dead Code)
- `.notificationWrapper` — Notification moved to menuItems

---

## 5. tree.module.css — Page Tree Component

**Location**: `apps/client/src/features/page/tree/styles/tree.module.css`

**Purpose**: Styles for the hierarchical page tree inside the sidebar.

### Key Classes

| Class | Purpose | Visual Effect |
|-------|---------|---------------|
| `.treeContainer` | Tree wrapper | Full height, custom scrollbar |
| `.node` | Page node item | Hover violet ghost, selected state with shimmer |
| `.node:global(.isSelected)` | Selected page | Left accent bar (2px), shimmer text (`nodeShimmer`) |
| `.node:global(.willReceiveDrop)` | Drop target | Dashed border, pulse animation (`dropPulse`) |
| `.icon` | Page icon | Violet-tinted, brightens on hover/select |
| `.arrow` | Expand/collapse | Rotation animation with spring easing |
| `.actions` | Hover actions | Fade in from right |

### Shared Pattern with space-sidebar.module.css
The `.node:global(.isSelected)` styling is **copied** to `.activeButton` in space-sidebar.module.css for consistency.

---

## 6. notification-popover.module.css — Notification Component

**Location**: `apps/client/src/features/notification/components/notification-popover.module.css`

**Purpose**: Styles for notification button and popover when placed in menuItems.

### Key Classes

| Class | Purpose | Visual Effect |
|-------|---------|---------------|
| `.menuButton` | Menu-style button | Same styling as sidebar `.menu` |
| `.actionIcon` | Icon button | 32x32, hover violet ghost |
| `.notifWrapper` | Icon wrapper | Position relative for ring |
| `.notifRing` | Orbital ring | Appears when unread, `notifOrbit` animation |
| `.notifDot` | Unread dot | 6px, pulse animation (`dotPulse`) |
| `.unreadDot` | Inline dot | In menu item row |

### Animations

| Animation | Duration | Effect |
|-----------|----------|--------|
| `notifOrbit` | 2.4s | 360° rotation |
| `dotPulse` | 2s | Scale + glow pulse |

---

## 7. custom-avatar.module.css — Avatar Component

**Location**: `apps/client/src/components/ui/custom-avatar.module.css`

**Purpose**: Reusable avatar with optional orbital ring hover effect.

### Classes

| Class | Purpose | Visual Effect |
|-------|---------|---------------|
| `.avatarWrapper` | Container | Position relative |
| `.avatarRing` | Orbital ring | Hidden by default, appears on hover with `avatarOrbit` animation |

### Usage Pattern
```tsx
<div className={classes.avatarWrapper}>
  <CustomAvatar ... />
  <div className={classes.avatarRing} />  {/* Optional ring */}
</div>
```

---

## Visual Hierarchy Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ .navbar (space-sidebar.module.css)                              │
│ ├── Violet-tinted background                                    │
│ ├── Right-edge shimmer border (::after)                         │
│ └── Custom scrollbar                                            │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ .section                                                 │   │
│   │ ├── .menuItems                                           │   │
│   │ │   ├── .brand (OpenMemo)                                │   │
│   │ │   │   └── .brandMark + .brandName (shimmer)            │   │
│   │ │   ├── .menu (Overview, Search, Intelligence)            │   │
│   │ │   │   └── .menuItemIcon + .menuItemInner               │   │
│   │ │   └── .menuButton (Notifications) [from popover CSS]   │   │
│   │ │       └── .notifRing + .notifDot (animations)          │   │
│   │ └── Bottom gradient divider                               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ .sectionPages                                            │   │
│   │ ├── .pagesHeader ("PAGES")                               │   │
│   │ └── .treeContainer                                      │   │
│   │     └── .node items (tree.module.css)                    │   │
│   │         └── .isSelected → shimmer text                    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ═══════════════════════════════════════════════════════════    │
│   │ .bottomNav (sidebar-bottom-nav.module.css)                │   │
│   │ ├── Frosted glass background                              │   │
│   │ ├── Luminous top divider (::before)                       │   │
│   │ ├── .userAvatarWrapper                                   │   │
│   │ │   └── CustomAvatar + hover glow                        │   │
│   │ └── .workspaceSection                                   │   │
│   │     └── .workspacePill (gradient, border, hover)         │   │
│   │         └── .workspaceName + .workspaceChevron           │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   .sidebarToggle (absolute, right: -13px)                       │
│   └── .sidebarToggleIcon + .sidebarToggleRing                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Animation Catalog

| Animation Name | Duration | File | Used By |
|----------------|----------|------|---------|
| `brandShimmer` | 5s | space-sidebar | `.brandName` |
| `nodeShimmer` | 3.5s | space-sidebar, tree | `.activeButton`, `.node.isSelected` |
| `toggleOrbit` | 3.5s | space-sidebar | `.sidebarToggleRing` |
| `collapsedPulse` | 2.4s | space-sidebar | `.sidebarToggleCollapsed .sidebarToggleIcon` |
| `menuEnter` | 0.2s | sidebar-bottom-nav | `.menu` dropdown |
| `checkPop` | 0.2s | sidebar-bottom-nav | `.checkIcon` |
| `notifOrbit` | 2.4s | notification-popover | `.notifRing` |
| `dotPulse` | 2s | notification-popover | `.notifDot` |
| `dropPulse` | 1.2s | tree | `.node.willReceiveDrop` |
| `avatarOrbit` | 2.4s | custom-avatar | `.avatarRing` |

---

## Color Palette Reference

### Violet Gradient Stops
```
#3b0764 (darkest) → #4c1d95 → #5b21b6 → #6d28d9 → #7c3aed (PRIMARY) → #9370ff → #a78bfa → #c4b5fd → #d3bfff → #e8deff → #f3eeff (lightest)
```

### Opacity Scale for Backgrounds
```
rgba(147, 112, 255, 0.03)  — subtle inner glow
rgba(147, 112, 255, 0.07)  — hover ghost (light mode)
rgba(147, 112, 255, 0.09)  — hover ghost (dark mode)
rgba(147, 112, 255, 0.11)  — active background (light)
rgba(109, 40, 217, 0.18)   — active background (dark)
rgba(147, 112, 255, 0.15)  — borders
rgba(147, 112, 255, 0.22)  — border accent
rgba(147, 112, 255, 0.5)   — divider center
```

---

## Reduced Motion Support

All CSS files include `@media (prefers-reduced-motion: reduce)` blocks that:
1. Disable all animations (`animation: none`)
2. Minimize transition durations (`transition-duration: 0.01ms`)

---

## Current Layout Structure

```
┌─────────────────────────────────────────┐
│ Sidebar menuItems                       │
│ ┌─────────────────────────────────────┐ │
│ │ 📄 OpenMemo                          │ │
│ ├─────────────────────────────────────┤ │
│ │ 🏠 Overview                         │ │
│ │ 🔍 Search            Ctrl + K       │ │
│ │ ✨ Intelligence                     │ │
│ │ 🔔 Notifications                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Pages                     [+][⋮]   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ═══════════════════════════════════════ │
│ [User] [Workspace ▼]                   │
└─────────────────────────────────────────┘
```

---

## Files Summary

| File | Location | Purpose |
|------|----------|---------|
| `theme.ts` | `apps/client/src/theme.ts` | Design tokens & CSS variables |
| `app-shell.module.css` | `apps/client/src/components/layouts/global/` | Layout foundation |
| `space-sidebar.module.css` | `apps/client/src/features/space/components/sidebar/` | Main sidebar |
| `sidebar-bottom-nav.module.css` | `apps/client/src/features/space/components/sidebar/` | Bottom nav footer |
| `tree.module.css` | `apps/client/src/features/page/tree/styles/` | Page tree |
| `notification-popover.module.css` | `apps/client/src/features/notification/components/` | Notifications |
| `custom-avatar.module.css` | `apps/client/src/components/ui/` | Avatar component |
