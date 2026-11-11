import { CHARSETS, DEFAULTS, PALETTES, STYLES } from '../config/presets.js';
import { Segmented, Slider, Switch } from './controls.jsx';
import { CloseIcon } from './icons.jsx';

const SHORTCUTS = [
  ['Space', 'Pause or resume'],
  ['S', 'Save PNG'],
  ['C', 'Copy as text'],
  ['A', 'Show or hide this panel'],
  ['V', 'Switch between front and back camera'],
  ['E', 'Turn outlines on or off'],
  ['H', 'Hide the interface'],
  ['F', 'Full screen'],
];

const signed = (v) => (v > 0 ? `+${v}` : String(v));

function sample(chars) {
  const glyphs = Array.from(chars).filter((c) => c !== ' ');
  if (glyphs.length <= 7) return glyphs.join('');
  return Array.from({ length: 7 }, (_, i) => glyphs[Math.round((i / 6) * (glyphs.length - 1))]).join('');
}

export default function SettingsPanel({
  open, settings, update, reset, isCamera, facing, canFlip, onFacing, onClose, onSaveText,
}) {
  return (
    <aside id="adjust-panel" className="panel" data-open={open} aria-label="Adjust" inert={!open}>
      <div className="panel-head">
        <h2>Adjust</h2>
        <button type="button" className="icon-btn" aria-label="Close panel" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="panel-body">
        <section>
          <h3>Look</h3>
          <div className="swatches" role="group" aria-label="Palette">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                className="swatch"
                aria-pressed={settings.palette === p.id}
                onClick={() => update({ palette: p.id })}
              >
                <span className="swatch-chip" style={{ background: p.bg, color: p.fg }} aria-hidden="true">@%=</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <Segmented
            label="Ink color"
            value={settings.colorMode}
            options={[{ value: 'palette', label: 'Palette' }, { value: 'source', label: 'From source' }]}
            onChange={(colorMode) => update({ colorMode })}
          />
        </section>

        <section>
          <h3>Style</h3>
          <Segmented
            label="Draw with"
            value={settings.style}
            options={STYLES.map((st) => ({ value: st.id, label: st.name }))}
            onChange={(style) => update({ style })}
          />
          {settings.style === 'braille' && (
            <p className="hint">Each character holds a 2×4 grid of dots, so you get eight times the detail.</p>
          )}
          {settings.style === 'ascii' && (
            <div className="charsets" role="group" aria-label="Character set">
              {CHARSETS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="charset"
                  aria-pressed={settings.charset === c.id}
                  onClick={() => update({ charset: c.id })}
                >
                  <span>{c.name}</span>
                  <span className="charset-sample" aria-hidden="true">
                    {sample(c.chars ?? settings.customChars) || '…'}
                  </span>
                </button>
              ))}
            </div>
          )}
          {settings.style === 'ascii' && settings.charset === 'custom' && (
            <div className="field">
              <label className="field-label" htmlFor="custom-chars">Your characters</label>
              <input
                id="custom-chars"
                className="text-input"
                type="text"
                value={settings.customChars}
                maxLength={64}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => update({ customChars: e.target.value })}
              />
              <p className="hint">List them from emptiest to densest. Start with a space to keep shadows clear.</p>
            </div>
          )}
          <Slider
            label="Cell size"
            value={settings.cellSize}
            min={3}
            max={20}
            defaultValue={DEFAULTS.cellSize}
            format={(v) => `${v} px`}
            onChange={(cellSize) => update({ cellSize })}
          />
        </section>

        <section>
          <h3>Tone</h3>
          <Switch
            label="Auto contrast"
            hint="Stretches each frame to use every shade. Best for dim or flat webcam light."
            checked={settings.autoContrast}
            onChange={(autoContrast) => update({ autoContrast })}
          />
          <Slider
            label="Brightness"
            value={settings.brightness}
            min={-100}
            max={100}
            defaultValue={0}
            format={signed}
            onChange={(brightness) => update({ brightness })}
          />
          <Slider
            label="Contrast"
            value={settings.contrast}
            min={-100}
            max={100}
            defaultValue={0}
            format={signed}
            onChange={(contrast) => update({ contrast })}
          />
          <Slider
            label="Dither"
            value={settings.dither}
            min={0}
            max={100}
            defaultValue={DEFAULTS.dither}
            onChange={(dither) => update({ dither })}
          />
          <Switch label="Invert" checked={settings.invert} onChange={(invert) => update({ invert })} />
        </section>

        {settings.style === 'ascii' && (
        <section>
          <h3>Outlines</h3>
          <Switch
            label="Trace edges"
            hint="Finds edges with a Sobel filter and draws them as - / | \"
            checked={settings.edges}
            onChange={(edges) => update({ edges })}
          />
          <Slider
            label="Sensitivity"
            value={settings.edgeSensitivity}
            min={0}
            max={100}
            defaultValue={DEFAULTS.edgeSensitivity}
            disabled={!settings.edges}
            onChange={(edgeSensitivity) => update({ edgeSensitivity })}
          />
        </section>
        )}

        <section>
          <h3>Framing</h3>
          {isCamera && canFlip && (
            <Segmented
              label="Camera"
              value={facing}
              options={[{ value: 'user', label: 'Front' }, { value: 'environment', label: 'Back' }]}
              onChange={onFacing}
            />
          )}
          <Switch
            label="Fill the screen"
            hint="Crops the edges instead of leaving bars."
            checked={settings.fill}
            onChange={(fill) => update({ fill })}
          />
          {isCamera && facing === 'user' && (
            <Switch label="Mirror camera" checked={settings.mirror} onChange={(mirror) => update({ mirror })} />
          )}
        </section>

        <section>
          <h3>Keyboard</h3>
          <dl className="shortcuts">
            {SHORTCUTS.map(([key, action]) => (
              <div key={key}><dt><kbd>{key}</kbd></dt><dd>{action}</dd></div>
            ))}
          </dl>
        </section>
      </div>

      <div className="panel-foot">
        <button type="button" className="btn" onClick={onSaveText}>Save as .txt</button>
        <button type="button" className="btn btn-quiet" onClick={reset}>Reset all</button>
      </div>
    </aside>
  );
}
