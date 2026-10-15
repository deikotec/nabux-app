---
name: Retail & Inventory POS System
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#825100'
  on-tertiary: '#ffffff'
  tertiary-container: '#a36700'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
  data-mono:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

The design system establishes a high-velocity, reliable, and ergonomically balanced environment tailored for local retail operators, inventory clerks, and store managers. The brand voice balances operational rigor with immediate clarity: it prioritizes speed of input, error prevention, and cognitive comfort under prolonged counter use and rapid-fire barcode scanning.

The aesthetic fuses **Corporate / Modern SaaS** precision with pragmatic POS operational patterns:
- **Clean surfaces & restrained contrast**: Background canvas layers remain soft and low-glare to diminish ocular fatigue during 8-hour cashier shifts.
- **High-legibility data hierarchy**: Critical inventory indicators (stock health, unit prices, SKU identifiers) are instantly recognizable at peripheral glances.
- **Micro-utility feedback**: Tactile interactive responses, explicit focus indicators, and deterministic state transitions provide confidence during peak transaction hours.

## Colors

The palette delivers immediate operational semantics through clear functional role mapping:

- **Primary (`#059669` / `#10b981`)**: Dedicated to positive cash flow, finalized transactions, confirmed order states, active stock health, and primary execution paths.
- **Secondary (`#2563eb` / `#0ea5e9`)**: Drives utility navigation, analytical highlights, barcode lookup actions, and system batch controls.
- **Tertiary (`#f59e0b`)**: Signals warning conditions, specifically low-stock reorder thresholds and pending synchronization flags.
- **Destructive / Error (`#ef4444`)**: Reserved strictly for depleted stock (out-of-stock), damaged items/shrinkage, voided tickets, and failed payment terminals.
- **Neutrals (`#0f172a`, `#334155`, `#64748b`, `#e2e8f0`, `#f8fafc`)**: Slate tones ensure cold, high-contrast readability against crisp white surfaces.

Canvas backgrounds use `#f8fafc`, panel cards use `#ffffff`, and perimeter delineation relies on calibrated borders (`#e2e8f0`).

## Typography

The type hierarchy uses **Plus Jakarta Sans** across all roles to maintain a contemporary, legible, and balanced posture. 

