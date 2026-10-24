# Sparkline (atom)

**Component:** `components/atoms/sparkline/sparkline.component.ts`
**Selector:** `<atom-sparkline>`
**Used by:** [stat-strip](../03-molecules/stat-strip.md) (Employee Dashboard, Agent Tickets, Admin Tickets) and the Support Agent's ticket cards.

## Purpose

A tiny inline-SVG trend line. No axes, no labels, no gridlines — just a stroked curve with a soft gradient fill beneath it.

## Anatomy

A single `<svg>` with a fixed `viewBox="0 0 100 32"`, scaled to the host's size via `preserveAspectRatio="none"`. It contains:

1. A `<linearGradient>` in `<defs>` — the stroke colour at the top, fading to fully transparent at the baseline.
2. A filled `<path>` — the area under the curve, closed down to the baseline so the gradient fills.
3. A `<polyline>` (default) or `<path>` (when `smooth` is on) — the curve itself.

The curve's coordinates stay resolution-independent: the caller controls the rendered size, the viewBox stays fixed.

## API

| Input | Type | Default | Notes |
|---|---|---|---|
| `points` | `number[]` (required) | — | Raw values. No normalization expected from the caller. |
| `color` | `string` | `var(--color-primary)` | Stroke + gradient stops. |
| `gradientId` | `string` | `'sparkline-gradient'` | **Must be unique per instance** — two sparklines sharing an id fight over the first `<defs>` registration. |
| `smooth` | `boolean` | `false` | Draws a cubic Bézier curve instead of straight segments. |
| `fillOpacity` | `number` | `0.22` | Opacity of the gradient's **top** stop. The bottom stop always fades to 0. |
| `strokeOpacity` | `number` | `1` | Opacity of the stroke. |

## Behavior

### Edge cases

| Input | Result |
|---|---|
| `[]` | Renders **nothing** — no `<svg>` at all, so the card degrades to icon + number rather than a stray dot at the origin. |
| `[7]` (one point) | A flat centred line. Without the special case the min === max branch would divide by zero. |
| `[5, 5, 5]` (no variance) | A straight line through the vertical **middle**, not collapsed onto the bottom edge. |
| Any input | Never emits `NaN` coordinates. |

### Normalization

- **x** positions are evenly spaced across the full viewBox width (`0` to `100`).
- **y** is inverted — a larger value means a smaller y, because SVG's y grows downward — and padded 3px from the top and bottom so the stroke is never clipped.

### Smooth curves

`smooth` switches to cubic Bézier segments using a "control point at the midpoint, tension pulled back toward the anchor" scheme, with a tension of 0.22.

Each segment's control points are **clamped into the padded band**. The handle length derives from the neighbouring points, so a steep step (e.g. 29 → 3) could otherwise push a control point past the viewBox edge and the curve would visibly overshoot the card.

Fewer than three points cannot form a cubic segment, so a two-point series falls back to the polyline.

When `smooth` is on, the **area path reuses the exact same curve** as the stroke and then closes down to the baseline. The fill and the line therefore can never disagree.

### The stat strip's pale wash

The Employee Dashboard's stat strip passes `strokeOpacity` 0.34 and `fillOpacity` 0.1. Because the gradient fill sits **behind** the stroke, the two alphas compound on the stroke's own pixels:

```
1 - (1 - 0.34)(1 - 0.10) = 0.406
```

which is the reference's measured peak alpha. Each value is therefore set below the target and they compound up to it.

## Accessibility

The `<svg>` is `aria-hidden="true"` and `focusable="false"`. The sparkline is a decorative hint — the number it sits beside carries the meaning.

## Gotchas

- **`gradientId` must be unique.** If two instances share an id, the second one's `url(#id)` reference resolves to the first one's gradient — and the area renders with the wrong colour. The stat strip derives its ids from the accent name (`stat-strip-spark-open`, etc.).
- **The `gradientId` input must be bound as a plain string.** Binding the signal itself would put the signal's debug string in the `url(#...)` reference, and the fill would resolve to nothing.
