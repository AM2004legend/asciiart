import { useCallback, useEffect, useRef, useState } from 'react';
import Stage from './components/Stage.jsx';
import TopBar from './components/TopBar.jsx';
import StartScreen from './components/StartScreen.jsx';
import Dock from './components/Dock.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import { useSettings } from './hooks/useSettings.js';
import { useMediaSource } from './hooks/useMediaSource.js';
import { useIdle } from './hooks/useIdle.js';
import { useToast } from './hooks/useToast.js';
import { getPalette } from './config/presets.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

export default function App() {
  const [settings, update, reset] = useSettings();
  const { source, starting, canFlip, startCamera, openFile, close } = useMediaSource();
  const [paused, setPaused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [startError, setStartError] = useState('');
  const [stats, setStats] = useState({ cols: 0, rows: 0, fps: 0 });
  const [toast, showToast] = useToast();
  const idle = useIdle(2800);
  const rendererRef = useRef(null);
  const fileInputRef = useRef(null);
  const palette = getPalette(settings.palette);

  // ── actions ───────────────────────────────────────────────────────────────

  const report = useCallback((err) => {
    if (source) showToast(err.message);
    else setStartError(err.message);
  }, [source, showToast]);

  const enableCamera = useCallback(async (facing = 'user', options) => {
    setStartError('');
    setPaused(false);
    try {
      await startCamera(facing, options);
    } catch (err) {
      report(err);
    }
  }, [startCamera, report]);

  const loadFile = useCallback(async (file) => {
    setStartError('');
    setPaused(false);
    try {
      await openFile(file);
    } catch (err) {
      report(err);
    }
  }, [openFile, report]);

  const switchCamera = (facing) => {
    if (source?.kind !== 'camera' || facing === source.facing) return;
    enableCamera(facing, { strict: true });
  };
  const flipCamera = () => switchCamera(source?.facing === 'environment' ? 'user' : 'environment');

  const closeCamera = () => {
    close();
    setPaused(false);
    setPanelOpen(false);
  };

  const togglePause = () => {
    if (!source || source.kind === 'image') return;
    const next = !paused;
    if (source.kind === 'video') {
      if (next) source.el.pause();
      else source.el.play().catch(() => {});
    }
    setPaused(next);
  };

  const save = async () => {
    const blob = await rendererRef.current?.snapshot();
    if (!blob) return;
    download(blob, `asciiart-${stamp()}.png`);
    showToast('Saved PNG');
  };

  const saveText = (message = 'Saved as .txt') => {
    const text = rendererRef.current?.getText();
    if (!text) return;
    download(new Blob([text], { type: 'text/plain' }), `asciiart-${stamp()}.txt`);
    showToast(message);
  };

  const copyText = async () => {
    const text = rendererRef.current?.getText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${stats.cols} × ${stats.rows} characters`);
    } catch {
      saveText('Clipboard isn’t available here, so it was saved as .txt');
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // ── global input: keyboard, drag-and-drop, paste ─────────────────────────
  // Handlers live in a ref so the listeners are attached once.

  const handlers = useRef({});
  useEffect(() => {
    handlers.current = {
      key(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target.closest?.('input, textarea, select')) return;
        const key = e.key.toLowerCase();
        if (key === ' ' && e.target.closest?.('button')) return;
        const actions = {
          ' ': togglePause,
          s: save,
          c: copyText,
          a: () => setPanelOpen((o) => !o),
          v: () => canFlip && flipCamera(),
          e: () => update({ edges: !settings.edges }),
          h: () => {
            setUiHidden((h) => !h);
            if (!uiHidden) showToast('Interface hidden. Press H to bring it back.');
          },
          f: toggleFullscreen,
          escape: () => {
            setPanelOpen(false);
            setUiHidden(false);
          },
        };
        if (actions[key]) {
          e.preventDefault();
          actions[key]();
        }
      },
      file: loadFile,
    };
  });

  useEffect(() => {
    const onKey = (e) => handlers.current.key(e);
    const hasFiles = (e) => e.dataTransfer?.types?.includes('Files');
    const onDragOver = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(true);
    };
    const onDragLeave = (e) => {
      if (!e.relatedTarget) setDragging(false);
    };
    const onDrop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragging(false);
      handlers.current.file(e.dataTransfer.files[0]);
    };
    const onPaste = (e) => {
      const file = e.clipboardData?.files?.[0];
      if (file) handlers.current.file(file);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  const openPicker = () => fileInputRef.current?.click();

  return (
    <div
      className="app"
      data-idle={(idle && source && !panelOpen) || undefined}
      data-ui-hidden={uiHidden || undefined}
      data-panel-open={panelOpen || undefined}
      style={{ '--accent': palette.accent, '--accent-ink': palette.accentInk }}
    >
      <Stage
        source={source}
        settings={settings}
        paused={paused}
        onStats={setStats}
        rendererRef={rendererRef}
      />

      <TopBar source={source} stats={stats} paused={paused} />

      {source ? (
        <Dock
          source={source}
          canFlip={canFlip}
          paused={paused}
          panelOpen={panelOpen}
          onCamera={() => enableCamera()}
          onCloseCamera={closeCamera}
          onFlip={flipCamera}
          onOpenFile={openPicker}
          onTogglePause={togglePause}
          onCopyText={copyText}
          onSave={save}
          onTogglePanel={() => setPanelOpen((o) => !o)}
        />
      ) : (
        <StartScreen starting={starting} error={startError} onCamera={() => enableCamera()} onOpenFile={openPicker} />
      )}

      <SettingsPanel
        open={panelOpen}
        settings={settings}
        update={update}
        reset={reset}
        isCamera={source?.kind === 'camera'}
        facing={source?.facing}
        canFlip={canFlip}
        onFacing={switchCamera}
        onClose={() => setPanelOpen(false)}
        onSaveText={() => saveText()}
      />

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <span>Drop to convert</span>
        </div>
      )}

      <div className="toast-region" role="status" aria-live="polite">
        {toast && <div key={toast.id} className="toast">{toast.message}</div>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          loadFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
