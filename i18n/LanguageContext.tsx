import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { translations, Translation, langs } from './locales';

type Language = keyof typeof translations;

interface LanguageContextType {
  language: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: keyof Translation, replacements?: Record<string, string>) => string;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr');

  useEffect(() => {
    // FIX: Property 'dir' does not exist on all language configurations.
    // Added a type assertion to safely access the optional 'dir' property.
    const newDir = (langs[language] as { dir?: 'rtl' | 'ltr' }).dir || 'ltr';
    setDir(newDir);
    document.documentElement.dir = newDir;
  }, [language]);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
  };

  const t = (key: keyof Translation, replacements?: Record<string, string>): string => {
    let translation = translations[language][key] || translations['en'][key];
    if (translation && replacements) {
        Object.keys(replacements).forEach(rKey => {
            translation = translation.replace(new RegExp(`\\{${rKey}\\}`, 'g'), replacements[rKey]);
        });
    }
    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};