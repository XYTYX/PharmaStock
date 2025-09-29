import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../services/api';
import { 
  CurrencyDollarIcon, 
  CubeIcon, 
  ExclamationTriangleIcon,
  ShoppingCartIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

export default function DashboardPage() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: reportsApi.getDashboardData,
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
      name: "Today's Sales",
      value: `$${dashboardData?.dashboard?.todaySales?.finalAmount?.toFixed(2) || '0.00'}`,
      change: `${dashboardData?.dashboard?.todaySales?.count || 0} transactions`,
      icon: CurrencyDollarIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Total Products',
      value: dashboardData?.dashboard?.inventory?.totalProducts || 0,
      change: 'Active inventory',
      icon: CubeIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Low Stock Alert',
      value: dashboardData?.dashboard?.inventory?.lowStockProducts || 0,
      change: 'Items need restocking',
      icon: ExclamationTriangleIcon,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      name: 'Pending Orders',
      value: dashboardData?.dashboard?.inventory?.pendingOrders || 0,
      change: 'Awaiting approval',
      icon: ShoppingCartIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your pharmacy inventory management system
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6">
            <dt>
              <div className={`absolute rounded-md p-3 ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">{stat.name}</p>
            </dt>
            <dd className="ml-16 flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              <p className="ml-2 text-sm text-gray-500">{stat.change}</p>
            </dd>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Sales */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Sales</h3>
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {dashboardData?.dashboard?.recentSales?.map((sale: any) => (
                  <li key={sale.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CurrencyDollarIcon className="h-4 w-4 text-green-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {sale.customerName || 'Walk-in Customer'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {sale.saleNumber} • {new Date(sale.saleDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-sm text-gray-500">
                        ${sale.finalAmount.toFixed(2)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Recent Inventory Changes */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Inventory Changes</h3>
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {dashboardData?.dashboard?.recentInventoryLogs?.map((log: any) => (
                  <li key={log.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <ChartBarIcon className="h-4 w-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {log.product?.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {log.type} • {log.quantity > 0 ? '+' : ''}{log.quantity}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-sm text-gray-500">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
