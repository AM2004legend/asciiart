import { useRef, useEffect, useCallback } from 'react';

// Default ASCII character set from the requirements
const DEFAULT_CHARSET = "@%#*+=-:. ";

export function useAsciiEngine(sourceRef, optionsRef) {
  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  
  // Initialize offscreen canvas once
  useEffect(() => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  const renderFrame = useCallback(() => {
    const source = sourceRef.current;
    const canvas = canvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    
    // Check if source is ready (HAVE_ENOUGH_DATA is for video, complete is for image)
    const isReady = source && (
      (source.nodeName === 'VIDEO' && source.readyState === source.HAVE_ENOUGH_DATA) ||
      (source.nodeName === 'IMG' && source.complete && source.naturalHeight !== 0)
    );

    if (!isReady || !canvas || !offscreen) {
      requestRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const opts = optionsRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

    const scaleFactor = opts.resolution / 100;
    
    const sourceWidth = source.nodeName === 'VIDEO' ? source.videoWidth : source.naturalWidth;
    const sourceHeight = source.nodeName === 'VIDEO' ? source.videoHeight : source.naturalHeight;
    const sourceAspect = sourceWidth / sourceHeight;
    
    const cols = Math.floor(100 * scaleFactor * opts.density);
    const rows = Math.floor(cols / sourceAspect);
    
    // Set offscreen canvas to the low resolution
    if (offscreen.width !== cols) {
      offscreen.width = cols;
      offscreen.height = rows;
    }

    // Ensure main canvas matches window/container size
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    // Draw source to offscreen canvas
    offCtx.drawImage(source, 0, 0, cols, rows);
    const imageData = offCtx.getImageData(0, 0, cols, rows);
    const data = imageData.data;

    // Clear main canvas with background color (from CSS variable ideally, but we need hard values for canvas)
    // We can read the computed style of the body or just clear to black/theme bg
    ctx.fillStyle = opts.theme === 'matrix' ? '#000' : 
                    opts.theme === 'neon' ? '#110011' : 
                    opts.theme === 'cyberpunk' ? '#000022' : '#0d0d12'; // Default dark bg
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate font size to fit the characters
    const charWidth = canvas.width / cols;
    const charHeight = canvas.height / rows;
    
    // We use a monospace font. Aspect ratio correction handled by charWidth/charHeight spacing
    ctx.font = `${charHeight}px monospace`;
    ctx.textBaseline = 'top';

    const charset = opts.charset || DEFAULT_CHARSET;
    const charsetLen = charset.length;

    // Gamma & Contrast variables
    const contrastFactor = (259 * (opts.contrast + 255)) / (255 * (259 - opts.contrast));

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const offset = (y * cols + x) * 4;
        let r = data[offset];
        let g = data[offset + 1];
        let b = data[offset + 2];

        // Apply contrast
        if (opts.contrast !== 0) {
          r = contrastFactor * (r - 128) + 128;
          g = contrastFactor * (g - 128) + 128;
          b = contrastFactor * (b - 128) + 128;
        }

        // Calculate brightness (luminance)
        let brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Apply gamma correction if not 1.0
        if (opts.gamma !== 1.0) {
          brightness = Math.pow(brightness / 255, opts.gamma) * 255;
        }

        // Clamp brightness
        brightness = Math.max(0, Math.min(255, brightness));

        if (opts.invert) {
          brightness = 255 - brightness;
        }

        // Map brightness to character
        const charIndex = Math.floor((brightness / 255) * (charsetLen - 1));
        const char = charset[charIndex];

        // Determine color
        if (opts.colorMode === 'rgb') {
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        } else {
          // Use theme color
          ctx.fillStyle = getThemeColor(opts.theme);
        }

        // Render character
        ctx.fillText(char, x * charWidth, y * charHeight);
      }
    }

    requestRef.current = requestAnimationFrame(renderFrame);
  }, [sourceRef, optionsRef]);

  const startEngine = useCallback(() => {
    if (!requestRef.current) {
      requestRef.current = requestAnimationFrame(renderFrame);
    }
  }, [renderFrame]);

  const stopEngine = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  }, []);

  const generateTextFrame = useCallback(() => {
    const source = sourceRef.current;
    const isReady = source && (
      (source.nodeName === 'VIDEO' && source.readyState === source.HAVE_ENOUGH_DATA) ||
      (source.nodeName === 'IMG' && source.complete && source.naturalHeight !== 0)
    );

    if (!isReady) return "";

    const opts = optionsRef.current;
    const scaleFactor = opts.resolution / 100;
    
    const sourceWidth = source.nodeName === 'VIDEO' ? source.videoWidth : source.naturalWidth;
    const sourceHeight = source.nodeName === 'VIDEO' ? source.videoHeight : source.naturalHeight;
    const sourceAspect = sourceWidth / sourceHeight;

    const cols = Math.floor(100 * scaleFactor * opts.density);
    const rows = Math.floor(cols / sourceAspect);
    
    // Create a temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cols;
    tempCanvas.height = rows;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(source, 0, 0, cols, rows);
    const imageData = tempCtx.getImageData(0, 0, cols, rows);
    const data = imageData.data;

    const charset = opts.charset || DEFAULT_CHARSET;
    const charsetLen = charset.length;
    const contrastFactor = (259 * (opts.contrast + 255)) / (255 * (259 - opts.contrast));

    let output = "";

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const offset = (y * cols + x) * 4;
        let r = data[offset];
        let g = data[offset + 1];
        let b = data[offset + 2];

        if (opts.contrast !== 0) {
          r = contrastFactor * (r - 128) + 128;
          g = contrastFactor * (g - 128) + 128;
          b = contrastFactor * (b - 128) + 128;
        }

        let brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (opts.gamma !== 1.0) {
          brightness = Math.pow(brightness / 255, opts.gamma) * 255;
        }

        brightness = Math.max(0, Math.min(255, brightness));
        if (opts.invert) brightness = 255 - brightness;

        const charIndex = Math.floor((brightness / 255) * (charsetLen - 1));
        output += charset[charIndex];
      }
      output += "\n";
    }

    return output;
  }, [sourceRef, optionsRef]);

  return {
    canvasRef,
    startEngine,
    stopEngine,
    generateTextFrame
  };
}

function getThemeColor(theme) {
  switch(theme) {
    case 'matrix': return '#00ff00';
    case 'hacker': return '#00ffcc';
    case 'neon': return '#ff00ff';
    case 'cyberpunk': return '#fce205';
    case 'grayscale': return '#ffffff';
    default: return '#ffffff'; // Fallback
  }
}
