export default function StartScreen({ starting, error, onCamera, onOpenFile }) {
  return (
    <section className="start chrome" aria-labelledby="start-title">
      <h1 id="start-title">See yourself in characters.</h1>
      <p className="start-lede">
        Your camera turns into live text art, right in the browser. Nothing is uploaded.
      </p>
      {error && <p className="start-error" role="alert">{error}</p>}
      <div className="start-actions">
        <button type="button" className="btn btn-primary" onClick={onCamera} disabled={starting}>
          {starting ? 'Waiting for camera…' : 'Turn on camera'}
        </button>
        <button type="button" className="btn" onClick={onOpenFile}>
          Open image or video
        </button>
      </div>
      <p className="start-hint">You can also drop or paste a file anywhere.</p>
    </section>
  );
}
