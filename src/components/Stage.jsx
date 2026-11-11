import { useEffect, useMemo, useRef, useState } from 'react';
import { AsciiRenderer } from '../engine/AsciiRenderer.js';
import { createDemoSource } from '../engine/demoSource.js';
import { getCharRamp, getPalette, getStyle } from '../config/presets.js';

function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Full-bleed canvas. Bridges React state into the framework-free renderer. */
export default function Stage({ source, settings, paused, onStats, rendererRef }) {
  const canvasRef = useRef(null);
  const statsRef = useRef(onStats);
  const [supported] = useState(hasWebGL2);
  const [demo] = useState(createDemoSource);

  useEffect(() => {
    statsRef.current = onStats;
  }, [onStats]);

  useEffect(() => {
    if (!supported) return;
    const renderer = new AsciiRenderer(canvasRef.current, { onStats: (s) => statsRef.current?.(s) });
    rendererRef.current = renderer;
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
  }, [supported, rendererRef]);

  const palette = getPalette(settings.palette);
  const live = Boolean(source);
  const options = useMemo(() => ({
    style: settings.style,
    cellAspect: getStyle(settings.style).cellAspect,
    ramp: getCharRamp(settings),
    fg: palette.fg,
    bg: palette.bg,
    sourceColor: live && settings.colorMode === 'source',
    cellSize: settings.cellSize,
    autoContrast: settings.autoContrast,
    contrast: 2 ** (settings.contrast / 50),
    gamma: 2 ** (-settings.brightness / 50),
    dither: settings.dither / 100,
    // Light palettes print dark ink on paper, so dense glyphs should mark shadows.
    invert: settings.invert !== Boolean(palette.light),
    edges: settings.edges,
    edgeThreshold: 2 - (settings.edgeSensitivity / 100) * 1.7,
    mirror: source?.kind === 'camera' && source.facing === 'user' && settings.mirror,
    fill: live ? settings.fill : true,
  }), [settings, palette, live, source]);

  useEffect(() => {
    rendererRef.current?.setOptions(options);
  }, [options, rendererRef]);

  useEffect(() => {
    rendererRef.current?.setSource(source ? source.el : demo);
  }, [source, demo, rendererRef]);

  useEffect(() => {
    rendererRef.current?.setPaused(paused);
  }, [paused, rendererRef]);

  if (!supported) {
    return (
      <div className="stage stage-unsupported" role="alert">
        <p>
          This browser can’t run WebGL2, which asciiart needs to draw in real time.
          Try a current version of Chrome, Edge, Firefox or Safari.
        </p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="stage"
      role="img"
      aria-label={source ? 'Live character art of your source' : 'Animated asciiart logo'}
    />
  );
}
