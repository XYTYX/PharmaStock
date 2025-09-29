import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { inventoryApi } from '../services/api';
import { InventoryLog, Product } from '../types';

const logTypeLabels = {
  PURCHASE: 'Achat',
  DISPENSATION: 'Dispensation',
  ADJUSTMENT: 'Ajustement',
  TRANSFER: 'Transfert',
  EXPIRED: 'Expiré',
  DAMAGED: 'Endommagé',
  RETURN: 'Retour'
};

export default function DispensationTrackingPage() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState({
    search: '',
    type: '',
    dateFrom: '',
    dateTo: ''
  });

  const { data: inventoryLogs, isLoading, error } = useQuery({
    queryKey: ['inventory-logs', filter],
    queryFn: () => inventoryApi.getInventoryLogs({
      search: filter.search,
      type: filter.type || undefined,
      dateFrom: filter.dateFrom || undefined,
      dateTo: filter.dateTo || undefined
    })
  });

  const logs = inventoryLogs?.data || [];

  const getTypeBadge = (type: string) => {
    const colors = {
      PURCHASE: 'bg-green-100 text-green-800',
      DISPENSATION: 'bg-blue-100 text-blue-800',
      ADJUSTMENT: 'bg-yellow-100 text-yellow-800',
      TRANSFER: 'bg-purple-100 text-purple-800',
      EXPIRED: 'bg-red-100 text-red-800',
      DAMAGED: 'bg-red-100 text-red-800',
      RETURN: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {logTypeLabels[type as keyof typeof logTypeLabels] || type}
      </span>
    );
  };

  const getQuantityDisplay = (quantity: number, type: string) => {
    const isNegative = quantity < 0;
    const absQuantity = Math.abs(quantity);
    
    return (
      <span className={`font-medium ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
        {isNegative ? '-' : '+'}{absQuantity}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        Erreur lors du chargement des mouvements
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Suivi des Dispensations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Historique des entrées et sorties de médicaments
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {logs.filter(log => log.type === 'PURCHASE').length}
          </div>
          <div className="text-sm text-gray-500">Achats</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">
            {logs.filter(log => log.type === 'DISPENSATION').length}
          </div>
          <div className="text-sm text-gray-500">Dispensations</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {logs.filter(log => log.type === 'ADJUSTMENT').length}
          </div>
          <div className="text-sm text-gray-500">Ajustements</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">
            {logs.filter(log => log.type === 'EXPIRED' || log.type === 'DAMAGED').length}
          </div>
          <div className="text-sm text-gray-500">Pertes</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rechercher
            </label>
            <input
              type="text"
              placeholder="Nom du médicament ou référence..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de mouvement
            </label>
            <select
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les types</option>
              <option value="PURCHASE">Achat</option>
              <option value="DISPENSATION">Dispensation</option>
              <option value="ADJUSTMENT">Ajustement</option>
              <option value="TRANSFER">Transfert</option>
              <option value="EXPIRED">Expiré</option>
              <option value="DAMAGED">Endommagé</option>
              <option value="RETURN">Retour</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date de début
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
              Date de fin
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
                  Date/Heure
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Médicament
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock précédent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nouveau stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Raison
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Référence
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log: InventoryLog) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getTypeBadge(log.type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {log.product?.name || 'Médicament inconnu'}
                    </div>
                    {log.product?.internalId && (
                      <div className="text-sm text-gray-500 font-mono">
                        {log.product.internalId}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getQuantityDisplay(log.quantity, log.type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.previousStock}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.newStock}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.reason || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.reference || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {logs.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Aucun mouvement trouvé avec les critères sélectionnés
          </div>
        )}
      </div>
    </div>
  );
}
