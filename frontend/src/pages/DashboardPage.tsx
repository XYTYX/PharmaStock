import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { inventoryApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  CubeIcon, 
  ExclamationTriangleIcon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: inventorySummary, isLoading } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: inventoryApi.getInventorySummary,
  });

  const { data: inventoryLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['inventory-logs-recent', currentPage],
    queryFn: () => inventoryApi.getInventoryLogs({ 
      page: currentPage.toString(), 
      limit: itemsPerPage.toString() 
    }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">{t('dashboard.loading')}</div>
      </div>
    );
  }

  const stats = [
    {
      name: t('dashboard.totalItems'),
      value: inventorySummary?.totalItems || 0,
      change: t('dashboard.totalItemsDesc'),
      icon: CubeIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: t('dashboard.totalStock'),
      value: inventorySummary?.totalInventory || 0,
      change: t('dashboard.totalStockDesc'),
      icon: ChartBarIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: t('dashboard.recentMovementsTitle'),
      value: inventoryLogs?.logs?.length || 0,
      change: t('dashboard.recentMovementsDesc'),
      icon: ExclamationTriangleIcon,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
  ];

  const recentLogs = inventoryLogs?.logs || [];
  const pagination = inventoryLogs?.pagination;
  const totalPages = pagination?.pages || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className={`h-6 w-6 ${stat.color}`} aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className={`text-2xl font-semibold ${stat.color}`}>
                        {stat.value}
                      </div>
                      <div className="ml-2 text-sm text-gray-500">
                        {stat.change}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {t('dashboard.recentMovements')}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {t('dashboard.recentMovementsSubtitle')}
              </p>
            </div>
            {pagination && (
              <div className="text-sm text-gray-500">
                Page {currentPage} of {totalPages} ({pagination.total} total movements)
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-gray-200">
          {logsLoading ? (
            <div className="px-4 py-8 text-center">
              <div className="text-sm text-gray-500">{t('dashboard.loading')}</div>
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-sm text-gray-500">No recent movements found</div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {recentLogs.map((log: any) => (
                <li key={log.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          log.reason === 'PURCHASE' ? 'bg-green-100' :
                          log.reason === 'DISPENSATION' ? 'bg-blue-100' :
                          log.reason === 'ADJUSTMENT' ? 'bg-yellow-100' :
                          log.reason === 'DISPOSE' ? 'bg-orange-100' :
                          'bg-gray-100'
                        }`}>
                          <span className={`text-xs font-medium ${
                            log.reason === 'PURCHASE' ? 'text-green-800' :
                            log.reason === 'DISPENSATION' ? 'text-blue-800' :
                            log.reason === 'ADJUSTMENT' ? 'text-yellow-800' :
                            log.reason === 'DISPOSE' ? 'text-orange-800' :
                            'text-gray-800'
                          }`}>
                            {log.reason?.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {log.item?.name || 'Article supprimé'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {log.reason} - {log.totalAmount} {t('common.units')}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          pageNum === currentPage
                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}