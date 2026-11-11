// Four-pass GPU pipeline. Every pass draws one full-screen triangle.
//
//  source ─► ANALYZE ──────────► STATS ──────────► CLASSIFY ─────────► DRAW ─► screen
//            per sample point:   1×1: mean + spread  per cell: tone,     glyph atlas
//            mip-filtered colour of brightness, for  dither, Sobel /     lookup per
//            + luma, denoised    auto contrast       braille → glyph id  screen pixel
//
// Samples per cell: 1 for ramp styles, 2×4 for braille.

export const VERTEX = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Map a fragment on a grid to source UV, honouring fit mode.
const FRAME = /* glsl */ `
uniform vec2 uGrid;   // grid size of the target pass
uniform vec2 uScale;  // displayed source size, in grid UV units
vec2 sourceUV(vec2 fragCoord) {
  return (fragCoord / uGrid - 0.5) / uScale + 0.5;
}
bool outside(vec2 uv) {
  return any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)));
}`;

export const ANALYZE = /* glsl */ `#version 300 es
precision highp float;
${FRAME}
uniform sampler2D uSource;
uniform sampler2D uPrev;
uniform float uLod;
uniform bool uMirror;
uniform float uContrast;
uniform float uGamma;
uniform float uSmooth;   // temporal denoise strength, 0 = off
out vec4 outColor;

void main() {
  vec2 uv = sourceUV(gl_FragCoord.xy);
  if (outside(uv)) { outColor = vec4(0.0); return; }
  if (uMirror) uv.x = 1.0 - uv.x;
  uv.y = 1.0 - uv.y; // textures are uploaded top-row first

  // Mip level ≈ source texels per sample, so each sample averages its area.
  vec3 c = textureLod(uSource, uv, uLod).rgb;
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  float l = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4);
  float toned = pow(l, uGamma);
  vec4 cur = vec4(clamp(c * (toned / l), 0.0, 1.0), toned);

  // Blend with the previous frame where little changed: kills sensor noise
  // shimmer without smearing motion.
  if (uSmooth > 0.0) {
    vec4 prev = texelFetch(uPrev, ivec2(gl_FragCoord.xy), 0);
    float still = 1.0 - smoothstep(0.03, 0.12, abs(cur.a - prev.a));
    cur = mix(cur, prev, uSmooth * still);
  }
  outColor = cur;
}`;

export const STATS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uAnalysis;
uniform sampler2D uPrevStats;
uniform vec2 uScale;
uniform float uLod;
uniform float uSmooth;
out vec4 outColor;

