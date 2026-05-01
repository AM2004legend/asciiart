import React, { useState, useRef, useEffect } from 'react';
import AsciiCanvas from './components/AsciiCanvas';
import ControlPanel from './components/ControlPanel';
import './App.css';

function App() {
  const engineRef = useRef(null);
  
  // App-level state for UI controls
  // This state is passed to the engine as a ref to avoid recreating the render loop on every slide
  const [options, setOptions] = useState({
    density: 1.0,
    resolution: 80, // percentage of ideal resolution
    contrast: 0,
    gamma: 1.0,
    invert: true,
    colorMode: 'theme', // 'rgb' or 'theme'
    theme: 'grayscale',
    charset: "@%#*+=-:. "
  });

  // Initialize theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', options.theme);
  }, []);

  return (
    <div className="app-container">
      <AsciiCanvas 
        ref={engineRef}
        options={options} 
      />
      
      <ControlPanel 
        options={options}
        setOptions={setOptions}
        engineRef={engineRef}
      />
    </div>
  );
}

export default App;
