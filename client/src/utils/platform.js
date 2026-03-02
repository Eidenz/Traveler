// Detect Capacitor native via the bridge global (avoids importing @capacitor/core
// at the top level, which can interfere with Vite's dev module resolution).
export const isNative = () => {
  if (typeof window === 'undefined') return false;
  // Primary: Capacitor bridge global
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch { /* ignore */ }
  // Fallback: protocol/host detection (https://localhost with no port = Capacitor WebView)
  return window.location.protocol === 'https:' &&
    window.location.hostname === 'localhost' &&
    !window.location.port;
};

export const getBackendUrl = () => {
  if (isNative()) {
    return import.meta.env.VITE_BACKEND_URL || '';
  }
  return import.meta.env.VITE_BASE_URL || '';
};
