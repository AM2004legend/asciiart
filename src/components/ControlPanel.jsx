import React, { useRef } from 'react';

const ControlPanel = ({ options, setOptions, engineRef }) => {
  const fileInputRef = useRef(null);
  const handleChange = (key, value) => {
    setOptions(prev => ({ ...prev, [key]: value }));
    
    // Also apply theme to document root to update UI colors immediately
    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', value);
    }
  };

  const handleExport = () => {
    if (engineRef.current) {
      const dataUrl = engineRef.current.exportCanvas();
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = `ascii-art-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      }
    }
  };

  const handleExportText = () => {
    if (engineRef.current) {
      const text = engineRef.current.getAsciiText();
      if (text) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `ascii-art-${Date.now()}.txt`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const toggleCamera = () => {
    if (engineRef.current) {
      engineRef.current.toggleCamera();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && engineRef.current) {
      engineRef.current.handleFileUpload(file);
    }
  };

  return (
    <div className="control-panel-wrapper glass-panel">
      <div className="panel-header">
        <h1>ASSC-art-11</h1>
        <p>Aesthetic ASCII Engine</p>
      </div>

      <div className="control-group">
        <label>
          Density
          <span>{Math.round(options.density * 100)}%</span>
        </label>
        <input 
          type="range" 
          min="0.5" max="3" step="0.1" 
          value={options.density} 
          onChange={(e) => handleChange('density', parseFloat(e.target.value))}
        />
      </div>

      <div className="control-group">
        <label>
          Resolution Factor
          <span>{Math.round(options.resolution)}%</span>
        </label>
        <input 
          type="range" 
          min="10" max="150" step="5" 
          value={options.resolution} 
          onChange={(e) => handleChange('resolution', parseFloat(e.target.value))}
        />
      </div>

      <div className="control-group">
        <label>
          Contrast
        </label>
        <input 
          type="range" 
          min="-100" max="100" step="5" 
          value={options.contrast} 
          onChange={(e) => handleChange('contrast', parseInt(e.target.value, 10))}
        />
      </div>

      <div className="control-group">
        <label>
          Gamma
        </label>
        <input 
          type="range" 
          min="0.1" max="3.0" step="0.1" 
          value={options.gamma} 
          onChange={(e) => handleChange('gamma', parseFloat(e.target.value))}
        />
      </div>

      <div className="control-row" style={{marginBottom: '1rem'}}>
        <label style={{margin: 0}}>Color Mode</label>
        <select 
          value={options.colorMode}
          onChange={(e) => handleChange('colorMode', e.target.value)}
        >
          <option value="theme">Theme based</option>
          <option value="rgb">Full RGB</option>
        </select>
      </div>

      <div className="control-row" style={{marginBottom: '1.25rem'}}>
        <label style={{margin: 0}}>Theme</label>
        <select 
          value={options.theme}
          onChange={(e) => handleChange('theme', e.target.value)}
          disabled={options.colorMode === 'rgb'}
        >
          <option value="matrix">Matrix</option>
          <option value="hacker">Hacker</option>
          <option value="cyberpunk">Cyberpunk</option>
          <option value="neon">Neon</option>
          <option value="grayscale">Grayscale</option>
        </select>
      </div>

      <div className="control-row" style={{marginBottom: '1.25rem'}}>
        <label style={{margin: 0}}>Invert Brightness</label>
        <input 
          type="checkbox" 
          checked={options.invert}
          onChange={(e) => handleChange('invert', e.target.checked)}
        />
      </div>

      <div className="flex-col gap-2">
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*,video/*"
          onChange={handleFileChange}
        />
        <button onClick={() => fileInputRef.current.click()}>Upload Image / Video</button>
        <button onClick={toggleCamera}>Toggle Camera</button>
        <button className="primary" onClick={handleExport}>Download PNG</button>
        <button onClick={handleExportText}>Download Text</button>
      </div>
    </div>
  );
};

export default ControlPanel;
