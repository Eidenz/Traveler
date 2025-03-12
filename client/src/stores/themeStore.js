// client/src/stores/themeStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Check if the user's system prefers dark mode
const getSystemThemePreference = () => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Create the theme store with persistence
const useThemeStore = create(
  persist(
    (set) => ({
      theme: localStorage.getItem('theme') || getSystemThemePreference(),
      
      // Toggle between dark and light mode
      toggleTheme: () => {
        set((state) => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark';
          return { theme: newTheme };
        });
      },
      
      // Set a specific theme
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'theme-storage',
      getStorage: () => localStorage,
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            // Apply the theme to the html element
            if (state.theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
        };
      },
    }
  )
);

// Subscribe to theme changes and update the DOM
useThemeStore.subscribe((state) => {
  if (state.theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
});

export default useThemeStore;