### Tabular Numerical Presentation
All monetary balances, SKU identifiers, barcode labels, and quantity tables must enforce OpenType tabular figures (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum"`). This prevents jitter and column drift during real-time balance calculations, unit updates, and cart tallies.

### Hierarchy & Responsive Behavior
- **Displays & Headlines**: Used for sales summaries, register totals, and main view anchors. Large screen targets (`display-lg`, `headline-lg`) step down gracefully on tablet and mobile POS modes via `-mobile` specifications.
- **Body & Data**: Defaults to `body-md` (14px) for descriptions and system labels, keeping row density compact without sacrificing readability.
- **Labels & SKU Badges**: `label-sm` utilizes uppercase styling with increased letter tracking to cleanly differentiate secondary metadata (e.g., categories, tax rates, shelf slots).

## Layout & Spacing

The layout model is optimized for high-density, split-screen POS registers and deep inventory tables.

### Grid & Canvas Structure
- **Desktop (1024px+)**: 12-column responsive fluid grid with `1.5rem` gutters and `2rem` outer canvas padding. Standard POS split: 7-column primary workspace (catalog grid, inventory logs) and 5-column sticky transactional utility pane (current ticket, checkout summary).
- **Tablet (768px - 1023px)**: 8-column layout with `1rem` gutters. The cart collapses into a persistent bottom sheet or slide-over drawer triggered by an ongoing total chip.
- **Mobile Handheld (320px - 767px)**: 4-column flow with `1rem` margins. Prioritizes barcode scan input, stock verification sweeps, and full-screen modal payment confirmation.

### Spacing Density Principles
- Compact spacing tokens (`space-xs` = 4px, `space-sm` = 8px) handle table cell heights, badge paddings, and button clusters.
- `space-md` (12px) and `space-lg` (20px) define interior card margins and section splits.
- Elements maintain predictable vertical baselines using the 4px micro-grid.

## Elevation & Depth

Visual separation relies on **low-contrast outlines** paired with **subtle ambient shadows**, avoiding dark or heavy drop shadows that clutter dense data views:

- **Level 0 (Flat / Canvas)**: Background at `#f8fafc`. Table rows, embedded form areas, and secondary panels rest at this level.
- **Level 1 (Card / Resting Surface)**: Pure white background (`#ffffff`), surrounded by a 1px border (`#e2e8f0`) and an ambient shadow: `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)`. Used for KPI metric cards, data grids, and register panels.
- **Level 2 (Hover / Interactive Lift)**: Border shifts to `#cbd5e1` with `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`. Applied to active ticket rows, clickable product cards, and hovering quick-action buttons.
- **Level 3 (Floating Overlays / Modals / Drawers)**: 1px border (`#e2e8f0`) with deep diffusion: `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`. Applied to payment dialogs, drawer menus, and SKU detail modals.

## Shapes

The design system employs a **Rounded** shape model (`level 2`), setting standard components to `0.5rem` (8px). This softens the visual density of complex data layouts while retaining structured alignment.

### Radius Hierarchy
- **Micro Radii (`0.25rem` / 4px)**: Status dot indicators, inline code/SKU tokens, and mini increment/decrement steppers.
- **Base Components (`0.5rem` / 8px)**: Inputs, text areas, standard buttons, badge containers, dropdown menus, and table selection highlights.
- **Containers & Surfaces (`1rem` / 16px)**: Primary inventory cards, KPI metric blocks, register split-view panes, and slide-in trays.
- **Special Elements (`9999px` / Full Pill)**: Quick-filter chip tags, operational status badges (Optimo, Critico, Agotado), and floating transaction action buttons.

## Components

### Buttons & Quick Actions
- **Primary Action (Cobrar / Guardar)**: Background `#059669`, text `#ffffff`, hover `#047857`, active `#065f46`. Fixed height 40px (desktop) or 48px (touch registers) for touch target accessibility.
- **Secondary Action (Consultar / Filtros)**: Background `#ffffff`, border 1px solid `#e2e8f0`, text `#334155`. Hover background `#f1f5f9`.
- **Destructive Action (Anular / Merma)**: Background `#fee2e2`, text `#b91c1c`, border 1px solid `#fca5a5`. Hover background `#fecaca`.
- **Keyboard Shortcut Affordances**: Buttons in POS mode display right-aligned mono badges indicating function keys (e.g., `[F2]`, `[Enter]`).

### Status Badges (Stock Health)
Badges follow a pill shape (`rounded-full`), `label-sm` weight, and structured semantic color pairs:
- **Óptimo**: Background `#ecfdf5`, text `#065f46`, border 1px solid `#a7f3d0`. Includes a 6px solid emerald dot.
- **Crítico / Bajo Stock**: Background `#fffbeb`, text `#92400e`, border 1px solid `#fde68a`. Includes a 6px solid amber dot.
- **Agotado**: Background `#fef2f2`, text `#991b1b`, border 1px solid `#fecaca`. Includes a 6px solid red dot.

### Data Tables & High-Density Lists
- **Header Row**: Background `#f8fafc`, 1px bottom border `#e2e8f0`, text in uppercase `label-sm` slate (`#64748b`). Height 36px.
- **Body Rows**: Height 44px (compact inventory) or 56px (POS touch row). Zebra striping omitted in favor of a 1px border `#f1f5f9` and hover state `#f8fafc`.
- **Numeric Alignment**: Quantities, unit costs, discounts, and line totals align strictly to the right with tabular numbers enabled.

### KPI Metric Cards
- White background (`#ffffff`), 1px border (`#e2e8f0`), 16px padding.
- Metric headline in `headline-lg` (`#0f172a`), accompanied by a sub-label in `label-md` (`#64748b`).
- **Percentage delta chips**: Green (`#ecfdf5` / `#047857`) for positive margin/turnover gains, red (`#fef2f2` / `#b91c1c`) for negative deviations or shrink increases.

### Form Inputs & Barcode Fields
- Height 40px, background `#ffffff`, border 1px solid `#cbd5e1`, text `#0f172a`, placeholder `#94a3b8`.
- Focus ring: 2px solid `#059669` with an offset of 1px.
- Barcode lookup field features a persistent prefix icon and visual indicator signifying ready listener state for USB/Bluetooth hardware scanners.