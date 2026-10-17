---
name: Court Guard Scheduler
description: Hebrew RTL scheduling system for court security staffing
colors:
  deep-navy: "#1e3a5f"
  deep-navy-foreground: "#ffffff"
  pale-slate: "#f1f5f9"
  pale-slate-foreground: "#334155"
  cool-paper: "#f7f8fa"
  ink: "#111827"
  surface-white: "#ffffff"
  surface-header: "#dee2e6"
  muted: "#f8fafc"
  muted-foreground: "#6b7280"
  court-gold-bg: "#fff4d6"
  court-gold-foreground: "#b77900"
  alert-red: "#dc2626"
  alert-red-foreground: "#ffffff"
  border: "#e5e7eb"
  input-border: "#d1d5db"
  ring: "#1e3a5f"
  chart-1: "#2563eb"
  chart-2: "#0d9488"
  chart-3: "#16a34a"
  chart-4: "#d99a00"
  chart-5: "#7c3aed"
  chart-6: "#e11d48"
  chart-7: "#64748b"
  chart-8: "#0891b2"
  chart-9: "#4f46e5"
  chart-10: "#475569"
typography:
  body:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Montserrat, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  4xl: "26px"
components:
  button-primary:
    backgroundColor: "{colors.deep-navy}"
    textColor: "{colors.deep-navy-foreground}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.deep-navy}"
  button-outline:
    backgroundColor: "{colors.cool-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  button-destructive:
    backgroundColor: "{colors.alert-red}"
    textColor: "{colors.alert-red-foreground}"
    rounded: "{rounded.md}"
  badge-default:
    backgroundColor: "{colors.deep-navy}"
    textColor: "{colors.deep-navy-foreground}"
    rounded: "{rounded.3xl}"
    padding: "2px 8px"
    height: "20px"
  card:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.4xl}"
  input-default:
    rounded: "{rounded.md}"
    height: "36px"
---

# Design System: Court Guard Scheduler

## Overview

**Creative North Star: "The Quiet Registry"**

[Inferred from the implemented tokens and components, not confirmed with the user as a deliberate creative brief — the North Star name and philosophy below are a description of what the code already does, not a new direction.]

