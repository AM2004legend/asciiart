// Palettes pair an ink colour with a paper colour. `light` palettes are dark
// ink on light paper, so brightness is inverted automatically for them.
// `accent`/`accentInk` tint the interface to match the active palette.
export const PALETTES = [
  { id: 'phosphor', name: 'Phosphor', fg: '#FFB000', bg: '#140C00', accent: '#FFB000', accentInk: '#140C00' },
  { id: 'blueprint', name: 'Blueprint', fg: '#CFE6FF', bg: '#0A2A5E', accent: '#9CCBFF', accentInk: '#0A2A5E' },
  { id: 'terminal', name: 'Terminal', fg: '#3DFF8F', bg: '#020905', accent: '#3DFF8F', accentInk: '#02170B' },
  { id: 'mono', name: 'Mono', fg: '#F4F4F4', bg: '#000000', accent: '#F4F4F4', accentInk: '#000000' },
  { id: 'riso', name: 'Riso', fg: '#FF2E7E', bg: '#F2EFE8', accent: '#FF2E7E', accentInk: '#FFFFFF', light: true },
  { id: 'newsprint', name: 'Newsprint', fg: '#1E1E1E', bg: '#E6E1D3', accent: '#E6E1D3', accentInk: '#1E1E1E', light: true },
];

// Character ramps run from emptiest to densest.
export const CHARSETS = [
  { id: 'classic', name: 'Classic', chars: ' .:-=+*#%@' },
  { id: 'detailed', name: 'Detailed', chars: " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$" },
  { id: 'blocks', name: 'Blocks', chars: ' ░▒▓█' },
  { id: 'binary', name: 'Binary', chars: ' 01' },
  { id: 'custom', name: 'Custom', chars: null },
];

// Edge glyphs, indexed by quantised edge direction: 0°, 45°, 90°, 135°.
export const EDGE_CHARS = '-/|\\';

// Art styles. `cellAspect` is cell height / cell width.
export const STYLES = [
  { id: 'ascii', name: 'Characters', cellAspect: 1.8 },
  { id: 'braille', name: 'Braille', cellAspect: 2 },
  { id: 'dots', name: 'Dots', cellAspect: 1 },
];

export const DEFAULTS = {
  style: 'ascii',
  palette: 'phosphor',
  colorMode: 'palette', // 'palette' | 'source'
  charset: 'classic',
  customChars: ' .oO@',
  cellSize: 6, // CSS px, cell width
  autoContrast: true,
  brightness: 0, // -100..100
  contrast: 0, // -100..100
  dither: 50, // 0..100
  invert: false,
  edges: false,
  edgeSensitivity: 50, // 0..100
  mirror: true,
  fill: true, // true = cover, false = contain
};

export function getStyle(id) {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}

export function getPalette(id) {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function getCharRamp(settings) {
  if (settings.charset === 'custom') {
    const chars = Array.from(settings.customChars ?? '');
    return chars.length >= 2 ? chars : Array.from(CHARSETS[0].chars);
  }
  const set = CHARSETS.find((c) => c.id === settings.charset) ?? CHARSETS[0];
  return Array.from(set.chars);
}