void main() {
  // Only sample where the image is (skip letterbox bars).
  vec2 halfSize = min(uScale, vec2(1.0)) * 0.5;
  float sum = 0.0, sum2 = 0.0;
  for (int y = 0; y < 16; y++) {
    for (int x = 0; x < 16; x++) {
      vec2 uv = 0.5 - halfSize + halfSize * 2.0 * (vec2(x, y) + 0.5) / 16.0;
      float l = textureLod(uAnalysis, uv, uLod).a;
      sum += l;
      sum2 += l * l;
    }
  }
  float mean = sum / 256.0;
  float spread = sqrt(max(sum2 / 256.0 - mean * mean, 0.0));
  vec4 stats = vec4(mean, spread, 0.0, 1.0);
  if (uSmooth > 0.0) stats = mix(stats, texelFetch(uPrevStats, ivec2(0), 0), uSmooth);
  outColor = stats;
}`;

export const CLASSIFY = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
${FRAME}
uniform sampler2D uAnalysis;
uniform sampler2D uStats;
uniform int uMode;           // 0 = ramp (characters, dots), 1 = braille
uniform ivec2 uSub;          // analysis samples per cell
uniform float uLevels;       // ramp length
uniform bool uAuto;
uniform bool uInvert;
uniform float uDither;       // 0..1
uniform bool uEdges;
uniform float uThreshold;
uniform float uCellAspect;   // cell width / cell height
out vec4 outColor;

const ivec2 BRAILLE[8] = ivec2[8](
  ivec2(0, 0), ivec2(0, 1), ivec2(0, 2), ivec2(1, 0),
  ivec2(1, 1), ivec2(1, 2), ivec2(0, 3), ivec2(1, 3));

// 8×8 ordered-dither threshold in (0, 1).
float bayer(ivec2 p) {
  int x = p.x & 7, y = p.y & 7, xy = x ^ y;
  int v = ((xy & 1) << 5) | ((x & 1) << 4) | ((xy & 2) << 2) | ((x & 2) << 1) | ((xy & 4) >> 1) | ((x & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}

vec4 stats;

// Auto contrast: stretch the spread of brightness (at most 2.5×) and pull the
// average part-way to mid-grey, so flat webcam light uses the whole ramp
// without blowing out images that are already punchy.
float tone(float l) {
  if (uAuto) {
    float gain = clamp(0.2 / max(stats.g, 1e-3), 1.0, 2.5);
    float center = mix(stats.r, 0.5, 0.6);
    l = clamp(center + (l - stats.r) * gain, 0.0, 1.0);
  }
  return uInvert ? 1.0 - l : l;
}

float lumaAt(ivec2 c) {
  c = clamp(c, ivec2(0), ivec2(uGrid) * uSub - 1);
  return tone(texelFetch(uAnalysis, c, 0).a);
}

void main() {
  if (outside(sourceUV(gl_FragCoord.xy))) { outColor = vec4(0.0); return; }
  stats = texelFetch(uStats, ivec2(0), 0);
  ivec2 cell = ivec2(gl_FragCoord.xy);

  if (uMode == 1) {
    int pattern = 0;
    vec3 color = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      ivec2 s = cell * uSub + ivec2(BRAILLE[i].x, 3 - BRAILLE[i].y);
      vec4 a = texelFetch(uAnalysis, s, 0);
      color += a.rgb;
      if (tone(a.a) > mix(0.5, bayer(s), uDither)) pattern |= 1 << i;
    }
    outColor = vec4(color / 8.0, float(pattern) / 255.0);
    return;
  }

  // Atlas index 0 is blank; ramp starts at 1; edge glyphs follow.
  vec4 a = texelFetch(uAnalysis, cell, 0);
  float l = tone(a.a);
  float q = floor(l * (uLevels - 1.0) + 0.5 + (bayer(cell) - 0.5) * uDither);
  float idx = 1.0 + clamp(q, 0.0, uLevels - 1.0);

  if (uEdges) {
    float tl = lumaAt(cell + ivec2(-1,  1)), t = lumaAt(cell + ivec2(0,  1)), tr = lumaAt(cell + ivec2(1,  1));
    float ml = lumaAt(cell + ivec2(-1,  0)),                                   mr = lumaAt(cell + ivec2(1,  0));
    float bl = lumaAt(cell + ivec2(-1, -1)), b = lumaAt(cell + ivec2(0, -1)), br = lumaAt(cell + ivec2(1, -1));
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);
    if (length(vec2(gx, gy)) > uThreshold) {
      // Gradient is perpendicular to the edge; correct for non-square cells.
      float edge = mod(atan(gy * uCellAspect, gx) + 1.5707963, 3.1415927);
      idx = 1.0 + uLevels + mod(floor(edge / 0.7853982 + 0.5), 4.0);
    }
  }
  outColor = vec4(a.rgb, idx / 255.0);
}`;

export const DRAW = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uGlyphs;
uniform sampler2D uAtlas;
uniform ivec2 uGrid;
uniform ivec2 uCell;    // device px
uniform ivec2 uOffset;  // device px, bottom-left of grid
uniform vec3 uFg;
uniform vec3 uBg;
uniform bool uSourceColor;
out vec4 outColor;

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy) - uOffset;
  if (px.x < 0 || px.y < 0) { outColor = vec4(uBg, 1.0); return; }
  ivec2 cell = px / uCell;
  if (cell.x >= uGrid.x || cell.y >= uGrid.y) { outColor = vec4(uBg, 1.0); return; }

  vec4 g = texelFetch(uGlyphs, cell, 0);
  int idx = int(g.a * 255.0 + 0.5);
  ivec2 tile = ivec2(idx & 15, idx >> 4);
  ivec2 local = px - cell * uCell;
  float coverage = texelFetch(uAtlas, tile * uCell + ivec2(local.x, uCell.y - 1 - local.y), 0).a;
  vec3 ink = uSourceColor ? min(g.rgb * 1.2 + 0.05, 1.0) : uFg;
  outColor = vec4(mix(uBg, ink, coverage), 1.0);
}`;
