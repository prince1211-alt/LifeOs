# LifeOS design system — Material 3 (Google style)

LifeOS follows Material Design 3, the way Google's own apps (Gmail, Drive, Tasks, Calendar, Fit) look on web and Android.
Read this before changing UI. Shared building blocks live in `src/components/` — use them instead of ad-hoc styles.

## Foundations

| Thing | Rule |
| --- | --- |
| Font | Google Sans Flex (self-hosted). Use the M3 type scale utilities below — never raw `text-sm font-semibold` combos. |
| Icons | Material Symbols Rounded via `@/components/icons` (`<Plus />`, `<Home filled />`). 24px default; 20px in dense rows; 18px inside buttons/chips. `filled` = selected/active state. Missing icon → add it to `scripts/gen-icons.mjs` and run `npm run icons`. |
| Colour | Material You dynamic colour from the user's seed (`settings.themeColor`, default Google blue `#0b57d0`), generated in `src/lib/theme.ts`. Only use role colours (below). No hard-coded hex except data colours (habit colours, chart series, priority flags). |
| Shape | `rounded-xs` 4px (text fields, snackbars, menus) · `rounded-sm` 8px (chips, small tiles) · `rounded-md` 12px (stat tiles, list containers) · `rounded-lg` 16px (cards, FAB) · `rounded-xl` 28px (dialogs, sheets, search bars, big hero containers) · `rounded-full` (buttons, nav indicators, avatars). |
| Elevation | Mostly tonal (surface-container levels). Shadows only for FAB (`shadow-elevation-3`), menus (`-2`), hover on filled buttons (`-1`). No borders around every card. |
| Motion | `ease-standard` for state changes, `animate-md-dialog` / `animate-md-sheet` / `animate-md-fade` for entrances. Ripple + state layer come from the `state-layer` class (add it to anything clickable that isn't already a Button/Chip/ListItem). |

### Type scale (utilities)

`text-display-{large,medium,small}` (big numbers: timers, alarm time) · `text-headline-{large,medium,small}` (page titles, dialog titles, hero numbers) ·
`text-title-{large,medium,small}` (card titles, list headlines) · `text-body-{large,medium,small}` (content, supporting text) ·
`text-label-{large,medium,small}` (buttons, chips, metadata).

### Colour roles (Tailwind classes)

- Surfaces: `bg-surface` (page) · `bg-surface-container-lowest` (desktop content pane) · `bg-surface-container-low` (cards) · `bg-surface-container` / `-high` / `-highest` (tiles, inputs, sheets, emphasis).
- Text: `text-on-surface` (primary text) · `text-on-surface-variant` (secondary text, icons) · `text-primary` (links, text buttons, accents).
- Accents: `bg-primary text-on-primary` (strongest) · `bg-primary-container text-on-primary-container` (FAB, hero) · `bg-secondary-container text-on-secondary-container` (selected/active, tonal buttons) · `bg-tertiary-container text-on-tertiary-container` (contrasting accent).
- Status: `bg-error-container text-on-error-container`, `text-error` · `bg-success-container text-on-success-container`, `text-success` · `bg-warning-container text-on-warning-container`.
- Lines: `border-outline-variant` (dividers, outlined cards) · `border-outline` (inputs, outlined buttons/chips).
- Legacy names still work and map to M3 roles (`bg-card`→surface-container-low, `bg-muted`→surface-container-high, `text-muted-foreground`→on-surface-variant, `border`→outline-variant). Prefer the M3 names in new code.

## Components (`src/components/ui`)

| Need | Use |
| --- | --- |
| Page title + main action | `<PageHeader title subtitle fab={{ icon: <Plus />, label: 'New task', onClick }} actions />` — desktop gets a FAB-style button in the header, phones get an extended FAB above the nav bar. One `fab` per page. |
| Buttons | `<Button>` = filled; `variant="secondary"` tonal; `"outline"`; `"ghost"` text button; `"elevated"`; `"destructive"`. Pill shaped, 40px. Dialog actions are **text buttons** (`ghost`), the confirming one last. |
| Icon buttons | `<IconButton label="Delete"><Trash2 /></IconButton>` (standard), `selected` for toggles. |
| FAB | `<Fab icon label fixed />` (extended) when a page needs a second floating action; normally use PageHeader's `fab`. |
| Cards | `<Card>` tonal (default) · `variant="elevated" | "filled" | "outlined" | "flat"`. `CardHeader` / `CardTitle` (title-medium) / `CardContent`. |
| Lists | `<ListItem leading headline supporting trailing onClick chevron />` inside a `rounded-lg bg-surface-container-low overflow-hidden` container, with `<Divider inset />` between rows when needed. Settings-style pages are lists, not forms. |
| Text fields | `<Field label="Title"><Input /></Field>` → outlined field with notched label. `Field plain` for non-input content (day picker, chips, sliders). `Select`, `Textarea` same pattern. `supporting` for helper text. |
| Choice | `Segmented` (2–5 short options) · `Tabs` (switch views of a page, underline indicator) · `Chip` (filters, tags) · `Switch` · `Checkbox` (round, Google Tasks style) · `DayPicker`. |
| Metadata | `Badge` (small chip; variants default/outline/primary/secondary/tertiary/success/warning/destructive). |
| Progress | `Progress` (linear) · `ProgressRing` (circular). |
| Stats | `Stat` tile (`label`, big `value`, `sub`). |
| Empty | `<EmptyState icon title text action />` (tonal icon disc, no dashed borders). |
| Dialogs | `<Dialog title footer>` = bottom sheet on phones, 28px dialog on desktop. `useConfirm()` for destructive confirmations. |
| Snackbars | `toast(text, { label: 'Undo', run })`. |
| Sections | `<SectionTitle>` (title-small in primary) to group content inside a page. |

## Patterns (how Google apps do it)

- **One primary action per page** as the FAB (New task, New habit, New alarm, New goal, Start workout…). Secondary actions are tonal/text buttons or icon buttons.
- **"New" menu**: the drawer's New button links to `/<page>?new=1`. Every page with a create dialog must call `useNewParam(() => setCreating(true))` from `@/lib/hooks`.
- **Lists over boxes**: rows of tasks/alarms/habits sit in one tonal container with dividers or 2px gaps (`gap-0.5` inside a rounded container with `overflow-hidden`), not separate bordered cards.
- **Big friendly numbers**: timers, streaks, clean time, alarm times use display/headline styles with `tabular`.
- **Tonal hero**: the top of a dashboard uses `bg-primary-container text-on-primary-container rounded-xl` (or secondary/tertiary) for the key summary.
- **Search/quick add** looks like Google's search bar: `h-14 rounded-xl bg-surface-container-high` pill with leading icon, no inner border.
- **Charts** (Recharts): series colours from roles (`var(--md-primary)`, `var(--md-tertiary)`, `var(--md-secondary)`), axis text `var(--md-on-surface-variant)`, grid `var(--md-outline-variant)`, tooltips `background: var(--md-surface-container-high)`, `border: none`, `border-radius: 8px`. Rounded bar tops (`radius={[6,6,0,0]}`).
- **Spacing**: 16px page gutters on phones, 24–32px on desktop; 12–16px between cards; 8px between related controls.
- **Writing**: sentence case everywhere ("New task", not "New Task"). Short labels.
- **Accessibility**: every icon-only control has a label; touch targets ≥ 40px; never rely on colour alone.
