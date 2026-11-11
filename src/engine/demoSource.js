/**
 * A tiny procedural source used on the start screen: the wordmark over
 * drifting light, rendered by the same engine as the camera feed.
 */
export function createDemoSource() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const W = 240;

  return {
    canvas,
    update(time, aspect) {
      const h = Math.max(60, Math.round(W / Math.max(aspect, 0.3)));
      if (canvas.width !== W || canvas.height !== h) {
        canvas.width = W;
        canvas.height = h;
      }
      const t = time / 1000;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, h);

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x = W * (0.5 + 0.42 * Math.sin(t * (0.21 + i * 0.07) + i * 2.1));
        const y = h * (0.5 + 0.4 * Math.cos(t * (0.17 + i * 0.05) + i * 1.3));
        const r = Math.min(W, h) * (0.45 + 0.1 * i);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.3 - i * 0.06})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, h);
      }
      ctx.globalCompositeOperation = 'source-over';

      // Portrait screens stack the wordmark so the letters stay legible.
      const lines = aspect < 1 ? ['ascii', 'art'] : ['asciiart'];
      ctx.font = '800 100px system-ui, sans-serif';
      const scale = (W * 0.8) / ctx.measureText(lines[0]).width;
      const size = Math.min(Math.round(100 * scale), h * 0.3);
      ctx.font = `800 ${size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      const top = h * (lines.length > 1 ? 0.24 : 0.36);
      lines.forEach((line, i) => ctx.fillText(line, W / 2, top + i * size * 0.95));
    },
  };
}
