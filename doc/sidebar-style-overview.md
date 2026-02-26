
# Docmost Sidebar Style Overview

This document provides a structured overview of the sidebar styling in Docmost, including layout, theme variables, Mantine usage, and customization guidelines.

---

## 1. Sidebar CSS File Hierarchy

The sidebar's style is composed from several CSS and theme files, forming a clear inheritance chain:

```
theme.ts (ROOT)
  └── app-shell.module.css (LAYOUT)
    └── space-sidebar.module.css (SIDEBAR MAIN)
      ├── tree.module.css (PAGE TREE)
      └── sidebar-bottom-nav.module.css (FOOTER)
      ├── notification-popover.module.css
      └── custom-avatar.module.css
```

---


## 2. Theme Variables & Design Tokens

**File:** `apps/client/src/theme.ts`

Defines all CSS variables used throughout the sidebar and app. Includes color palette, animation durations, and surface backgrounds. Supports light/dark mode.

**Key Variables:**
- Violet color stops for backgrounds, borders, and glows
- Animation durations for shimmer, orbit, pulse
- Scrollbar and glass effect variables

**Light/Dark Mode:**
- Surface backgrounds and text colors adapt via CSS variables

---

---


## 3. Layout Foundation

**File:** `apps/client/src/components/layouts/global/app-shell.module.css`

Sets base backgrounds for header, navbar, aside. Provides layout containers and resize handles. `.navbar` background is overridden by sidebar-specific styles.

---

---


## 4. Main Sidebar Styles

**File:** `apps/client/src/features/space/components/sidebar/space-sidebar.module.css`

Defines the sidebar container, sections, menu items, brand, toggle button, and scrollbars. Uses violet-tinted backgrounds, shimmer borders, and Mantine spacing.

**Key Classes:**
- `.navbar`: Main container, full height, violet background
- `.section`: Content sections, gradient dividers
- `.menuItems`: Menu wrapper, horizontal padding
- `.brand`, `.brandMark`, `.brandName`: Logo and shimmer text
- `.menu`, `.menuItemInner`, `.menuItemIcon`, `.menuItemShortcut`: Menu rows, icons, shortcuts
- `.activeButton`: Active menu item, accent bar, shimmer
- `.pagesHeader`, `.pageLink`: Pages section
- `.sidebarToggle`, `.sidebarToggleIcon`, `.sidebarToggleRing`, `.sidebarToggleCollapsed`: Toggle button and animations
- Custom scrollbars and animation classes

---

---


## 5. Footer Section Styles

**File:** `apps/client/src/features/space/components/sidebar/sidebar-bottom-nav.module.css`

Glass-effect footer with user avatar and workspace switcher. Uses frosted glass backgrounds, luminous dividers, and pill-style workspace buttons.

**Key Classes:**
- `.bottomNav`: Main container, glass effect
- `.userAvatarWrapper`: Avatar hover glow
- `.workspaceSection`, `.workspacePill`, `.workspaceName`, `.workspaceChevron`: Workspace pill and dropdown
- `.menu`, `.menuLabel`, `.menuItem`, `.themeItem`, `.checkIcon`: Dropdown menu and theme selection
- Animations: `menuEnter`, `checkPop`

---

---


## 6. Page Tree Component Styles

**File:** `apps/client/src/features/page/tree/styles/tree.module.css`

Styles for the hierarchical page tree inside the sidebar. Shared shimmer and accent patterns with sidebar menu.

**Key Classes:**
- `.treeContainer`: Tree wrapper, custom scrollbar
- `.node`: Page node, hover ghost, selected shimmer
- `.node.isSelected`: Selected page, accent bar, shimmer
- `.node.willReceiveDrop`: Drop target, pulse animation
- `.icon`, `.arrow`, `.actions`: Icons, expand/collapse, hover actions

---

---


## 7. Notification Component Styles

