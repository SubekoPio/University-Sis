# Design System

This document defines the semantic color tokens used by `apps/web`. Components should use the named tokens, not raw color values. Tailwind v4 utilities are exposed through the theme in `apps/web/src/app/globals.css`; the legacy-compatible names are also listed in `apps/web/tailwind.config.ts`.

## Color tokens

| Token          | Value     | Role                                                              |
| -------------- | --------- | ----------------------------------------------------------------- |
| `brand`        | `#312E81` | Deep Indigo; navigation rail and primary brand surfaces.          |
| `accent`       | `#4F46E5` | Electric Indigo; primary calls to action, links, and focus rings. |
| `badge`        | `#0D9488` | Teal; GPA and attendance badges only.                             |
| `surface`      | `#F9FAFB` | Page background.                                                  |
| `card`         | `#FFFFFF` | Cards, tables, dialogs, and modals.                               |
| `ink`          | `#111827` | Primary text and headings.                                        |
| `line`         | `#E5E7EB` | Decorative borders and dividers; do not use for input borders.    |
| `field`        | `#6B7280` | Input and form-control borders.                                   |
| `success`      | `#15803D` | Positive status text and icons.                                   |
| `success-soft` | `#DCFCE7` | Positive status backgrounds.                                      |
| `warning`      | `#B45309` | Caution status text and icons.                                    |
| `warning-soft` | `#FEF3C7` | Caution status backgrounds.                                       |
| `error`        | `#B91C1C` | Error status text and icons.                                      |
| `error-soft`   | `#FEE2E2` | Error status backgrounds.                                         |
| `info`         | `#4F46E5` | Informational text and icons.                                     |
| `info-soft`    | `#EEF2FF` | Informational status backgrounds.                                 |

Use the tokens directly in Tailwind utilities, for example `bg-brand`, `text-ink`, `border-field`, `bg-success-soft`, and `text-error`.

## Usage rules

- Use `brand` for the navigation rail; use white (`card`) for its labels and icons.
- Use `accent` for primary actions, links, and visible focus rings. Keep one primary call to action per view.
- Reserve `badge` teal for GPA and attendance indicators. Do not use it as a generic success color.
- Use `surface` for page backgrounds, `card` for content surfaces, `ink` for text, and `line` for decorative dividers.
- Use `field` for form-control borders. Pair errors with an `error` border and readable error message.
- Pair each strong status token with its matching soft background: `success`/`success-soft`, `warning`/`warning-soft`, `error`/`error-soft`, or `info`/`info-soft`.
- Every status must include an icon **and** a text label. Never communicate status through color alone. `StatusBanner` provides both; custom status UI must do the same.
- Use `info` on `info-soft` for "Coming soon" labels. Keep unavailable controls visibly disabled and provide the active alternative where one exists.
- Do not add raw hex/RGB colors or arbitrary color values in components. Add or change a semantic token here first.

## Contrast and accessibility

Contrast ratios are approximate and assume the listed foreground/background pairing:

| Pairing                             | Approximate ratio | Guidance                                                                                   |
| ----------------------------------- | ----------------: | ------------------------------------------------------------------------------------------ |
| White (`card`) on `brand`           |              11:1 | Passes WCAG AA and AAA for normal text.                                                    |
| White (`card`) on `accent`          |             6.3:1 | Passes WCAG AA for normal text.                                                            |
| `ink` on `surface`                  |              17:1 | Passes WCAG AAA for normal text.                                                           |
| White (`card`) on `badge` teal      |             3.7:1 | Below 4.5:1 for normal text; use only for large/bold text, or pair with an icon and label. |
| `field` border on white             |             4.8:1 | Exceeds the 3:1 non-text contrast target for controls.                                     |
| `success` on white / `success-soft` |     5.0:1 / 4.6:1 | Passes WCAG AA for normal text.                                                            |
| `warning` on white / `warning-soft` |     5.0:1 / 4.5:1 | Passes WCAG AA for normal text.                                                            |
| `error` on white / `error-soft`     |     6.5:1 / 5.3:1 | Passes WCAG AA for normal text.                                                            |
| `info` on `info-soft`               |             5.6:1 | Passes WCAG AA for normal text.                                                            |

Always provide visible keyboard focus using `accent`. Status color is supplementary: the icon and text label remain necessary even when a contrast pairing passes.
