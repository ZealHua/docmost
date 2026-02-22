# Sidebar Theme Quick Reference

## 📁 Core Files

| File | Purpose | Path |
|------|---------|------|
| **Sidebar Component** | Overview menu + PAGES section JSX | `features/space/components/sidebar/space-sidebar.tsx` |
| **Sidebar Styles** | All CSS for sidebar navigation | `features/space/components/sidebar/space-sidebar.module.css` |
| **Tree Styles** | PAGES tree item styles | `features/page/tree/styles/tree.module.css` |

---

## 🎯 Two Main Areas

### 1️⃣ OVERVIEW Section (Top Navigation)

**What it is:** Main navigation menu (Overview, Search, Intelligence, Settings, New Page)

**Component location:** `space-sidebar.tsx` lines 95-157

**CSS classes in `space-sidebar.module.css`:**

| Class | Purpose | Lines |
|-------|---------|-------|
| `.section` | Section container with divider | 43-58 |
| `.menuItems` | Wrapper for menu items | 71-76 |
| `.menu` | Individual menu item row | 79-102 |
| `.menuItemInner` | Flex container for icon + text | 104-107 |
| `.menuItemIcon` | Icon styling | 109-117 |
| `.activeButton` | **Selected state** | 206-250 |

**Key CSS to modify:**

```css
/* Default menu item - space-sidebar.module.css:79 */
.menu {
  font-size: var(--mantine-font-size-sm);  /* 12.5px */
  color: light-dark(
    rgba(30, 10, 60, 0.65),      /* light mode */
    rgba(196, 176, 255, 0.52)    /* dark mode */
  );
}

/* Hover state - space-sidebar.module.css:95 */
.menu:hover {
  background: light-dark(
    rgba(147, 112, 255, 0.07),
    rgba(147, 112, 255, 0.09)
  );
  color: light-dark(
    rgba(109, 40, 217, 0.9),
    rgba(220, 210, 255, 0.82)
  );
}

/* Active/Selected state - space-sidebar.module.css:206 */
.activeButton {
  background: light-dark(
    rgba(147, 112, 255, 0.11),
    rgba(109, 40, 217, 0.18)
  );
  color: light-dark(           /* ⚠️ CRITICAL for dark mode visibility */
    rgba(109, 40, 217, 0.95),
    rgba(220, 210, 255, 0.9)
  );
  box-shadow: inset 2px 0 0 rgba(147, 112, 255, 0.65);
  /* + gradient shimmer effect */
}
```

---

### 2️⃣ PAGES Section (Page Tree)

**What it is:** Hierarchical tree view of all pages in the space

**Component location:** `space-sidebar.tsx` lines 178-207

**CSS classes:**

| Class | File | Lines |
|-------|------|-------|
| `.sectionPages` | `space-sidebar.module.css` | 62-68 |
| `.pagesHeader` | `space-sidebar.module.css` | 147-160 |
| `.pages` | `space-sidebar.module.css` | 141-145 |
| `.pageLink` | `space-sidebar.module.css` | 165-195 |
| `.node:global(.isSelected)` | `tree.module.css` | 122-145 |

**Key CSS to modify:**

```css
/* Section container - space-sidebar.module.css:62 */
.sectionPages {
  margin-bottom: 0;            /* No bottom margin */
  overflow-y: hidden;
}

/* Header label "PAGES" - space-sidebar.module.css:147 */
.pagesHeader {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: light-dark(
    rgba(147, 112, 255, 0.45),
    rgba(167, 139, 250, 0.3)
  );
}

/* Page link default - space-sidebar.module.css:165 */
.pageLink {
  font-size: var(--mantine-font-size-xs);  /* 11px */
  color: light-dark(
    rgba(30, 10, 60, 0.62),
    rgba(196, 176, 255, 0.48)
  );
}

/* Tree selected state - tree.module.css:122 */
.node:global(.isSelected) {
  background: light-dark(
    rgba(147, 112, 255, 0.11),
    rgba(109, 40, 217, 0.18)
  );
  color: light-dark(           /* ✅ High contrast solid color */
    rgba(109, 40, 217, 0.95),
    rgba(220, 210, 255, 0.9)
  );
  box-shadow: inset 2px 0 0 rgba(147, 112, 255, 0.7);
}
```

---

## 🔗 Parent CSS (Affects Sidebar)

### 1. Layout Shell
**File:** `components/layouts/global/app-shell.module.css`

```css
/* Sidebar background surface */
.navbar {
  background: light-dark(
    rgba(248, 245, 255, 0.97),   /* Light mode */
    rgba(11, 7, 26, 0.98)        /* Dark mode */
  );
}

/* Resize handle (right edge of sidebar) */
.resizeHandle {
  background: linear-gradient(
    180deg,
    transparent,
    rgba(147, 112, 255, 0.18) 20%,
    rgba(147, 112, 255, 0.18) 80%,
    transparent
  );
}
```

### 2. Header (Top Bar)
**File:** `components/layouts/global/app-header.module.css`

```css
/* Active link pattern (reference for .activeButton) */
.linkActive {
  background: light-dark(
    rgba(147, 112, 255, 0.11),
    rgba(109, 40, 217, 0.18)
  );
  color: transparent;
  background-image: light-dark(
    linear-gradient(90deg, #7c3aed 0%, #c4b5fd 45%, #a78bfa 60%, #7c3aed 100%),
    linear-gradient(90deg, #9370ff 0%, #e9d5ff 45%, #c4b5fd 60%, #9370ff 100%)
  );
}
```

### 3. Theme Configuration
**File:** `src/theme.ts`

