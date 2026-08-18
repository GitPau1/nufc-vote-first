# Component Foundation Alignment Design

## Goal

Bring NUFC Vote components into a strict foundation-aligned system without redesigning the product flow. The chosen direction is **Foundation Strict**: existing screens keep their information architecture, while shared primitives and repeated components follow documented typography, radius, color, spacing, and state rules.

## Foundation Rules

- Typography uses Wanted role tokens only: `heading-*`, `headline-*`, `body-*`, `label-*`, and `caption-*`.
- New `text-[...]`, `leading-[...]`, and `tracking-[...]` classes are not allowed.
- Colors use existing semantic tokens such as `bg-background`, `bg-surface`, `bg-disabled`, `text-foreground`, `text-muted-foreground`, `border-border`, `primary`, and status tokens.
- New hardcoded visual colors such as `bg-[#...]`, `text-[#...]`, and `border-[#...]` are not allowed.
- Cards use `rounded-lg` / 16px.
- Internal groups use `rounded-md` / 12px.
- Buttons, inputs, and option controls use `rounded-sm` / 10px.
- Pills, chips, avatars, and circular indicators use `rounded-pill`.
- Page content uses 16px side margins by default. Main feed surfaces that need the Wanted mobile grid feel may use 20px.

## Component Scope

The alignment applies to:

- Shared primitives: `Button`, `Card`, `Badge`, `Sheet`, `Avatar`, form helper classes.
- Feed components: poll hero, poll list card, player row, Pick One card, menu actions.
- Composite poll components: Type A/B poll screens, overall rating poll/result, result bars, comments, confirm modal.
- Utility screens: login, onboarding, admin, poll create, feedback, weekly player changes.
- State surfaces: loading skeletons, empty states, error messages, disabled states, selected states.

## Component Behavior

Foundation alignment should not change data behavior, navigation, authentication, voting logic, comment behavior, analytics, or Supabase interactions. Visual edits must stay inside component classes and small local structure only when needed to apply an existing foundation rule.

## Visual Direction

Components should feel calm, mobile-first, and consistent:

- Cards are softly contained with `bg-surface`, `border-border`, and optional `shadow-g200`.
- Lists remain scannable and compact, but row typography follows role tokens.
- Vote and player action states use tokenized `primary`, `disabled`, `muted`, `positive`, and `negative`.
- Hero media can stay full-bleed inside its component, but overlays and text use tokenized color and type rules.
- Selected states use tokenized ring or border treatment, not hardcoded hex shadows.

## Exceptions

Some fixed layout values remain allowed because they describe component geometry rather than foundation typography or color:

- App shell and route chrome dimensions such as `max-w-[480px]`, `h-[62px]`, and bottom navigation offsets.
- Media and result proportions such as `h-[252px]`, `h-[160px]`, and thumbnail sizes.
- Fixed-format grid definitions such as `grid-cols-[minmax(...)]`.
- Pick One card animation geometry such as `w-[calc(...)]`, translate classes, and opacity tuning.

If these values become reusable patterns, they should be promoted into documented layout or component tokens later.

## Verification

Add or maintain tests that fail when:

- Foundation-covered components use arbitrary typography classes.
- Foundation-covered components use hardcoded visual colors.
- Shared primitives drift away from documented radius and typography roles.
- Primary app tabs reintroduce arbitrary visual classes.

Run:

```bash
node --test $(rg --files src | rg 'test\.mjs$')
npm run build
```

## Out Of Scope

- Redesigning product flows.
- Reworking data models, server actions, analytics, or query behavior.
- Creating a new visual brand direction beyond the documented foundation.
- Eliminating every fixed layout number before those values have documented layout tokens.
