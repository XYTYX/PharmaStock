import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../store/authStore';

interface ReconciliationItem {
  id: string;
  item: {
    id: string;
    name: string;
    form: string;
    expiryDate: string;
  };
  currentStock: number;
  actualStock: number;
  adjustment: number;
}

export default function ReconciliationPage() {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [reconciliationData, setReconciliationData] = useState<ReconciliationItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if current user is admin
  const isAdmin = user?.role === 'ADMIN';

  // Function to translate form values
  const translateForm = (form: string) => {
    const formMap: { [key: string]: string } = {
      'CAPSULE': t('inventory.form.capsule'),
      'TABLET': t('inventory.form.tablet'),
      'GEL': t('inventory.form.gel'),
      'EYE_DROPS': t('inventory.form.eyeDrops'),
      'POWDER': t('inventory.form.powder'),
      'CREAM': t('inventory.form.cream')
    };
    return formMap[form] || form;
  };

  // Function to convert MM-YYYY format to comparable date
  const parseExpiryDate = (dateStr: string) => {
    if (!dateStr) return new Date(0); // Return epoch for null/empty dates
    const [month, year] = dateStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, 1); // Month is 0-indexed
  };

  // Function to check if a medication is expired
  const isExpired = (dateStr: string) => {
    if (!dateStr) return false;
    const expiryDate = parseExpiryDate(dateStr);
    const currentDate = new Date();
    // Set current date to first day of current month for comparison
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return expiryDate < currentMonth;
  };

  // Fetch all inventory data
  const { data: stockData, isLoading, error } = useQuery({
    queryKey: ['current-stock-all'],
    queryFn: () => inventoryApi.getCurrentStock({ limit: 1000 }) // Get all items
  });

  // Initialize reconciliation data when stock data is loaded
  useMemo(() => {
    if (stockData?.inventory) {
      const initialData = stockData.inventory.map((item: any) => ({
        id: item.id,
        item: {
          id: item.item?.id || '',
          name: item.item?.name || 'Article supprimé',
          form: item.item?.form || '',
          expiryDate: item.item?.expiryDate || ''
        },
        currentStock: item.currentStock || 0,
        actualStock: item.currentStock || 0, // Initialize with current stock
        adjustment: 0 // Will be calculated
      }));
      setReconciliationData(initialData);
    }
  }, [stockData]);

  // Calculate adjustment for each item
  const reconciliationItems = useMemo(() => {
    return reconciliationData.map(item => ({
      ...item,
      adjustment: item.actualStock - item.currentStock
    }));
  }, [reconciliationData]);

  // Update actual stock for an item
  const updateActualStock = (itemId: string, actualStock: number) => {
    setReconciliationData(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { ...item, actualStock: Math.max(0, actualStock) }
          : item
      )
    );
  };

  // Submit reconciliation
  const submitReconciliation = async () => {
    setIsSubmitting(true);
    try {
      // Filter items that have adjustments (actual stock different from current stock)
      const itemsToUpdate = reconciliationItems.filter(item => item.adjustment !== 0);
      
      if (itemsToUpdate.length === 0) {
        alert(t('reconciliation.noAdjustments'));
        return;
      }

      // Submit each adjustment as a separate API call
      const updatePromises = itemsToUpdate.map(item => 
        inventoryApi.updateItemStock(item.item.id, item.actualStock)
      );

      await Promise.all(updatePromises);
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['current-stock-all'] });
      
      alert(t('reconciliation.submittedSuccessfully'));
    } catch (error) {
      console.error('Error submitting reconciliation:', error);
      alert(t('reconciliation.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect if not admin
  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <div className="text-lg font-medium text-red-600">{t('reconciliation.accessDenied')}</div>
        <div className="text-sm text-gray-500 mt-2">{t('reconciliation.adminOnly')}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">{t('inventory.loading')}</div>
      </div>
    );
  }

  if (error) {
    console.error('Error loading inventory data:', error);
    return (
      <div className="text-red-600 text-center py-8">
        <div className="text-lg font-medium">{t('inventory.error')}</div>
        <div className="text-sm mt-2">
          {error instanceof Error ? error.message : 'Unknown error occurred'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reconciliation.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('reconciliation.subtitle')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">
            {reconciliationItems.length}
          </div>
          <div className="text-sm text-gray-500">{t('reconciliation.totalItems')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">
            {reconciliationItems.reduce((sum, item) => sum + item.currentStock, 0)}
          </div>
          <div className="text-sm text-gray-500">{t('reconciliation.totalCurrentStock')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {reconciliationItems.reduce((sum, item) => sum + item.actualStock, 0)}
          </div>
          <div className="text-sm text-gray-500">{t('reconciliation.totalActualStock')}</div>
        </div>
      </div>

      {/* Reconciliation Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inventory.item')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inventory.form')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inventory.expiryDate')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('reconciliation.currentQuantity')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('reconciliation.actualQuantity')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('reconciliation.adjustment')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reconciliationItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {item.item.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.item.form ? translateForm(item.item.form) : '-'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                    isExpired(item.item.expiryDate) 
                      ? 'bg-red-100 text-red-600 font-medium' 
                      : 'text-gray-900'
                  }`}>
                    {item.item.expiryDate || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="font-medium">{item.currentStock}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      min="0"
                      value={item.actualStock}
                      onChange={(e) => updateActualStock(item.id, parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-medium ${
                      item.adjustment > 0 
                        ? 'text-green-600' 
                        : item.adjustment < 0 
                        ? 'text-red-600' 
                        : 'text-gray-900'
                    }`}>
                      {item.adjustment > 0 ? '+' : ''}{item.adjustment}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {reconciliationItems.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {t('reconciliation.noItems')}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          onClick={submitReconciliation}
          disabled={isSubmitting}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('reconciliation.submitting') : t('reconciliation.submit')}
        </button>
      </div>
    </div>
  );
}