```typescript
// Brand violet colors
const violet: MantineColorsTuple = [
  "#f3eeff", "#e8deff", "#d3bfff", "#b899ff", "#a07af9",
  "#9370ff", "#7c3aed", "#6d28d9", "#5b21b6", "#3b0764"
];

// CSS variables available globally
--quantum-violet-core:    #7c3aed
--quantum-violet-bright:  #9370ff
--quantum-violet-light:   #a78bfa
--quantum-surface-1:      #0f0b1f (dark mode)
--quantum-text-body:      rgba(220, 210, 255, 0.82) (dark mode)
```

---

## 🛠️ Quick Modification Guide

### ⚠️ Critical: Active State Pattern

Both sections now use the **same pattern** copied from `tree.module.css`:

**Overview menu** (`space-sidebar.module.css:206-255`):
```css
/* ✅ SIDEBAR MENU - Selected state */
.activeButton {
  border-radius: 6px;
  background: light-dark(
    rgba(147, 112, 255, 0.11),
    rgba(109, 40, 217, 0.18)
  );
  color: light-dark(
    rgba(109, 40, 217, 0.95),    /* ✅ Critical for dark mode */
    rgba(220, 210, 255, 0.9)
  );
  box-shadow:
    inset 2px 0 0 rgba(147, 112, 255, 0.7),
    inset 0 0 12px rgba(109, 40, 217, 0.06);
}

/* Shimmer on text element */
.activeButton .menuItemInner,
.activeButton .text {
  background: linear-gradient(90deg, #7c3aed 0%, #c4b5fd 45%, #a78bfa 60%, #7c3aed 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: nodeShimmer 3.5s linear infinite;
}

/* Icon color */
.activeButton .menuItemIcon {
  color: light-dark(#7c3aed, #a78bfa);
  -webkit-text-fill-color: initial;
}
```

**PAGES tree** (`tree.module.css:122-220`):
```css
/* ✅ PAGE TREE - Selected state */
.node:global(.isSelected) {
  border-radius: 0;
  background: light-dark(
    rgba(147, 112, 255, 0.11),
    rgba(109, 40, 217, 0.18)
  );
  color: light-dark(
    rgba(109, 40, 217, 0.95),    /* ✅ Critical for dark mode */
    rgba(220, 210, 255, 0.9)
  );
  box-shadow:
    inset 2px 0 0 rgba(147, 112, 255, 0.7),
    inset 0 0 12px rgba(109, 40, 217, 0.06);
}

/* Shimmer on .text element */
.node:global(.isSelected) .text {
  background: linear-gradient(90deg, #7c3aed 0%, #c4b5fd 45%, #a78bfa 60%, #7c3aed 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: nodeShimmer 3.5s linear infinite;
}

/* Icon color */
.node:global(.isSelected) .icon {
  color: light-dark(#7c3aed, #a78bfa);
}
```

### Change sidebar background

**File:** `space-sidebar.module.css:7`
```css
.navbar {
  background: light-dark(
    rgba(250, 248, 255, 0.96),   /* Change light mode */
    rgba(11, 7, 26, 0.97)        /* Change dark mode */
  );
}
```

### Change hover colors

**File:** `space-sidebar.module.css:95`
```css
.menu:hover {
  background: light-dark(
    rgba(147, 112, 255, 0.07),   /* Change light mode */
    rgba(147, 112, 255, 0.09)    /* Change dark mode */
  );
}
```

### Change section divider

**File:** `space-sidebar.module.css:48`
```css
.section:not(:last-of-type) {
  background-image: linear-gradient(
    90deg,
    transparent,
    rgba(147, 112, 255, 0.22) 25%,   /* Change color */
    rgba(147, 112, 255, 0.22) 75%,
    transparent
  );
}
```

---

## ⚠️ Critical Notes

1. **Both sections use the same pattern** - `.activeButton` copies `tree.module.css` exactly
2. **Explicit `color` property is critical** - ensures dark mode text visibility before gradient applies
3. **Shimmer targets text element** - `.menuItemInner`/`.text` gets the gradient, not the parent
4. **Icon colors are synchronized** - `light-dark(#7c3aed, #a78bfa)` for both sections
5. **`:global(.isSelected)`** - class applied by React tree component, not CSS
6. **Parent `app-shell.module.css`** - controls overall sidebar background surface
7. **`.sectionPages` has no bottom divider** - by design (`margin-bottom: 0`)

---

## 📊 Side-by-Side Comparison

| Property | OVERVIEW (`.activeButton`) | PAGES (`.node.isSelected`) |
|----------|---------------------------|---------------------------|
| **Source** | Copied from `tree.module.css` | Original pattern |
| **Background** | `rgba(109, 40, 217, 0.18)` dark | Same |
| **Text Color** | `rgba(220, 210, 255, 0.9)` ✅ | Same |
| **Text Effect** | Gradient shimmer on `.menuItemInner` | Gradient shimmer on `.text` |
| **Icon Color** | `light-dark(#7c3aed, #a78bfa)` | Same |
| **Left Bar** | 2px inset violet + glow | Same |
| **Border Radius** | 6px | 0 (or 6px if `.isSelectedStart.isSelectedEnd`) |
| **Hover State** | Intensified glow + outer ring | Same pattern |

---

## 🔍 File Structure

```
docmost/apps/client/src/
├── components/layouts/global/
│   ├── app-shell.module.css          ← Parent layout backgrounds
│   └── app-header.module.css         ← Header active state pattern
├── features/space/components/sidebar/
│   ├── space-sidebar.tsx             ← Overview + PAGES JSX
│   └── space-sidebar.module.css      ← Overview + PAGES styles
└── features/page/tree/styles/
    └── tree.module.css               ← PAGES tree selected state
```
