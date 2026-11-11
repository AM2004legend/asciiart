import { VERTEX, ANALYZE, STATS, CLASSIFY, DRAW } from './shaders.js';
import { buildGlyphAtlas, glyphSet, GLYPH_FONT } from './glyphAtlas.js';

const MAX_DPR = 2;
const DENOISE = 0.55;        // temporal blend for still areas of live video
const STATS_SMOOTHING = 0.85; // keeps auto contrast from pumping

/**
 * Framework-free WebGL2 renderer. Owns its own requestAnimationFrame loop and
 * only redraws when the source produced a new frame or an option changed, so
 * a still image costs nothing once it is on screen.
 *
 * Sources: HTMLVideoElement, HTMLImageElement, HTMLCanvasElement, or a
 * procedural `{ canvas, update(time, aspect) }` object.
 */
export class AsciiRenderer {
  constructor(canvas, { onStats } = {}) {
    this.canvas = canvas;
    this.onStats = onStats;
    this.source = null;
    this.options = null;
    this.paused = false;
    this.glyphs = null;

    this.init();

    this.observer = new ResizeObserver(() => (this.dirty = true));
    this.observer.observe(canvas);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    // Rebuild glyphs once the web font arrives; the fallback is used until then.
    document.fonts?.load(`500 16px ${GLYPH_FONT}`).then(() => {
      this.atlasDirty = true;
      this.dirty = true;
    }).catch(() => {});

    this.start();
  }

  // ── public API ────────────────────────────────────────────────────────────

  setSource(source) {
    this.source = source;
    this.lastVideoTime = -1;
    this.needsUpload = true;
    this.historyValid = false;
    this.dirty = true;
  }

  setOptions(options) {
    const set = glyphSet(options.style, options.ramp);
    if (!this.glyphs || this.glyphs.key !== set.key) {
      this.glyphs = set;
      this.atlasDirty = true;
    }
    if (this.options?.style !== options.style) this.historyValid = false;
    this.options = { ...options, fgRGB: hexToRGB(options.fg), bgRGB: hexToRGB(options.bg) };
    this.dirty = true;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  /** Current frame as a PNG blob. */
  snapshot() {
    this.render(true);
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
  }

  /** Current frame as plain text, one line per row. */
  getText() {
    const { gl, grid } = this;
    if (!gl || !grid.cols) return '';
    this.render(true);
    const { cols, rows } = grid;
    const px = new Uint8Array(cols * rows * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.glyphFbo);
    gl.readPixels(0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const text = this.glyphs.text;
    const lines = [];
    for (let y = rows - 1; y >= 0; y--) {
      let line = '';
      for (let x = 0; x < cols; x++) line += text[px[(y * cols + x) * 4 + 3]] ?? ' ';
      lines.push(line.trimEnd());
    }
    return lines.join('\n').replace(/^\n+|\n+$/g, '');
  }

  destroy() {
    this.stop();
    this.observer.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.releaseGL();
  }

  // ── setup ─────────────────────────────────────────────────────────────────

  init() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;

    this.programs = {
      analyze: createProgram(gl, ANALYZE),
      stats: createProgram(gl, STATS),
      classify: createProgram(gl, CLASSIFY),
      draw: createProgram(gl, DRAW),
    };
    this.vao = gl.createVertexArray();
    this.sourceTex = createTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
    this.atlasTex = createTexture(gl, gl.NEAREST, gl.NEAREST);
    this.glyphTex = createTexture(gl, gl.NEAREST, gl.NEAREST);
    this.glyphFbo = createFramebuffer(gl, this.glyphTex);
    // Ping-pong pairs: the previous frame feeds denoising and stats smoothing.
    this.analysis = [0, 1].map(() => {
      const tex = createTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR);
      return { tex, fbo: createFramebuffer(gl, tex) };
    });
    this.stats = [0, 1].map(() => {
      const tex = createTexture(gl, gl.NEAREST, gl.NEAREST);
      return { tex, fbo: createFramebuffer(gl, tex) };
    });
    this.latest = 0;

    this.grid = { cols: 0, rows: 0, subX: 1, subY: 1, cellW: 0, cellH: 0, offX: 0, offY: 0 };
    this.sourceSize = [0, 0];
    this.lastVideoTime = -1;
    this.atlasDirty = true;
    this.needsUpload = true;
    this.historyValid = false;
    this.dirty = true;
    this.frames = 0;
    this.statsAt = performance.now();
  }

