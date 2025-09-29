import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation keys
const translations = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.products': 'Products',
    'nav.categories': 'Categories',
    'nav.suppliers': 'Suppliers',
    'nav.purchaseOrders': 'Purchase Orders',
    'nav.dispensations': 'Dispensations',
    'nav.medicationAvailability': 'Medication Availability',
    'nav.currentStock': 'Current Stock',
    'nav.dispensationTracking': 'Dispensation Tracking',
    'nav.inventory': 'Inventory',
    'nav.reports': 'Reports',
    'nav.users': 'Users',
    
    // Common
    'common.welcome': 'Welcome',
    'common.signOut': 'Sign out',
    'common.language': 'Language',
    'common.english': 'English',
    'common.french': 'Français',
    
    // App title
    'app.title': 'Hospital Pharmacy Management',
    
    // Login
    'login.title': 'Hospital Pharmacy Management',
    'login.subtitle': 'Sign in to your account',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.signIn': 'Sign in',
    'login.signingIn': 'Signing in...',
    'login.credentials': 'Default login credentials:',
  },
  fr: {
    // Navigation
    'nav.dashboard': 'Tableau de bord',
    'nav.products': 'Produits',
    'nav.categories': 'Catégories',
    'nav.suppliers': 'Fournisseurs',
    'nav.purchaseOrders': 'Commandes d\'achat',
    'nav.dispensations': 'Dispensations',
    'nav.medicationAvailability': 'Disponibilité Médicaments',
    'nav.currentStock': 'Stock Actuel',
    'nav.dispensationTracking': 'Suivi Dispensations',
    'nav.inventory': 'Inventaire',
    'nav.reports': 'Rapports',
    'nav.users': 'Utilisateurs',
    
    // Common
    'common.welcome': 'Bienvenue',
    'common.signOut': 'Se déconnecter',
    'common.language': 'Langue',
    'common.english': 'English',
    'common.french': 'Français',
    
    // App title
    'app.title': 'Gestion de Pharmacie Hospitalière',
    
    // Login
    'login.title': 'Gestion de Pharmacie Hospitalière',
    'login.subtitle': 'Connectez-vous à votre compte',
    'login.username': 'Nom d\'utilisateur',
    'login.password': 'Mot de passe',
    'login.signIn': 'Se connecter',
    'login.signingIn': 'Connexion...',
    'login.credentials': 'Identifiants de connexion par défaut:',
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'fr';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations[typeof language]] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