This is an operate-mode internal tool, not a persuade-mode product: a deep navy anchors authority and officialdom (court, security, institution), a narrow gold accent is reserved for a single "court / gold identity" role (per the code's own comment on `--accent`), and everything else is quiet cool-gray paper and white surfaces. Containers are unusually soft — cards and dialogs round to a 26px (`rounded-4xl`) radius, almost pill-like at small sizes — while interactive controls (buttons, inputs) stay tight at 8px (`rounded-md`). That contrast is the system's one real visual signature: big soft containers holding small crisp controls.

The whole UI is Hebrew RTL-first, and that is load-bearing in the component code itself, not just a stylesheet flip: buttons use logical padding (`ps-`/`pe-` instead of `pl-`/`pr-`), and the dialog's centering math explicitly corrects for RTL (`rtl:translate-x-1/2`). Dark mode exists as a full parallel token set (navy primary flips to a light sky-blue `#7dd3fc`, gold accent flips to deep amber-on-amber) but nothing in the scanned surfaces indicates it's exposed to users yet.

**Key Characteristics:**
- Deep navy authority color, used sparingly and deliberately (primary buttons, badges, focus rings, sidebar accents).
- A single reserved gold accent — never a general-purpose color, only the "court/gold identity" role.
- Large, soft, almost-pill container radii (cards, dialogs) paired with tight, crisp control radii (buttons, inputs, badges land in between at pill-shaped `rounded-3xl`).
- Flat-leaning elevation: soft `shadow-md`/`shadow-xl` paired with a near-invisible 1px ring, never a hard drop shadow.
- RTL is structural, built with logical CSS properties, not an afterthought.

## Colors

The palette is restrained: one authority color, one reserved accent, and a cool neutral scale for everything else.

### Primary
- **Deep Navy** (`#1e3a5f`): the system's one brand/authority color. Used on primary buttons, default badges, focus rings, and the sidebar's active/primary state. Flips to a light sky-blue (`#7dd3fc`) in dark mode.

### Secondary
- **Pale Slate** (`#f1f5f9` bg / `#334155` text): secondary buttons and lower-emphasis surfaces.

### Tertiary
- **Court Gold** (`#fff4d6` bg / `#b77900` text): explicitly named in the source as the "court / gold identity" accent. Reserved — never used as a general accent, only where that specific identity marker belongs.

### Neutral
- **Cool Paper** (`#f7f8fa`): page background.
- **Ink** (`#111827`): primary foreground/text color.
- **Surface White** (`#ffffff`): card, popover, and sidebar surface background.
- **Surface Header** (`#dee2e6`): card header background, one step darker than the card body — gives headers a subtle banding without a hard border.
- **Muted Gray** (`#6b7280` text / `#f8fafc` bg): secondary text and muted surfaces.
- **Border Gray** (`#e5e7eb`): hairline borders and dividers.
- **Alert Red** (`#dc2626`): destructive actions and errors only.

### Named Rules
**The Reserved Accent Rule.** Court Gold is not a general-purpose accent color — it exists for one semantic role (the "court/gold identity" marker per the source comment). Don't reach for it to add visual interest elsewhere; that dilutes the one place it means something.

## Typography

**Body & Heading Font:** Montserrat (`var(--font-sans)`, loaded via `next/font/google`), with the system sans-serif fallback stack.

**Character:** A single geometric sans carries every role in the scanned surfaces — there is no separate display/serif pairing. Weight does the hierarchy work (`font-medium` for titles/labels, regular for body), not a second typeface.

### Hierarchy
- **Card/Section Title** (500, 1rem/16px, default line-height): `CardTitle` — the heaviest text weight observed; marks a card's identity.
- **Body** (400, 0.875rem/14px): default text size across inputs, buttons, and card content.
- **Label** (500, 0.75rem/12px): badges and small UI labels; slightly bolder than body at a smaller size.

No distinct display/headline scale was found in the scanned components — page-level heading hierarchy (h1/h2) is not yet customized beyond Tailwind defaults. Treat this as unresolved rather than inventing a scale.

## Layout

[Only what was directly observed; broader grid/breakpoint behavior was not scanned for this pass.] The app runs `dir="rtl"` at the `<html>` level (`lang="he"`), so all directional layout must be authored with logical properties (`ps-`/`pe-`, `inset-s-`) rather than physical `left`/`right`. Dialog content is centered and explicitly RTL-corrected (`-translate-x-1/2 rtl:translate-x-1/2`). No other layout asset outside the component tokens was inspected in this pass.

## Elevation & Depth

The system is mostly flat with soft lift on floating/overlaid surfaces rather than resting surfaces. Cards sit flat against the page (no shadow at rest beyond a `shadow-md` base), carried mainly by a near-invisible 1px ring (`ring-foreground/5`, `ring-foreground/10` in dark mode) instead of a visible border. Dialogs lift further with `shadow-xl` plus the same hairline ring, and a backdrop blur (`backdrop-blur-sm`) over a 30%-opacity black scrim separates the modal layer from the page.

### Shadow Vocabulary
- **Resting surface** (`shadow-md` + `ring-1 ring-foreground/5`): cards and default containers.
- **Overlay surface** (`shadow-xl` + `ring-1 ring-foreground/5`): dialogs and modals — the only surfaces that lift visibly off the page.

### Named Rules
**The Hairline-Over-Border Rule.** Containers get definition from a 1px ring at 5–10% opacity, not a visible border color. Don't add a solid `border` to a card/dialog where the ring already does the job.

## Shapes

Two distinct radius languages coexist by role, not by accident:

- **Containers** (cards, dialogs, alert dialogs): `rounded-4xl` (~26px) — soft, almost capsule-like at small sizes, with headers/footers rounding to match the container (`rounded-t-4xl` / `rounded-b-4xl`).
- **Controls** (buttons, inputs): `rounded-md` (8px) — tight and functional, deliberately far crisper than the containers that hold them.
- **Compact markers** (badges): `rounded-3xl` — a pill, sitting between the two above.

Borders on controls default to `border-transparent` (buttons, inputs) — color comes from background fill and the focus ring, not a visible stroke, until focus/error state adds one (`focus-visible:border-ring`, `aria-invalid:border-destructive`).

## Components

### Buttons
- **Shape:** `rounded-md` (8px), border-transparent at rest.
- **Primary:** Deep Navy background, white text, `hover:bg-primary/80`.
- **Secondary:** Pale Slate background/text.
- **Outline:** background-colored fill with a visible border, `hover:bg-muted`.
- **Ghost:** no fill at rest, `hover:bg-muted`.
- **Destructive:** Alert Red at low opacity (`bg-destructive/10`) rather than a solid red fill — a quieter danger treatment than most systems default to.
- **Link:** text-only, Deep Navy, underline on hover.
- **Sizes:** `xs` (24px) through `lg` (40px), plus matching icon-only square variants (`icon`, `icon-xs`, `icon-sm`, `icon-lg`).
- **Interaction:** active state nudges the button down 1px (`active:translate-y-px`) instead of scaling or darkening — a tactile "pressed" cue.

### Badges
- **Shape:** `rounded-3xl` pill, 20px tall.
- **Default:** Deep Navy fill, white text.
- **Secondary / Outline / Ghost / Destructive / Link:** mirror the button variant logic at badge scale.

### Cards
- **Corner Style:** `rounded-4xl` (26px), header and footer rounding to match.
- **Background:** Surface White, with a visibly distinct Surface Header (`#dee2e6`) band for `CardHeader` — not just a border, an actual tonal step.
- **Shadow Strategy:** resting surface (see Elevation).
- **Border:** none visible; definition comes from the hairline ring.
- **Internal Padding:** 24px (`px-6`) default, 16px (`px-4`) in the `size="sm"` density variant.

### Inputs / Fields
- **Style:** `rounded-md`, `border-transparent`, `bg-input/50` (tinted, not flat white) at rest.
- **Focus:** border becomes `ring` color plus a 3px soft ring (`focus-visible:ring-3 focus-visible:ring-ring/30`) — no glow/shadow, just border + ring.
- **Error/Invalid:** border and ring switch to Alert Red (`aria-invalid:border-destructive aria-invalid:ring-destructive/20`).

### Dialogs
- **Style:** `rounded-4xl`, Surface White/Popover background, `shadow-xl` + hairline ring, scrim at 30% black with backdrop blur.
- **Motion:** fade + scale in from 95% (`zoom-in-95`) on open, reverse on close, both at 100ms — fast, not showy.

## Do's and Don'ts

### Do:
- **Do** use logical CSS properties (`ps-`/`pe-`, `inset-s-`) for any directional spacing or positioning — this product is Hebrew RTL end-to-end, and physical `left`/`right` will visually break under `dir="rtl"`.
- **Do** keep the container/control radius contrast intentional: large `rounded-4xl` for cards/dialogs, tight `rounded-md` for buttons/inputs.
- **Do** define a surface's edge with the hairline ring (`ring-1 ring-foreground/5`), not a solid border, to match the existing card/dialog treatment.
- **Do** reserve Court Gold for the specific "court/gold identity" marker role; use Deep Navy for all other brand/primary emphasis.

### Don't:
- **Don't** hardcode `left`/`right` positioning or `pl-`/`pr-` spacing; this breaks RTL mirroring.
- **Don't** introduce a second typeface for display/heading text — the system currently carries all hierarchy through Montserrat weight and size, not font pairing.
- **Don't** add drop shadows beyond `shadow-md` (resting) / `shadow-xl` (overlay); nothing in the scanned components uses a heavier or more decorative shadow.
- **Don't** use Court Gold or chart colors as general UI accents outside their established roles (identity marker / data visualization).
