
import en from './en';
import ar from './ar';
import fr from './fr';
import zh from './zh';
import uz from './uz';
import ru from './ru';

export const translations = {
  en,
  ar,
  fr,
  zh,
  uz,
  ru,
};

export type Translation = typeof en;

export const langs = {
    en: { nativeName: 'English' },
    fr: { nativeName: 'Français' },
    zh: { nativeName: '中文' },
    uz: { nativeName: 'Oʻzbekcha' },
    ar: { nativeName: 'العربية', dir: 'rtl' },
    ru: { nativeName: 'Русский' },
};
