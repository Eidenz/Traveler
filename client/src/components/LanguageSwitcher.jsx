// client/src/components/LanguageSwitcher.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import useLanguageStore from '../stores/languageStore';

const LanguageSwitcher = ({ className = '' }) => {
  const { i18n } = useTranslation();
  const { setLanguage } = useLanguageStore();
  
  const changeLanguage = (lng) => {
    setLanguage(lng);
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <button
        className={`p-1.5 rounded-md ${i18n.language === 'en' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        onClick={() => changeLanguage('en')}
      >
        <span className="font-medium text-sm">EN</span>
      </button>
      <button
        className={`p-1.5 rounded-md ${i18n.language === 'fr' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        onClick={() => changeLanguage('fr')}
      >
        <span className="font-medium text-sm">FR</span>
      </button>
    </div>
  );
};

export default LanguageSwitcher;