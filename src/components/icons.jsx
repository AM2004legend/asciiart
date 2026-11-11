// Minimal 20px stroke icons. Decorative: buttons carry their own labels.
function Icon({ children }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const CameraIcon = () => (
  <Icon><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.5" /></Icon>
);
export const FlipIcon = () => (
  <Icon><path d="M4 12a8 8 0 0 1 14-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 15" /><path d="M4 20v-5h5" /></Icon>
);
export const FileIcon = () => (
  <Icon><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M12 17v-6" /><path d="m9 14 3-3 3 3" /></Icon>
);
export const PauseIcon = () => (
  <Icon><path d="M9 5v14" /><path d="M15 5v14" /></Icon>
);
export const PlayIcon = () => (
  <Icon><path d="M7 4.5v15l12-7.5z" /></Icon>
);
export const CopyIcon = () => (
  <Icon><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Icon>
);
export const SaveIcon = () => (
  <Icon><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></Icon>
);
export const SlidersIcon = () => (
  <Icon><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" /></Icon>
);
export const CloseIcon = () => (
  <Icon><path d="M6 6l12 12" /><path d="M18 6 6 18" /></Icon>
);
