// client/src/stores/onlineStore.js
// Single source of truth for "are we online". navigator.onLine is only a
// hint — it reports true on captive portals (hotel/airport wifi), where the
// interface is up but nothing is reachable. Actual API request outcomes are
// authoritative: any response from the backend (even a 4xx/5xx) proves
// reachability, and a no-response network failure proves the opposite. The
// axios interceptors in services/api.js feed those outcomes in.
//
// Components subscribe with `useOnlineStore((s) => s.isOnline)`;
// non-component code (async fetchers, stores) calls the `isOnline()` getter.

import { create } from 'zustand';

const useOnlineStore = create((set) => ({
  isOnline: navigator.onLine,
  setOnline: (isOnline) => set({ isOnline }),
}));

// Browser events remain useful hints: 'offline' is trustworthy (the
// interface went down), 'online' is optimistic (the next failed request
// flips it back).
window.addEventListener('online', () => useOnlineStore.getState().setOnline(true));
window.addEventListener('offline', () => useOnlineStore.getState().setOnline(false));

export const isOnline = () => useOnlineStore.getState().isOnline;

/** A request reached the backend (any HTTP response counts). */
export const noteBackendReachable = () => useOnlineStore.getState().setOnline(true);

/** A request died without any response (network error / timeout). */
export const noteNetworkFailure = () => useOnlineStore.getState().setOnline(false);

export default useOnlineStore;
