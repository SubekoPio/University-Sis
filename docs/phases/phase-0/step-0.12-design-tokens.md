<!-- Purpose: Record the Phase 0 semantic design-token implementation audit. -->

# Phase 0 / Step 0.12: Semantic Design Tokens

## Goal

Ensure UI status, form-border, and "Coming soon" states use the semantic design
tokens and accessible presentation rules requested for Phase 0.

## What Was Built

- Audited the existing tokens in `apps/web/tailwind.config.ts` and
  `apps/web/src/app/globals.css`; the requested `field`, success, warning,
  error, and info strong/soft values were already present.
- Confirmed `--destructive` maps to `var(--error)` and each semantic value has
  a role comment in the token definitions.
- Confirmed `StatusBanner` renders an icon and visible label for each
  success/warning/error/info variant, and `ComingSoonBadge` uses `info-soft`
  with `info` text.
- Confirmed the root ESLint rule rejects raw hex literals in web TS/TSX source.
- No source changes were needed for this step because the requested
  implementation was already in the codebase.

## Key Decisions

- Keep teal (`badge`) reserved for GPA and attendance.
- Keep status communication accessible through icon and text label, not color
  alone.
- Use the existing semantic tokens for "Coming soon"; do not add a new color.

## Business Rules

- Status banners use the matching strong/soft token pair.
- Form-control borders use `field`; error states include readable text.
- The "Coming soon" badge uses an information icon and text label on
  `info-soft`, with `info` text.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/web typecheck` — passed.
- `corepack pnpm@12.21.0 exec eslint --no-config-lookup --config eslint.config.mjs apps/web/src/components/ui/status-banner.tsx apps/web/src/components/ui/coming-soon-badge.tsx` — passed.
- `git diff --check` — passed.

## Data/Permissions Impact

No schema, migration, seed, endpoint, role, or permission changes. The step
confirmed the existing UI tokens and components only.

## Known Limitations

- The token values, component rules, and documented light-background contrast
  ratios match the current code.
- `docs/DESIGN_SYSTEM.md`'s **Contrast and accessibility** section does not
  specify dark-mode pairings. `globals.css` defines `.dark` overrides for
  shadcn variables while leaving the custom semantic status values unchanged;
  document and validate that theme behavior before relying on it.
- The raw-hex rule is scoped to web `.ts`/`.tsx` files; the CSS token
  definitions remain the intended location for raw palette values.

## Copilot Usage

Copilot checked the requested token and component requirements against the
current code. The requested implementation was already present, so no UI
source or token file was modified.
