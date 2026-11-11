export default function TopBar({ source, stats, paused }) {
  const label = source?.kind !== 'camera' ? source?.name
    : source.facing === 'environment' ? 'Back camera' : 'Front camera';
  const rate = paused ? 'Paused' : stats.fps > 0 ? `${stats.fps} fps` : 'Still';

  return (
    <header className="topbar chrome">
      <span className="wordmark">asciiart<span className="caret" aria-hidden="true" /></span>
      {source && (
        <dl className="readout" aria-label="Render status">
          <div><dt>Source</dt><dd className="readout-source" title={label}>{label}</dd></div>
          <div><dt>Grid</dt><dd>{stats.cols}×{stats.rows}</dd></div>
          <div><dt>Rate</dt><dd>{rate}</dd></div>
        </dl>
      )}
    </header>
  );
}
