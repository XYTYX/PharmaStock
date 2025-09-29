import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '../services/api';
import { 
  CubeIcon, 
  ExclamationTriangleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { data: inventorySummary, isLoading } = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: inventoryApi.getInventorySummary,
  });

  const { data: inventoryLogs } = useQuery({
    queryKey: ['inventory-logs-recent'],
    queryFn: () => inventoryApi.getInventoryLogs({ limit: 10 }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Items',
      value: inventorySummary?.totalItems || 0,
      change: 'Active inventory',
      icon: CubeIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Total Stock',
      value: inventorySummary?.totalInventory || 0,
      change: 'Units in stock',
      icon: ChartBarIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Recent Movements',
      value: inventoryLogs?.logs?.length || 0,
      change: 'Last 10 movements',
      icon: ExclamationTriangleIcon,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
  ];

  const recentLogs = inventoryLogs?.logs || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vue d'ensemble de l'inventaire pharmaceutique
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
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Mouvements récents
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Derniers mouvements d'inventaire
          </p>
        </div>
        <div className="border-t border-gray-200">
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
                        'bg-gray-100'
                      }`}>
                        <span className={`text-xs font-medium ${
                          log.reason === 'PURCHASE' ? 'text-green-800' :
                          log.reason === 'DISPENSATION' ? 'text-blue-800' :
                          log.reason === 'ADJUSTMENT' ? 'text-yellow-800' :
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
                        {log.reason} - {log.totalAmount} unités
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
        </div>
      </div>
    </div>
  );
}