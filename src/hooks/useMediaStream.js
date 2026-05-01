import { useState, useRef, useCallback, useEffect } from 'react';

export function useMediaStream() {
  const [streamActive, setStreamActive] = useState(false);
  const [mediaType, setMediaType] = useState('video'); // 'video' or 'image'
  const [mediaSrc, setMediaSrc] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const imageRef = useRef(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });
      
      
      if (videoRef.current) {
        setMediaType('video');
        setMediaSrc(null); // Clear object URL if any
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamActive(true);
        setError(null);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please check permissions.");
      setStreamActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }, []);

  const handleFileUpload = useCallback((file) => {
    stopCamera();
    const url = URL.createObjectURL(file);
    setMediaSrc(url);
    if (file.type.startsWith('image/')) {
      setMediaType('image');
      setStreamActive(true); // Image is "active"
      setError(null);
    } else if (file.type.startsWith('video/')) {
      setMediaType('video');
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
        videoRef.current.loop = true;
        videoRef.current.play();
      }
      setStreamActive(true);
      setError(null);
    } else {
      setError("Unsupported file format");
    }
  }, [stopCamera]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    imageRef,
    mediaType,
    mediaSrc,
    streamActive,
    error,
    startCamera,
    stopCamera,
    handleFileUpload
  };
}
