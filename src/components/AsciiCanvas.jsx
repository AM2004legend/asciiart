import React, { useEffect, forwardRef, useImperativeHandle } from 'react';
import { useMediaStream } from '../hooks/useMediaStream';
import { useAsciiEngine } from '../hooks/useAsciiEngine';

const AsciiCanvas = forwardRef(({ options }, ref) => {
  const { videoRef, imageRef, mediaType, mediaSrc, streamActive, error, startCamera, stopCamera, handleFileUpload } = useMediaStream();
  
  // We use a ref to hold options so the engine doesn't restart on every change
  const optionsRef = React.useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const activeSourceRef = React.useRef(null);
  activeSourceRef.current = mediaType === 'video' ? videoRef.current : imageRef.current;
  const { canvasRef, startEngine, stopEngine, generateTextFrame } = useAsciiEngine(activeSourceRef, optionsRef);

  // Expose camera controls and canvas to parent
  useImperativeHandle(ref, () => ({
    toggleCamera: () => {
      if (streamActive && mediaType === 'video') {
        stopCamera();
        stopEngine();
      } else {
        startCamera().then(() => {
          startEngine();
        });
      }
    },
    handleFileUpload: (file) => {
      handleFileUpload(file);
      // Ensure engine is running
      setTimeout(() => startEngine(), 500);
    },
    exportCanvas: () => {
      if (canvasRef.current) {
        return canvasRef.current.toDataURL('image/png');
      }
      return null;
    },
    getAsciiText: () => {
      return generateTextFrame();
    },
    isStreamActive: streamActive,
    error
  }));

  // Auto-start camera on mount
  useEffect(() => {
    startCamera().then(() => {
      // Small delay to ensure video plays
      setTimeout(startEngine, 500);
    });
    
    return () => {
      stopCamera();
      stopEngine();
    };
  }, [startCamera, stopCamera, startEngine, stopEngine]);

  return (
    <div className="canvas-container">
      {error && <div className="error-message" style={{position:'absolute', zIndex:20, color:'red'}}>{error}</div>}
      <video 
        ref={videoRef} 
        className="hidden-video"
        playsInline 
        muted 
        autoPlay
        style={{ display: 'none' }}
      />
      <img 
        ref={imageRef}
        src={mediaType === 'image' ? mediaSrc : undefined}
        className="hidden-video"
        style={{ display: 'none' }}
        alt="source"
      />
      <canvas 
        ref={canvasRef} 
        className="ascii-canvas"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
});

export default AsciiCanvas;
