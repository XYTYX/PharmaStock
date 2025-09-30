import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';


export default function DispensationTrackingPage() {
  const { t } = useLanguage();
  
  // Calculate date range for last two months inclusive of today
  const getLastTwoMonthsDateRange = () => {
    const today = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);
    
    return {
      dateFrom: twoMonthsAgo.toISOString().split('T')[0],
      dateTo: today.toISOString().split('T')[0]
    };
  };

  const [filter, setFilter] = useState({
    search: '',
    reason: '',
    dateFrom: '',
    dateTo: ''
  });

  // Set initial date range on component mount
  useEffect(() => {
    const dateRange = getLastTwoMonthsDateRange();
    setFilter(prev => ({
      ...prev,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo
    }));
  }, []);

  const { data: inventoryLogs, isLoading, error } = useQuery({
    queryKey: ['inventory-logs', filter],
    queryFn: () => {
      // Add end-of-day time to endDate to include the full day
      const endDate = filter.dateTo ? new Date(filter.dateTo + 'T23:59:59.999Z').toISOString() : undefined;
      
      return inventoryApi.getInventoryLogs({
        search: filter.search,
        reason: filter.reason || undefined,
        startDate: filter.dateFrom || undefined,
        endDate: endDate
      });
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  const logs = inventoryLogs?.logs || [];

  const getTypeBadge = (reason: string) => {
    const colors = {
      PURCHASE: 'bg-green-100 text-green-800',
      DISPENSATION: 'bg-blue-100 text-blue-800',
      ADJUSTMENT: 'bg-yellow-100 text-yellow-800',
      TRANSFER: 'bg-purple-100 text-purple-800',
      EXPIRED: 'bg-red-100 text-red-800',
      DAMAGED: 'bg-red-100 text-red-800',
      RETURN: 'bg-gray-100 text-gray-800'
    };

    const getTypeLabel = (reason: string) => {
      switch (reason) {
        case 'PURCHASE': return t('dispensation.purchase');
        case 'DISPENSATION': return t('dispensation.dispensation');
        case 'ADJUSTMENT': return t('dispensation.adjustment');
        case 'TRANSFER': return t('dispensation.transfer');
        case 'EXPIRED': return t('dispensation.expired');
        case 'DAMAGED': return t('dispensation.damaged');
        case 'RETURN': return t('dispensation.return');
        default: return reason;
      }
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[reason as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {getTypeLabel(reason)}
      </span>
    );
  };

  const getQuantityDisplay = (quantity: number) => {
    return quantity > 0 ? `+${quantity}` : quantity.toString();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">{t('dispensation.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center py-8">
        {t('dispensation.error')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.dispensationTracking')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('dispensation.subtitle')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {logs.filter((log: any) => log.reason === 'PURCHASE').length}
          </div>
          <div className="text-sm text-gray-500">{t('dispensation.purchases')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">
            {logs.filter((log: any) => log.reason === 'DISPENSATION').length}
          </div>
          <div className="text-sm text-gray-500">{t('dispensation.dispensations')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {logs.filter((log: any) => log.reason === 'ADJUSTMENT').length}
          </div>
          <div className="text-sm text-gray-500">{t('dispensation.adjustments')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">
            {logs.filter((log: any) => log.reason === 'EXPIRED' || log.reason === 'DAMAGED').length}
          </div>
          <div className="text-sm text-gray-500">{t('dispensation.losses')}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('dispensation.search')}
            </label>
            <input
              type="text"
              placeholder={t('dispensation.searchPlaceholder')}
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('dispensation.movementType')}
            </label>
            <select
              value={filter.reason}
              onChange={(e) => setFilter({ ...filter, reason: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('dispensation.allTypes')}</option>
              <option value="PURCHASE">{t('dispensation.purchase')}</option>
              <option value="DISPENSATION">{t('dispensation.dispensation')}</option>
              <option value="ADJUSTMENT">{t('dispensation.adjustment')}</option>
              <option value="TRANSFER">{t('dispensation.transfer')}</option>
              <option value="EXPIRED">{t('dispensation.expired')}</option>
              <option value="DAMAGED">{t('dispensation.damaged')}</option>
              <option value="RETURN">{t('dispensation.return')}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('dispensation.dateFrom')}
            </label>
            <input
              type="date"
              value={filter.dateFrom}
              onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('dispensation.dateTo')}
            </label>
            <input
              type="date"
              value={filter.dateTo}
              onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('dispensation.date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('dispensation.item')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('dispensation.type')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('dispensation.quantity')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('dispensation.user')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('dispensation.notes')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {log.item?.name || 'Article supprimé'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getTypeBadge(log.reason)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      log.totalAmount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {getQuantityDisplay(log.totalAmount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.user?.firstName} {log.user?.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {logs.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {t('dispensation.noMovements')}
          </div>
        )}
      </div>
    </div>
  );
}