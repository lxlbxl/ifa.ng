/**
 * IFA.ng design tokens — single source of truth.
 *
 * The look: bright "cloth" surfaces, a near-black "ink", and saturated colour
 * blocks (leaf, sun, coral, indigo, camwood, teal) taken from adire and aṣọ-òkè.
 * Display type is Bricolage Grotesque, body type is Figtree.
 *
 * Tailwind reads this file (tailwind.config.ts), and components can import it
 * for JS needs such as rotating card colours. CSS variables live in
 * src/index.css. See DESIGN_SYSTEM.md for usage rules.
 */

export const brand = {
  ink: '#121611',
  cloth: '#f6f1e4',
  paper: '#fffdf7',
  line: '#e3dccb',
  muted: '#5d6457',
  green: '#1f6e3c',
  leaf: '#c7e86a',
  sun: '#f2c230',
  coral: '#d4472f',
  indigo: '#28367f',
  camwood: '#b5502b',
  teal: '#2aa39a',
  meet: '#202124',
} as const;

/** Full 50–950 scales. Each brand colour sits at its own natural stop. */
export const scales = {
  green: { 50: '#effbf3', 100: '#dbf5e5', 200: '#bbeccd', 300: '#90e0ad', 400: '#60d28a', 500: '#36bf68', 600: '#2c9b55', 700: '#1f6e3c', 800: '#1a5b32', 900: '#113c21', 950: '#0a2414' },
  leaf: { 50: '#f8fced', 100: '#f0f9d7', 200: '#e2f3b4', 300: '#c7e86a', 400: '#bce34f', 500: '#a4d421', 600: '#85ac1b', 700: '#6a8915', 800: '#4f6510', 900: '#33420a', 950: '#1f2806' },
  sun: { 50: '#fef9ec', 100: '#fcf2d4', 200: '#fae7ae', 300: '#f6d779', 400: '#f2c230', 500: '#e6b00f', 600: '#bb8f0c', 700: '#957209', 800: '#6e5407', 900: '#483705', 950: '#2b2103' },
  coral: { 50: '#fcf0ee', 100: '#f7ddd9', 200: '#f0c0b7', 300: '#e79788', 400: '#dc6a56', 500: '#d4472f', 600: '#a53622', 700: '#832b1b', 800: '#612014', 900: '#3f150d', 950: '#260c08' },
  indigo: { 50: '#eff1fa', 100: '#dce0f4', 200: '#bdc5ea', 300: '#929fdd', 400: '#6476ce', 500: '#3b50ba', 600: '#304197', 700: '#28367f', 800: '#1c2659', 900: '#12193a', 950: '#0b0f23' },
  camwood: { 50: '#fbf2ee', 100: '#f6e1da', 200: '#efc7b9', 300: '#e4a38b', 400: '#d87b5a', 500: '#c6572f', 600: '#b5502b', 700: '#80381e', 800: '#5f2a16', 900: '#3e1b0f', 950: '#251009' },
  teal: { 50: '#effbfa', 100: '#dbf6f4', 200: '#baedea', 300: '#8de2dc', 400: '#5dd5cd', 500: '#2aa39a', 600: '#22857e', 700: '#207e77', 800: '#185d59', 900: '#103d3a', 950: '#092423' },
  neutral: { 50: '#fbf8f0', 100: '#f6f1e4', 200: '#e3dccb', 300: '#cdc5b1', 400: '#a39d8c', 500: '#7a7a6c', 600: '#5d6457', 700: '#454b40', 800: '#2c312a', 900: '#1b1f19', 950: '#121611' },
} as const;

/** Colour blocks used behind portraits and step cards, in display order. */
export const blockColors = [
  brand.green,
  brand.camwood,
  brand.indigo,
  brand.coral,
  brand.teal,
  '#8a6a12',
] as const;

/** Light pastel blocks for cards that carry ink text (steps, stats). */
export const pastelBlocks = [brand.leaf, brand.sun, '#f3b9a6', '#b9c4f2', '#bfe6e1'] as const;

export const fonts = {
  display: ['"Bricolage Grotesque"', '"Arial Black"', 'system-ui', 'sans-serif'],
  body: ['Figtree', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
} as const;

export const radii = {
  pill: '999px',
  card: '30px',
  panel: '22px',
  field: '14px',
} as const;

/** Hard "sticker" shadow used on notes and highlighted panels. */
export const shadows = {
  sticker: `6px 6px 0 ${brand.ink}`,
  stickerLg: `8px 8px 0 ${brand.ink}`,
  lift: '0 14px 30px rgba(18,22,17,.16)',
  float: '0 30px 60px rgba(18,22,17,.25)',
} as const;

export const pickBlock = (seed: string | number, palette: readonly string[] = blockColors) => {
  const n =
    typeof seed === 'number'
      ? seed
      : Array.from(seed).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return palette[Math.abs(n) % palette.length];
};
