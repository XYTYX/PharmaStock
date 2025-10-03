import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

// Utility function to format dates in European format (dd/mm/yyyy) with time (hh:mm)
const formatEuropeanDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};


export default function DispensationTrackingPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // All users can delete actions
  const canDelete = true;
  
  // Calculate date range for last month inclusive of today
  const getLastMonthDateRange = () => {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    
    return {
      dateFrom: oneMonthAgo.toISOString().split('T')[0],
      dateTo: today.toISOString().split('T')[0]
    };
  };

  const [filter, setFilter] = useState({
    search: '',
    reason: '',
    dateFrom: '',
    dateTo: ''
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20
  });

  // Set initial date range on component mount
  useEffect(() => {
    const dateRange = getLastMonthDateRange();
    setFilter(prev => ({
      ...prev,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo
    }));
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [filter.search, filter.reason, filter.dateFrom, filter.dateTo]);

  const { data: inventoryLogs, isLoading, error } = useQuery({
    queryKey: ['inventory-logs', filter, pagination],
    queryFn: () => {
      // Add end-of-day time to endDate to include the full day
      const endDate = filter.dateTo ? new Date(filter.dateTo + 'T23:59:59.999Z').toISOString() : undefined;
      
      return inventoryApi.getInventoryLogs({
        search: filter.search,
        reason: filter.reason || undefined,
        startDate: filter.dateFrom || undefined,
        endDate: endDate,
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  // Fetch current stock to check item status
  const { data: stockData } = useQuery({
    queryKey: ['current-stock-all'],
    queryFn: () => inventoryApi.getCurrentStock({ limit: 1000 })
  });

  // Fetch total counts for summary cards (without pagination)
  const { data: totalCounts } = useQuery({
    queryKey: ['inventory-logs-totals', filter],
    queryFn: () => {
      const endDate = filter.dateTo ? new Date(filter.dateTo + 'T23:59:59.999Z').toISOString() : undefined;
      
      return inventoryApi.getInventoryLogs({
        search: filter.search,
        reason: filter.reason || undefined,
        startDate: filter.dateFrom || undefined,
        endDate: endDate,
        limit: '1000' // Get a large number to count all
      });
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  const logs = inventoryLogs?.logs || [];
  const totalLogs = totalCounts?.logs || [];

  // Check if an item can be deleted (i.e., if it's still active and is a dispensation)
  const canDeleteItem = (log: any) => {
    if (!stockData?.inventory || !log.item?.id) return false;
    if (log.reason !== 'DISPENSATION') return false;
    
    const currentItem = stockData.inventory.find((inv: any) => inv.item?.id === log.item.id);
    return currentItem?.item?.isActive === true;
  };

  // Delete mutation
  const deleteLogMutation = useMutation({
    mutationFn: async (log: any) => {
      return inventoryApi.deleteInventoryLog(log.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-logs'] });
      queryClient.invalidateQueries({ queryKey: ['current-stock-all'] });
      alert(t('dispensation.deleteSuccess'));
    },
    onError: (error) => {
      console.error('Error deleting log:', error);
      alert(t('dispensation.deleteError'));
    }
  });

  const handleDeleteLog = (log: any) => {
    const actionType = log.reason === 'DISPENSATION' ? t('dispensation.dispensation') : 
                      log.reason === 'PURCHASE' ? t('dispensation.purchase') :
                      log.reason === 'ADJUSTMENT' ? t('dispensation.adjustment') :
                      log.reason === 'DISPOSE' ? t('dispensation.dispose') :
                      log.reason;
    
    const confirmMessage = t('dispensation.confirmDelete')
        .replace('{actionType}', actionType)
        .replace('{quantity}', Math.abs(log.totalAmount).toString())
        .replace('{itemName}', log.item?.name || 'Unknown Item');

    if (window.confirm(confirmMessage)) {
      deleteLogMutation.mutate(log);
    }
  };

  const getTypeBadge = (reason: string) => {
    const colors = {
      PURCHASE: 'bg-green-100 text-green-800',
      DISPENSATION: 'bg-blue-100 text-blue-800',
      ADJUSTMENT: 'bg-yellow-100 text-yellow-800',
      DISPOSE: 'bg-orange-100 text-orange-800'
    };

    const getTypeLabel = (reason: string) => {
      switch (reason) {
        case 'PURCHASE': return t('dispensation.purchase');
        case 'DISPENSATION': return t('dispensation.dispensation');
        case 'ADJUSTMENT': return t('dispensation.adjustment');
        case 'DISPOSE': return t('dispensation.dispose');
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
            {totalLogs.filter((log: any) => log.reason === 'PURCHASE').length}
          </div>
          <div className="text-sm text-gray-500">{t('dispensation.purchases')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">
            {totalLogs.filter((log: any) => log.reason === 'DISPENSATION').length}
          </div>
          <div className="text-sm text-gray-500">{t('dispensation.dispensations')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {totalLogs.filter((log: any) => log.reason === 'ADJUSTMENT').length}
          </div>
          <div className="text-sm text-gray-500">{t('dispensation.adjustments')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">
            {totalLogs.filter((log: any) => log.reason === 'EXPIRED' || log.reason === 'DAMAGED').length}
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
              <option value="DISPOSE">{t('dispensation.dispose')}</option>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs">
                    {t('dispensation.notes')}
                  </th>
                  {canDelete && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('dispensation.actions')}
                    </th>
                  )}
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatEuropeanDateTime(log.createdAt)}
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
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    <div className="max-h-20 overflow-y-auto">
                      {log.notes || '-'}
                    </div>
                  </td>
                  {canDelete && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDeleteLog(log)}
                        disabled={deleteLogMutation.isPending || !canDeleteItem(log)}
                        className={`${
                          canDeleteItem(log) 
                            ? 'text-red-600 hover:text-red-900' 
                            : 'text-gray-400 cursor-not-allowed'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={
                          canDeleteItem(log) 
                            ? t('dispensation.deleteTooltip')
                            : t('dispensation.cannotDelete')
                        }
                      >
                        {t('dispensation.delete')}
                      </button>
                    </td>
                  )}
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

      {/* Pagination */}
      {inventoryLogs?.pagination && inventoryLogs.pagination.pages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= inventoryLogs.pagination.pages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {(pagination.page - 1) * pagination.limit + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, inventoryLogs.pagination.total)}
                </span>{' '}
                of{' '}
                <span className="font-medium">{inventoryLogs.pagination.total}</span>{' '}
                results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, inventoryLogs.pagination.pages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(inventoryLogs.pagination.pages - 4, pagination.page - 2)) + i;
                  if (pageNum > inventoryLogs.pagination.pages) return null;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pageNum === pagination.page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= inventoryLogs.pagination.pages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}