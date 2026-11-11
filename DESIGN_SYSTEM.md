# IFA.ng design system

The look comes from the approved homepage preview: a dark full-bleed chant hero,
bright "cloth" surfaces, near-black "ink", and saturated colour blocks taken from
adire and aṣọ-òkè. Big, tight Bricolage Grotesque headlines; friendly Figtree body
text; pill buttons; trading-card style portraits that scroll right to left.

Everything below already lives in code. Use it instead of hand-picking colours.

| What | Where |
| --- | --- |
| Raw tokens (colours, scales, radii, shadows, fonts) | `src/design/tokens.ts` |
| CSS variables for shadcn/ui, dark mode, `.wrap`, `.band`, `.eyebrow` | `src/index.css` |
| Tailwind names for the tokens | `tailwind.config.ts` |
| Brand components | `src/components/brand/` (import from `@/components/brand`) |
| Logo, PWA icons, hero poster | `public/brand/`, `public/manifest.webmanifest` |

## Colour

| Token | Hex | Tailwind | Use |
| --- | --- | --- | --- |
| ink | `#121611` | `bg-ink`, `text-ink` | Text, default buttons, footer, hero, sidebars on dark |
| cloth | `#f6f1e4` | `bg-cloth` / `bg-background` | Page background |
| paper | `#fffdf7` | `bg-paper` / `bg-card` | Cards, inputs, panels |
| line | `#e3dccb` | `border-line` / `border-border` | Hairlines |
| muted | `#5d6457` | `text-muted-foreground` | Secondary text |
| green | `#1f6e3c` | `bg-primary`, `green-700` | Brand primary, links, confirmations, Odù ticker |
| leaf | `#c7e86a` | `bg-leaf` | "Live/available" dots, success chips, step 1 |
| sun | `#f2c230` | `bg-sun` | The one main call to action (Book, Pay, Join) |
| coral | `#d4472f` | `bg-coral`, `destructive` | Babalawo recruitment band, errors |
| indigo | `#28367f` | `bg-indigo-700` | Daily verse band, info |
| camwood | `#b5502b` | `text-camwood` | Eyebrows, emphasis words in headings |
| teal | `#2aa39a` | `bg-teal` | Portrait colour block |

Each brand colour has a full 50–950 scale. The old Lovable palettes are folded into the
brand in `tailwind.config.ts` (`purple`→green, `pink`/`red`→coral, `blue`→indigo,
`gray`→warm neutral, `yellow`/`amber`→sun, `orange`→camwood), so untouched screens
still look on-brand. In new code, prefer the brand names.

**Rules**

- One `sun` button per screen. Everything else is `default` (ink) or `outline`.
- Text on `sun`, `leaf` and the pastel blocks is always ink. Text on green, indigo, coral,
  camwood, teal and ink is white or cloth.
- Never use gradients for surfaces. Colour comes in flat blocks.
- Dark mode is the `.dark` class (built from ink, leaf as primary). The Babalawo PWA can
  use it for a night theme.

## Type

- Display: **Bricolage Grotesque** 800, tight tracking. `font-display` plus a size:
  `text-display-xl` (hero), `text-display-lg` (section), `text-display-md`, `text-display-sm`.
- Body: **Figtree** 400–700. It's the default `font-sans`. 16px base, 1.55 line height.
- Eyebrow: `.eyebrow` (12px, 700, 0.16em tracking, uppercase), usually `text-camwood`
  on light and `text-sun` or `text-leaf` on dark.
- Headings keep Yorùbá diacritics. Don't strip tone marks from names or Odù.

## Shape and depth

- Buttons and chips: `rounded-pill`. Inputs: `rounded-field` (14px), 48px tall.
- Cards and panels: `rounded-panel` (22px). Portrait cards: `rounded-card` (30px).
- Shadows: `shadow-lift` for floating cards, `shadow-sticker` / `shadow-sticker-lg` (hard
  ink offset) for the one highlighted panel, such as session notes or a booking summary.

## Components (`@/components/brand`)

| Component | What it's for |
| --- | --- |
| `Logo` | Mark + "IFA.ng" wordmark. `tone="light"` on dark surfaces, `markOnly` for tight spots. |
| `SectionHeading` | Eyebrow + big heading + lede. `layout="split"` matches the homepage. |
| `Eyebrow` | The small uppercase label on its own. |
| `PortraitCard` | Colour-block Babalawo card with portrait, name and white chips. `tilt` for marquees. |
| `Marquee` | Infinite right-to-left (or left-to-right) loop; pauses on hover, honours reduced motion. |
| `OduTicker` | The green band of the sixteen Odù Méjì. |
| `StickerPanel` | Paper panel with ink border and hard shadow. Session notes, receipts, summaries. |
| `ColorBlock` | Pastel block with a big number and title. Steps and onboarding. |
| `StatTile` | KPI tile for admin and dashboards. `tone` = paper, leaf, sun, coral, indigo, ink. |
| `SoundWave` | Five animated bars, for "live" and "now playing". |
| `TickDot` | Numbered leaf dot for tick lists. |
| `PageShell` | Public header + main + footer. |

shadcn/ui primitives in `src/components/ui` are restyled to match: `Button` has variants
`default` (ink), `sun`, `primary` (green), `outline` (ink border), `secondary`, `ghost`,
`glass` (for photos and ink bands), `destructive`, `link`. `Badge` adds `success` (leaf),
`sun`, `ink` and `paper`. Dialogs are paper with an ink border and sticker shadow.

## Motion

- Marquee: 46s per loop for cards, 60s for the Odù ticker.
- Hover lift: `-translate-y-0.5` on buttons, `-translate-y-2.5 scale-[1.04]` on cards.
- `prefers-reduced-motion` stops marquees and drifts (see `index.css`).

## Voice

Plain, warm and specific: "Hear Ifá speak.", "Every consultation, remembered.",
"Your Meet link arrives once payment clears." Say Babalawo, Odù, ẹbọ with their marks.
Don't promise outcomes.

## Dashboards (client and Babalawo)

Both dashboards use one layout, `src/components/dashboard/shell/DashboardShell.tsx`:
an ink sidebar with grouped navigation (the current page is a leaf pill), a cloth page,
a quiet header (date eyebrow, breadcrumb, bell, avatar) and an ink-bordered bottom bar on phones.

Build pages from `src/components/dashboard/shell/Panel.tsx`:

| Piece | Use |
| --- | --- |
| `PageIntro` | Eyebrow, big Bricolage title, lede. The shell adds it from each dashboard's `INTROS` map, so pages don't repeat their own title. |
| `Panel` / `PanelHeader` | Paper block with a hairline border and an eyebrow + title. Don't nest panels inside panels. |
| `EmptyState` | Dashed paper block with a leaf icon, a line of text and one action. |
| `ClothStrip` | The seven brand colours as a thin aṣọ-òkè band, under the ink greeting. |
| `greeting()` | Ẹ káàárọ̀ / Ẹ káàsán / Ẹ kúùrọ̀lẹ́ by time of day. |

Home pages open with an ink greeting band carrying the one sun button, then `StatTile`s
(leaf, paper, indigo, coral), then panels. Money and ritual totals use `font-display`.
