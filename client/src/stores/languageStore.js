// client/src/stores/languageStore.js
import { create } from 'zustand';
import i18n from '../i18n';

const useLanguageStore = create((set) => ({
  language: localStorage.getItem('language') || 'en',
  
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    localStorage.setItem('language', language);
    set({ language });
  }
}));

export default useLanguageStore;