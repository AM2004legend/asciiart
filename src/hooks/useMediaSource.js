import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_IMAGE_SIDE = 2048;

/**
 * Owns the current input: a camera stream, an uploaded video, or an uploaded
 * image. Every request gets an id so a slow request that loses a race (for
 * example a camera prompt answered after a file was dropped) cleans itself up.
 *
 * `startCamera` and `openFile` reject with an Error whose message is ready to
 * show to the person.
 */
export function useMediaSource() {
  const [source, setSource] = useState(null); // { el, kind, facing?, name? }
  const [starting, setStarting] = useState(false);
  const [canFlip, setCanFlip] = useState(false);
  const requestId = useRef(0);
  const current = useRef({ stream: null, url: null, el: null });

  const release = useCallback(() => {
    const { stream, url, el } = current.current;
    stream?.getTracks().forEach((t) => t.stop());
    if (el instanceof HTMLVideoElement) {
      el.pause();
      el.srcObject = null;
      el.removeAttribute('src');
    }
    if (url) URL.revokeObjectURL(url);
    current.current = { stream: null, url: null, el: null };
  }, []);

  /**
   * Opens the camera facing `facing` ('user' = front, 'environment' = back).
   * With `strict`, insists on that side, which some Android browsers otherwise
   * ignore. If switching fails, the previous camera comes back so the picture
   * doesn't freeze, and the error still reaches the caller.
   */
  const startCamera = useCallback(async (facing = 'user', { strict = false } = {}) => {
    const id = ++requestId.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        window.isSecureContext
          ? 'This browser can’t use a camera. Open an image or video instead.'
          : 'Camera access needs a secure page. Open the app on https:// or localhost.',
      );
    }

    setStarting(true);
    const previous = current.current.stream ? current.current.facing : null;
    // Free the current camera first: many phones can't open two at once.
    current.current.stream?.getTracks().forEach((t) => t.stop());
    let switchError = null;
    try {
      let stream;
      try {
        stream = await openCamera(facing, strict);
      } catch (err) {
        if (!previous || id !== requestId.current) throw err;
        switchError = err;
        stream = await openCamera(previous, false);
      }
      if (id !== requestId.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = createVideo();
      video.srcObject = stream;
      await video.play();
      if (id !== requestId.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // Trust what the camera reports over what was asked for. Laptop webcams
      // report nothing, so fall back to the request.
      const asked = switchError ? previous : facing;
      const reported = stream.getVideoTracks()[0]?.getSettings?.().facingMode;
      const actual = reported === 'user' || reported === 'environment' ? reported : asked;

      release();
      current.current = { stream, url: null, el: video, facing: actual };
      setSource({ el: video, kind: 'camera', facing: actual });

      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => setCanFlip(devices.filter((d) => d.kind === 'videoinput').length > 1))
        .catch(() => {});

      if (switchError) {
        throw new Error(
          `Couldn’t switch to the ${facing === 'environment' ? 'back' : 'front'} camera, so the other one stayed on.`,
          { cause: switchError },
        );
      }
    } catch (err) {
      if (switchError && err.cause === switchError) throw err;
      if (id === requestId.current) throw new Error(cameraErrorMessage(err), { cause: err });
    } finally {
      if (id === requestId.current) setStarting(false);
    }
  }, [release]);

  const openFile = useCallback(async (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      throw new Error(`“${file.name}” isn’t an image or video. Try a JPG, PNG, WebP, GIF, MP4 or WebM file.`);
    }

    const id = ++requestId.current;
    setStarting(false);
    const url = URL.createObjectURL(file);
    try {
      const el = isImage ? await loadImage(url) : await loadVideo(url);
      if (id !== requestId.current) {
        URL.revokeObjectURL(url);
        return;
      }
      release();
      // Images were copied into a canvas, so their URL can go right away.
      if (isImage) URL.revokeObjectURL(url);
      current.current = { stream: null, url: isImage ? null : url, el };
      setSource({ el, kind: isImage ? 'image' : 'video', name: file.name });
    } catch (err) {
      URL.revokeObjectURL(url);
      throw new Error(
        `Couldn’t open “${file.name}”. The file may be damaged or in a format this browser can’t play.`,
        { cause: err },
      );
    }
  }, [release]);

  const close = useCallback(() => {
    requestId.current++;
    release();
    setSource(null);
    setStarting(false);
  }, [release]);

  useEffect(() => release, [release]);

  return { source, starting, canFlip, startCamera, openFile, close };
}

async function openCamera(facing, strict) {
  const request = (facingMode) => navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  if (strict) {
    try {
      return await request({ exact: facing });
    } catch (err) {
      // No camera on that side: let the browser pick the closest one.
      if (err?.name !== 'OverconstrainedError') throw err;
    }
  }
  return request(facing);
}

function createVideo() {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  return video;
}

async function loadVideo(url) {
  const video = createVideo();
  video.loop = true;
  video.src = url;
  await video.play();
  return video;
}

// Draw into a canvas: applies EXIF orientation and caps very large photos,
// which would otherwise exceed GPU texture limits on many devices.
async function loadImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cameraErrorMessage(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access is blocked. Allow it from the icon in your address bar, or open an image instead.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found. Connect one, or open an image or video instead.';
    case 'NotReadableError':
      return 'Your camera is being used by another app. Close it there and try again.';
    default:
      return 'The camera didn’t start. Try again, or open an image or video instead.';
  }
}
