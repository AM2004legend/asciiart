import { IconButton } from './controls.jsx';
import {
  CameraIcon, CopyIcon, FileIcon, FlipIcon, PauseIcon, PlayIcon, SaveIcon, SlidersIcon,
} from './icons.jsx';

export default function Dock({
  source, canFlip, paused, panelOpen,
  onCamera, onCloseCamera, onFlip, onOpenFile, onTogglePause, onCopyText, onSave, onTogglePanel,
}) {
  const isCamera = source.kind === 'camera';
  const canPause = source.kind !== 'image';

  return (
    <nav className="dock chrome" aria-label="Controls">
      <div className="dock-group">
        <IconButton
          label={isCamera ? 'Turn off camera' : 'Use camera'}
          icon={<CameraIcon />}
          pressed={isCamera}
          onClick={isCamera ? onCloseCamera : onCamera}
        />
        {isCamera && canFlip && (
          <IconButton
            label={source.facing === 'environment' ? 'Use front camera' : 'Use back camera'}
            shortcut="V"
            icon={<FlipIcon />}
            onClick={onFlip}
          />
        )}
        <IconButton label="Open image or video" icon={<FileIcon />} onClick={onOpenFile} />
        {canPause && (
          <IconButton
            label={paused ? 'Resume' : 'Pause'}
            shortcut="Space"
            icon={paused ? <PlayIcon /> : <PauseIcon />}
            onClick={onTogglePause}
          />
        )}
      </div>

      <span className="dock-sep" aria-hidden="true" />

      <div className="dock-group">
        <IconButton label="Copy as text" shortcut="C" icon={<CopyIcon />} onClick={onCopyText} />
        <button type="button" className="btn btn-primary dock-save" onClick={onSave}>
          <SaveIcon />
          <span>Save PNG</span>
        </button>
        <IconButton
          label="Adjust"
          shortcut="A"
          icon={<SlidersIcon />}
          pressed={panelOpen}
          aria-controls="adjust-panel"
          onClick={onTogglePanel}
        />
      </div>
    </nav>
  );
}
