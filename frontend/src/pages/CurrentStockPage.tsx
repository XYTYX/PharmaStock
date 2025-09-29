import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { productsApi } from '../services/api';
import { Product } from '../types';

const medicineTypeLabels = {
  TABLET: 'Comprimé',
  GEL_CAPSULE: 'Gélule',
  CAPSULE: 'Capsule',
  GEL: 'Gel',
  EYE_DROPS: 'Gouttes oculaires'
};

export default function CurrentStockPage() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState({
    search: '',
    medicineType: '',
    stockLevel: 'all'
  });

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products', filter],
    queryFn: () => productsApi.getProducts({
      search: filter.search,
      medicineType: filter.medicineType || undefined,
      isActive: true // Only show active products
    })
  });

  const filteredProducts = products?.data || [];

  const getStockLevel = (currentStock: number) => {
    if (currentStock === 0) {
      return { level: 'out', color: 'red', text: 'Rupture de stock' };
    } else if (currentStock <= 10) {
      return { level: 'low', color: 'yellow', text: 'Stock faible' };
    } else if (currentStock <= 50) {
      return { level: 'medium', color: 'blue', text: 'Stock moyen' };
    } else {
      return { level: 'high', color: 'green', text: 'Stock élevé' };
    }
  };

  const getExpiryStatus = (expiryDate?: string) => {
    if (!expiryDate) return { status: 'unknown', color: 'gray' };
    
    const [month, year] = expiryDate.split('-');
    const expiry = new Date(parseInt(year), parseInt(month) - 1);
    const now = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(now.getMonth() + 6);
    
    if (expiry < now) {
      return { status: 'expired', color: 'red' };
    } else if (expiry < sixMonthsFromNow) {
      return { status: 'expiring', color: 'yellow' };
    } else {
      return { status: 'good', color: 'green' };
    }
  };

  const filteredByStock = filteredProducts.filter((product: Product) => {
    if (filter.stockLevel === 'all') return true;
    const stockLevel = getStockLevel(product.currentStock);
    return stockLevel.level === filter.stockLevel;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center py-8">
        Erreur lors du chargement du stock
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock Actuel</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vue d'ensemble du stock actuel de tous les médicaments
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">
            {filteredProducts.length}
          </div>
          <div className="text-sm text-gray-500">Médicaments actifs</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">
            {filteredProducts.filter((p: Product) => getStockLevel(p.currentStock).level === 'out').length}
          </div>
          <div className="text-sm text-gray-500">Ruptures de stock</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {filteredProducts.filter((p: Product) => getStockLevel(p.currentStock).level === 'low').length}
          </div>
          <div className="text-sm text-gray-500">Stock faible</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {filteredProducts.filter((p: Product) => {
              const expiryStatus = getExpiryStatus(p.expiryDate);
              return expiryStatus.status === 'expiring' || expiryStatus.status === 'expired';
            }).length}
          </div>
          <div className="text-sm text-gray-500">Expire bientôt/Expiré</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rechercher
            </label>
            <input
              type="text"
              placeholder="Nom du médicament ou ID interne..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de médicament
            </label>
            <select
              value={filter.medicineType}
              onChange={(e) => setFilter({ ...filter, medicineType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les types</option>
              <option value="TABLET">Comprimé</option>
              <option value="GEL_CAPSULE">Gélule</option>
              <option value="CAPSULE">Capsule</option>
              <option value="GEL">Gel</option>
              <option value="EYE_DROPS">Gouttes oculaires</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Niveau de stock
            </label>
            <select
              value={filter.stockLevel}
              onChange={(e) => setFilter({ ...filter, stockLevel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous les niveaux</option>
              <option value="out">Rupture de stock</option>
              <option value="low">Stock faible</option>
              <option value="medium">Stock moyen</option>
              <option value="high">Stock élevé</option>
            </select>
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
                  ID Interne
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock actuel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Niveau
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date d'expiration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix unitaire
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredByStock.map((product: Product) => {
                const stockLevel = getStockLevel(product.currentStock);
                const expiryStatus = getExpiryStatus(product.expiryDate);
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {product.internalId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      {product.description && (
                        <div className="text-sm text-gray-500">{product.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {medicineTypeLabels[product.medicineType]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {product.currentStock}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        stockLevel.color === 'red' ? 'bg-red-100 text-red-800' :
                        stockLevel.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                        stockLevel.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {stockLevel.text}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.expiryDate ? (
                        <div className="flex items-center">
                          <span className={`text-sm ${
                            expiryStatus.color === 'red' ? 'text-red-600' :
                            expiryStatus.color === 'yellow' ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {product.expiryDate}
                          </span>
                          {expiryStatus.status === 'expired' && (
                            <span className="ml-2 text-xs text-red-600 font-medium">(Expiré)</span>
                          )}
                          {expiryStatus.status === 'expiring' && (
                            <span className="ml-2 text-xs text-yellow-600 font-medium">(Expire bientôt)</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Non spécifié</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.unitPrice.toFixed(2)} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredByStock.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Aucun médicament trouvé avec les critères sélectionnés
          </div>
        )}
      </div>
    </div>
  );
}