  releaseGL() {
    const { gl } = this;
    if (!gl || gl.isContextLost()) return;
    Object.values(this.programs).forEach(({ program }) => gl.deleteProgram(program));
    for (const { tex, fbo } of [...this.analysis, ...this.stats]) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
    }
    [this.sourceTex, this.atlasTex, this.glyphTex].forEach((t) => gl.deleteTexture(t));
    gl.deleteFramebuffer(this.glyphFbo);
    gl.deleteVertexArray(this.vao);
  }

  handleContextLost = (e) => {
    e.preventDefault();
    this.stop();
  };

  handleContextRestored = () => {
    this.init();
    this.start();
  };

  start() {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  // ── frame loop ────────────────────────────────────────────────────────────

  tick = (now) => {
    this.raf = requestAnimationFrame(this.tick);
    const src = this.source;
    if (!src) return;

    if (!this.paused) {
      if (src instanceof HTMLVideoElement) {
        if (src.readyState >= 2 && src.currentTime !== this.lastVideoTime) {
          this.lastVideoTime = src.currentTime;
          this.needsUpload = true;
        }
      } else if (typeof src.update === 'function') {
        src.update(now, this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
        this.needsUpload = true;
      }
    }

    if (this.needsUpload || this.dirty) this.render();

    if (now - this.statsAt >= 500) {
      const fps = Math.round((this.frames * 1000) / (now - this.statsAt));
      this.onStats?.({ cols: this.grid.cols, rows: this.grid.rows, fps });
      this.frames = 0;
      this.statsAt = now;
    }
  };

  render(force = false) {
    const { gl, options: o } = this;
    if (!gl || !o || !this.source || gl.isContextLost()) return;

    this.resize();
    if (this.atlasDirty) this.uploadAtlas();
    const fresh = this.needsUpload && this.uploadSource();
    if (!this.sourceSize[0]) return;
    if (!this.dirty && !force && !fresh) return;

    const { cols, rows, subX, subY, cellW, cellH, offX, offY } = this.grid;
    const [sw, sh] = this.sourceSize;
    const gridAspect = (cols * cellW) / (rows * cellH);
    const srcAspect = sw / sh;
    const wide = srcAspect > gridAspect;
    const scale = o.fill
      ? (wide ? [srcAspect / gridAspect, 1] : [1, gridAspect / srcAspect])
      : (wide ? [1, gridAspect / srcAspect] : [srcAspect / gridAspect, 1]);
    const aw = cols * subX;
    const ah = rows * subY;
    const texelsPerSample = Math.max(sw / (aw * scale[0]), sh / (ah * scale[1]), 1);

    // Denoise only across consecutive frames of a moving source.
    const live = this.source instanceof HTMLVideoElement || typeof this.source.update === 'function';
    const blend = live && this.historyValid;
    const prev = this.analysis[this.latest];
    const cur = this.analysis[1 - this.latest];
    const prevStats = this.stats[this.latest];
    const curStats = this.stats[1 - this.latest];

    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);

    // 1. Analyze: area-averaged colour + tone-mapped luminance per sample.
    let { program, u } = this.programs.analyze;
    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cur.fbo);
    gl.viewport(0, 0, aw, ah);
    bindTex(gl, 0, this.sourceTex, u.uSource);
    bindTex(gl, 1, prev.tex, u.uPrev);
    gl.uniform2f(u.uGrid, aw, ah);
    gl.uniform2f(u.uScale, scale[0], scale[1]);
    gl.uniform1f(u.uLod, Math.log2(texelsPerSample));
    gl.uniform1i(u.uMirror, o.mirror ? 1 : 0);
    gl.uniform1f(u.uContrast, o.contrast);
    gl.uniform1f(u.uGamma, o.gamma);
    gl.uniform1f(u.uSmooth, blend && fresh ? DENOISE : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, cur.tex);
    gl.generateMipmap(gl.TEXTURE_2D);

    // 2. Stats: brightness mean and spread, for auto contrast.
    ({ program, u } = this.programs.stats);
    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, curStats.fbo);
    gl.viewport(0, 0, 1, 1);
    bindTex(gl, 0, cur.tex, u.uAnalysis);
    bindTex(gl, 1, prevStats.tex, u.uPrevStats);
    gl.uniform2f(u.uScale, scale[0], scale[1]);
    gl.uniform1f(u.uLod, Math.max(0, Math.log2(Math.max(aw, ah) / 16)));
    gl.uniform1f(u.uSmooth, blend ? STATS_SMOOTHING : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 3. Classify: tone, dither, edges or braille → glyph index per cell.
    ({ program, u } = this.programs.classify);
    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.glyphFbo);
    gl.viewport(0, 0, cols, rows);
    bindTex(gl, 0, cur.tex, u.uAnalysis);
    bindTex(gl, 1, curStats.tex, u.uStats);
    gl.uniform2f(u.uGrid, cols, rows);
    gl.uniform2f(u.uScale, scale[0], scale[1]);
    gl.uniform1i(u.uMode, this.glyphs.mode);
    gl.uniform2i(u.uSub, subX, subY);
    gl.uniform1f(u.uLevels, this.glyphs.levels);
    gl.uniform1i(u.uAuto, o.autoContrast ? 1 : 0);
    gl.uniform1i(u.uInvert, o.invert ? 1 : 0);
    gl.uniform1f(u.uDither, o.dither);
    gl.uniform1i(u.uEdges, o.edges && o.style === 'ascii' ? 1 : 0);
    gl.uniform1f(u.uThreshold, o.edgeThreshold);
    gl.uniform1f(u.uCellAspect, cellW / cellH);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 4. Draw: glyph atlas lookup per screen pixel.
    ({ program, u } = this.programs.draw);
    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    bindTex(gl, 0, this.glyphTex, u.uGlyphs);
    bindTex(gl, 1, this.atlasTex, u.uAtlas);
    gl.uniform2i(u.uGrid, cols, rows);
    gl.uniform2i(u.uCell, cellW, cellH);
    gl.uniform2i(u.uOffset, offX, offY);
    gl.uniform3fv(u.uFg, o.fgRGB);
    gl.uniform3fv(u.uBg, o.bgRGB);
    gl.uniform1i(u.uSourceColor, o.sourceColor ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.latest = 1 - this.latest;
    this.historyValid = true;
    this.dirty = false;
    this.frames++;
  }

  resize() {
    const { gl, canvas, grid, options: o } = this;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const cellW = Math.max(3, Math.round(o.cellSize * dpr));
    const cellH = Math.max(3, Math.round(cellW * o.cellAspect));
    const cols = Math.max(1, Math.floor(w / cellW));
    const rows = Math.max(1, Math.floor(h / cellH));
    const [subX, subY] = o.style === 'braille' ? [2, 4] : [1, 1];

    if (cellW !== grid.cellW || cellH !== grid.cellH) this.atlasDirty = true;
    if (cols !== grid.cols || rows !== grid.rows) {
      allocate(gl, this.glyphTex, cols, rows);
    }
    if (cols * subX !== grid.cols * grid.subX || rows * subY !== grid.rows * grid.subY) {
      this.analysis.forEach(({ tex }) => allocate(gl, tex, cols * subX, rows * subY));
      this.historyValid = false;
    }
    this.grid = {
      cols, rows, subX, subY, cellW, cellH,
      offX: Math.floor((w - cols * cellW) / 2),
      offY: Math.floor((h - rows * cellH) / 2),
    };
  }

  uploadAtlas() {
    const { gl } = this;
    const atlas = buildGlyphAtlas(this.glyphs, this.grid.cellW, this.grid.cellH);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    this.atlasDirty = false;
    this.dirty = true;
  }

  uploadSource() {
    const { gl } = this;
    const el = this.source.canvas ?? this.source;
    const [w, h] = mediaSize(el);
    if (!w || !h) return false;

    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    if (w === this.sourceSize[0] && h === this.sourceSize[1]) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, el);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
      this.sourceSize = [w, h];
      this.historyValid = false;
    }
    gl.generateMipmap(gl.TEXTURE_2D);
    this.needsUpload = false;
    return true;
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function mediaSize(el) {
  if (el instanceof HTMLVideoElement) return [el.videoWidth, el.videoHeight];
  if (el instanceof HTMLImageElement) return [el.naturalWidth, el.naturalHeight];
  return [el.width, el.height];
}

function createProgram(gl, fragmentSource) {
  const program = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  const u = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const { name } = gl.getActiveUniform(program, i);
    u[name] = gl.getUniformLocation(program, name);
  }
  return { program, u };
}

function createTexture(gl, minFilter, magFilter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function allocate(gl, tex, w, h) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
}

function createFramebuffer(gl, tex) {
  allocate(gl, tex, 1, 1);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

function bindTex(gl, unit, tex, location) {
  if (location == null) return;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(location, unit);
}

function hexToRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