**File:** `apps/client/src/features/notification/components/notification-popover.module.css`

Styles for notification button and popover in sidebar menu. Includes orbital ring and pulse dot animations.

**Key Classes:**
- `.menuButton`: Menu-style button
- `.actionIcon`: Icon button, violet ghost
- `.notifWrapper`, `.notifRing`, `.notifDot`, `.unreadDot`: Notification ring and dot
- Animations: `notifOrbit`, `dotPulse`

---

---


## 8. Avatar Component Styles

**File:** `apps/client/src/components/ui/custom-avatar.module.css`

Reusable avatar with optional orbital ring hover effect. Used in sidebar footer and elsewhere.

**Key Classes:**
- `.avatarWrapper`: Container
- `.avatarRing`: Orbital ring, hover animation

---

---


## Visual Hierarchy Summary

```
.navbar (space-sidebar.module.css)
  ├── Violet-tinted background
  ├── Right-edge shimmer border (::after)
  └── Custom scrollbar
    ├── .section
    │   ├── .menuItems
    │   │   ├── .brand (OpenMemo)
    │   │   │   └── .brandMark + .brandName (shimmer)
    │   │   ├── .menu (Overview, Search, Intelligence)
    │   │   │   └── .menuItemIcon + .menuItemInner
    │   │   └── .menuButton (Notifications)
    │   │       └── .notifRing + .notifDot (animations)
    │   └── Bottom gradient divider
    ├── .sectionPages
    │   ├── .pagesHeader ("PAGES")
    │   └── .treeContainer
    │       └── .node items (tree.module.css)
    │           └── .isSelected → shimmer text
    ├── .bottomNav (sidebar-bottom-nav.module.css)
    │   ├── Frosted glass background
    │   ├── Luminous top divider (::before)
    │   ├── .userAvatarWrapper
    │   │   └── CustomAvatar + hover glow
    │   └── .workspaceSection
    │       └── .workspacePill (gradient, border, hover)
    │           └── .workspaceName + .workspaceChevron
    └── .sidebarToggle (absolute, right: -13px)
        └── .sidebarToggleIcon + .sidebarToggleRing
```

---

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

---

rgba(109, 40, 217, 0.18)   — active background (dark)
rgba(147, 112, 255, 0.15)  — borders

## Color Palette Reference

**Violet Gradient Stops:**
#3b0764 → #4c1d95 → #5b21b6 → #6d28d9 → #7c3aed (PRIMARY) → #9370ff → #a78bfa → #c4b5fd → #d3bfff → #e8deff → #f3eeff

**Opacity Scale:**
rgba(147, 112, 255, 0.03) — subtle inner glow
rgba(147, 112, 255, 0.07) — hover ghost (light mode)
rgba(147, 112, 255, 0.09) — hover ghost (dark mode)
rgba(147, 112, 255, 0.11) — active background (light)
rgba(109, 40, 217, 0.18) — active background (dark)
rgba(147, 112, 255, 0.15) — borders
rgba(147, 112, 255, 0.22) — border accent
rgba(147, 112, 255, 0.5) — divider center

---

---


## Reduced Motion Support

All sidebar CSS files include `@media (prefers-reduced-motion: reduce)` blocks to:
1. Disable all animations (`animation: none`)
2. Minimize transition durations (`transition-duration: 0.01ms`)

---

---


## Example Layout Structure

```
Sidebar menuItems
  ├── 📄 OpenMemo
  ├── 🏠 Overview
  ├── 🔍 Search            Ctrl + K
  ├── ✨ Intelligence
  ├── 🔔 Notifications
Pages section [+][⋮]
Bottom nav: [User] [Workspace ▼]
```

---

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

---

**Summary:**
The Docmost sidebar leverages Mantine UI and custom CSS modules for flexible, theme-driven styling. For advanced customization, update theme variables and use CSS modules as needed. Refer to Mantine documentation and Docmost component source for implementation details.
