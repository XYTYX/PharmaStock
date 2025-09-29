import { useLanguage } from '../contexts/LanguageContext';

export default function DispensationsPage() {
  const { t } = useLanguage();
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.dispensations')}</h1>
        <p className="mt-1 text-sm text-gray-500">Manage medicine dispensations to patients</p>
      </div>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-500">Dispensations management coming soon...</p>
      </div>
    </div>
  );
}
