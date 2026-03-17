# Renderer Page Architecture Rules

## Scope

This rule applies to all files under `src/renderer/src/pages/**`.

## Page Boundaries

1. A page file is a route entry, not a component warehouse.
2. Target size: keep each page file under 500 lines; hard limit is 800 lines.
3. If a page has 3+ popups/drawers/modals, split them into `components/`.
4. Keep route-level responsibilities in page only:
   - page-level state orchestration
   - route interactions
   - top-level composition

## Required File Layout

For each complex page `<PageName>.tsx`, use this structure:

- `pages/<feature>/<PageName>.tsx` route container
- `pages/<feature>/<feature>.types.ts` local feature types
- `pages/<feature>/<feature>.utils.ts` pure helpers/data transforms
- `pages/<feature>/components/*.tsx` UI-only blocks
- `pages/<feature>/hooks/*.ts` feature hooks with side effects

## Dependency Rules

1. `components/*` can depend on:
   - shared UI/components
   - feature `types` and `utils`
2. `utils` must be pure and side-effect free.
3. `hooks` own async requests and event subscriptions.
4. Do not import page component from child modules.

## UI Consistency Rules

1. Brand color `#FF4D2A` is the only primary action color.
2. Keep existing Ant Design patterns and spacing rhythm.
3. Style values should be centralized when repeated 3+ times.
4. Use inline styles only for local one-off layout tweaks.

## Type and Quality Gates

1. No `any` in new page code.
2. `unknown` must be narrowed before assignment/rendering.
3. New page modules must pass:
   - `npm run lint:eslint`
   - `npm run typecheck`
4. If page split is partial, preserve behavior first and continue in incremental PRs.

## Rollout Plan

1. Split `ModelPage` first (in progress baseline).
2. Then split `SkillsPage`.
3. Then split `ChannelsPage`.

