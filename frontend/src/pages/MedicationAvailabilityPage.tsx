import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../services/api';
import { Product } from '../types';

const medicineTypeLabels = {
  TABLET: 'Comprimé',
  GEL_CAPSULE: 'Gélule',
  CAPSULE: 'Capsule',
  GEL: 'Gel',
  EYE_DROPS: 'Gouttes oculaires'
};

export default function MedicationAvailabilityPage() {
  const [filter, setFilter] = useState({
    search: '',
    medicineType: '',
    isActive: 'all'
  });

  const { data: products, isLoading, error } = useQuery({
    queryKey: ['products', filter],
    queryFn: () => productsApi.getProducts({
      search: filter.search,
      medicineType: filter.medicineType || undefined,
      isActive: filter.isActive === 'all' ? undefined : filter.isActive === 'active'
    })
  });

  const filteredProducts = products?.data || [];

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Actif
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Inactif
      </span>
    );
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
        Erreur lors du chargement des médicaments
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Disponibilité des Médicaments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vue d'ensemble de tous les médicaments disponibles dans la pharmacie
        </p>
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
              Statut
            </label>
            <select
              value={filter.isActive}
              onChange={(e) => setFilter({ ...filter, isActive: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tous</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
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
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date d'expiration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock actuel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prescription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Réfrigérateur
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product: Product) => {
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
                      {getStatusBadge(product.isActive)}
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
                      {product.currentStock} {product.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.isPrescription ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Oui
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Non
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.requiresRefrigerator ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Oui
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Non
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Aucun médicament trouvé avec les critères sélectionnés
          </div>
        )}
      </div>
    </div>
  );
}
