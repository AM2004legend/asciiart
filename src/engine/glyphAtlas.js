import { CHARSETS, EDGE_CHARS } from '../config/presets.js';

export const GLYPH_FONT = '"IBM Plex Mono", ui-monospace, "Cascadia Mono", Consolas, monospace';
export const ATLAS_COLUMNS = 16;

const DOT_LEVELS = 10;
const CLASSIC = Array.from(CHARSETS[0].chars);

// Braille dot for each pattern bit, as [column, row-from-top] (Unicode order).
export const BRAILLE_BITS = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3]];

// Shade blocks are drawn as solid fills so they tile without gaps.
const BLOCK_ALPHA = { '█': 1, '▓': 0.75, '▒': 0.5, '░': 0.25 };

/**
 * Describes the glyphs for a style. Index 0 is always blank.
 *  - ascii:   [blank, ...ramp, ...edge glyphs], `levels` = ramp length
 *  - dots:    [blank, ...circles of growing size], `levels` = DOT_LEVELS
 *  - braille: 256 patterns, index = dot bitmask
 * `text` maps each index to the character used for text export.
 */
export function glyphSet(style, ramp) {
  if (style === 'braille') {
    return {
      key: 'braille',
      mode: 1,
      levels: 2,
      text: Array.from({ length: 256 }, (_, p) => String.fromCharCode(0x2800 + p)),
      draw: drawBraille,
    };
  }
  if (style === 'dots') {
    return {
      key: 'dots',
      mode: 0,
      levels: DOT_LEVELS,
      text: [' ', ...Array.from({ length: DOT_LEVELS }, (_, i) => CLASSIC[Math.round((i / (DOT_LEVELS - 1)) * (CLASSIC.length - 1))])],
      draw: drawDot,
    };
  }
  const glyphs = [' ', ...ramp, ...EDGE_CHARS];
  return {
    key: `ascii:${ramp.join('')}`,
    mode: 0,
    levels: ramp.length,
    text: glyphs,
    draw: (ctx, i, x, y, w, h, font) => drawChar(ctx, glyphs[i], x, y, w, h, font),
  };
}

/**
 * Renders every glyph into a 16-column grid of cells at the exact
 * device-pixel cell size, so the shader can read it with texelFetch.
 */
export function buildGlyphAtlas(set, cellW, cellH) {
  const count = set.text.length;
  const canvas = document.createElement('canvas');
  canvas.width = cellW * ATLAS_COLUMNS;
  canvas.height = cellH * Math.ceil(count / ATLAS_COLUMNS);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';

  ctx.font = `500 100px ${GLYPH_FONT}`;
  const advance = ctx.measureText('M').width / 100;
  const size = Math.max(4, Math.min(cellH * 0.9, (cellW * 0.98) / advance));
  const font = `500 ${size}px ${GLYPH_FONT}`;

  for (let i = 1; i < count; i++) {
    const x = (i % ATLAS_COLUMNS) * cellW;
    const y = Math.floor(i / ATLAS_COLUMNS) * cellH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cellW, cellH);
    ctx.clip();
    set.draw(ctx, i, x, y, cellW, cellH, font);
    ctx.restore();
  }
  return canvas;
}

function drawChar(ctx, glyph, x, y, w, h, font) {
  const block = BLOCK_ALPHA[glyph];
  if (block !== undefined) {
    ctx.globalAlpha = block;
    ctx.fillRect(x, y, w, h);
    return;
  }
  if (glyph === ' ') return;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = parseFloat(font.split(' ')[1]);
  ctx.fillText(glyph, x + w / 2, y + h / 2 + size * 0.05);
}

function drawBraille(ctx, pattern, x, y, w, h) {
  const r = Math.max(0.6, Math.min(w / 2, h / 4) * 0.36);
  BRAILLE_BITS.forEach(([col, row], bit) => {
    if (!(pattern & (1 << bit))) return;
    ctx.beginPath();
    ctx.arc(x + (col + 0.5) * (w / 2), y + (row + 0.5) * (h / 4), r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawDot(ctx, i, x, y, w, h) {
  const level = i - 1; // 0 = empty
  if (level <= 0) return;
  const r = (Math.min(w, h) / 2) * 1.12 * Math.sqrt(level / (DOT_LEVELS - 1));
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
  ctx.fill();
}
