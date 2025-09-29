import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../services/api';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  const { data, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.getProduct(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!data?.product) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Product not found</h3>
        <p className="mt-1 text-sm text-gray-500">The product you're looking for doesn't exist.</p>
      </div>
    );
  }

  const product = data.product;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
        <p className="mt-1 text-sm text-gray-500">Product details and inventory history</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Product Info */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Product Information</h3>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">SKU</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.sku}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Barcode</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.barcode || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Category</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.category?.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Supplier</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.supplier?.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Unit Price</dt>
                <dd className="mt-1 text-sm text-gray-900">${product.unitPrice.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Selling Price</dt>
                <dd className="mt-1 text-sm text-gray-900">${product.sellingPrice.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Cost Price</dt>
                <dd className="mt-1 text-sm text-gray-900">${product.costPrice.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Unit</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.unit}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Prescription Required</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {product.isPrescription ? 'Yes' : 'No'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Refrigeration Required</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {product.requiresRefrigerator ? 'Yes' : 'No'}
                </dd>
              </div>
            </dl>
            {product.description && (
              <div className="mt-6">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.description}</dd>
              </div>
            )}
          </div>
        </div>

        {/* Stock Info */}
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Information</h3>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Current Stock</dt>
                <dd className={`mt-1 text-2xl font-bold ${
                  product.currentStock <= product.minStockLevel 
                    ? 'text-red-600' 
                    : 'text-gray-900'
                }`}>
                  {product.currentStock} {product.unit}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Minimum Stock Level</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.minStockLevel} {product.unit}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Maximum Stock Level</dt>
                <dd className="mt-1 text-sm text-gray-900">{product.maxStockLevel} {product.unit}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Stock Value</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  ${(product.currentStock * product.costPrice).toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full btn btn-primary btn-sm">
                Adjust Stock
              </button>
              <button className="w-full btn btn-outline btn-sm">
                Create Purchase Order
              </button>
              <button className="w-full btn btn-outline btn-sm">
                View Sales History
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Inventory Logs */}
      {product.inventoryLogs && product.inventoryLogs.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Inventory Activity</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr className="table-row">
                  <th className="table-head">Date</th>
                  <th className="table-head">Type</th>
                  <th className="table-head">Quantity</th>
                  <th className="table-head">Previous Stock</th>
                  <th className="table-head">New Stock</th>
                  <th className="table-head">User</th>
                  <th className="table-head">Reference</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {product.inventoryLogs.map((log: any) => (
                  <tr key={log.id} className="table-row">
                    <td className="table-cell text-sm text-gray-900">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {log.type}
                      </span>
                    </td>
                    <td className="table-cell text-sm text-gray-900">
                      {log.quantity > 0 ? '+' : ''}{log.quantity}
                    </td>
                    <td className="table-cell text-sm text-gray-900">{log.previousStock}</td>
                    <td className="table-cell text-sm text-gray-900">{log.newStock}</td>
                    <td className="table-cell text-sm text-gray-900">
                      {log.user?.firstName} {log.user?.lastName}
                    </td>
                    <td className="table-cell text-sm text-gray-900">{log.reference || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
