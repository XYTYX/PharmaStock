import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../store/authStore';
import { generateCountingWorksheets } from '../services/pdfGenerator';

export default function CurrentStockPage() {
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState({
    search: '',
    sortBy: 'item.name',
    sortOrder: 'asc'
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

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

  // Mutations for admin functionality
  const createItemMutation = useMutation({
    mutationFn: inventoryApi.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-stock-all'] });
      setIsModalOpen(false);
      setEditingItem(null);
    },
    onError: (error) => {
      console.error('Error creating item:', error);
      alert('Failed to create item. Please try again.');
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => inventoryApi.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-stock-all'] });
      setIsModalOpen(false);
      setEditingItem(null);
    },
    onError: (error) => {
      console.error('Error updating item:', error);
      alert('Failed to update item. Please try again.');
    }
  });


  // Admin functions
  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (formData: any) => {
    if (editingItem) {
      // Update item details (exclude stock-related fields)
      const { currentStock, initialStock, ...itemData } = formData;
      updateItemMutation.mutate({ id: editingItem.item.id, data: itemData });
    } else {
      // Ensure initialStock is a valid number for new items
      const submitData = {
        ...formData,
        initialStock: formData.initialStock || 0
      };
      console.log('Creating item with data:', submitData);
      createItemMutation.mutate(submitData);
    }
  };

  const handleStartCount = () => {
    // Filter active medicines with stock > 0
    const activeMedicines = inventory.filter((item: any) => 
      item.item?.isActive && item.currentStock > 0
    );

    if (activeMedicines.length === 0) {
      alert('No active medicines with stock available for counting.');
      return;
    }

    // Generate unique combinations of medicine name, expiry date, and form
    const uniqueCombinations = new Map();
    
    activeMedicines.forEach((item: any) => {
      const key = `${item.item.name}-${item.item.expiryDate || 'No Expiry'}-${item.item.form}`;
      if (!uniqueCombinations.has(key)) {
        uniqueCombinations.set(key, {
          name: item.item.name,
          expiryDate: item.item.expiryDate || 'No Expiry',
          form: item.item.form,
          currentStock: item.currentStock
        });
      }
    });

    // Generate PDF worksheets
    generateCountingWorksheets(Array.from(uniqueCombinations.values()), t);
  };

  // Fetch all inventory data once
  const { data: stockData, isLoading, error } = useQuery({
    queryKey: ['current-stock-all'],
    queryFn: () => inventoryApi.getCurrentStock({ limit: 1000 }) // Get all items
  });

  const allInventory = stockData?.inventory || [];

  // Client-side filtering and sorting
  const inventory = useMemo(() => {
    let filtered = allInventory;

    // Filter by search term
    if (filter.search) {
      filtered = filtered.filter((item: any) => 
        item.item?.name?.toLowerCase().includes(filter.search.toLowerCase())
      );
    }

    // Sort the results
    filtered.sort((a: any, b: any) => {
      let aValue, bValue;
      
      if (filter.sortBy === 'item.name') {
        aValue = a.item?.name || '';
        bValue = b.item?.name || '';
      } else if (filter.sortBy === 'currentStock') {
        aValue = a.currentStock;
        bValue = b.currentStock;
      } else if (filter.sortBy === 'item.form') {
        aValue = a.item?.form ? translateForm(a.item.form) : '';
        bValue = b.item?.form ? translateForm(b.item.form) : '';
      } else if (filter.sortBy === 'item.expiryDate') {
        aValue = parseExpiryDate(a.item?.expiryDate || '');
        bValue = parseExpiryDate(b.item?.expiryDate || '');
      } else {
        aValue = a.item?.name || '';
        bValue = b.item?.name || '';
      }

      if (filter.sortBy === 'item.expiryDate') {
        // For dates, we need to compare Date objects
        if (filter.sortOrder === 'asc') {
          return aValue.getTime() - bValue.getTime();
        } else {
          return bValue.getTime() - aValue.getTime();
        }
      } else {
        // For other values, use string/number comparison
        if (filter.sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      }
    });

    return filtered;
  }, [allInventory, filter.search, filter.sortBy, filter.sortOrder]);

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
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.currentStock')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('inventory.currentStock')} - {t('inventory.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleStartCount}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Start Count
          </button>
          {isAdmin && (
            <button
              onClick={handleCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('inventory.modal.addNewItem')}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">
            {inventory.length}
          </div>
          <div className="text-sm text-gray-500">{t('inventory.totalItems')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">
            {inventory.reduce((sum: number, item: any) => sum + item.currentStock, 0)}
          </div>
          <div className="text-sm text-gray-500">{t('inventory.totalStock')}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {inventory.filter((item: any) => item.currentStock > 0).length}
          </div>
          <div className="text-sm text-gray-500">{t('inventory.inStock')}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('inventory.search')}
            </label>
            <input
              type="text"
              placeholder={t('inventory.searchPlaceholder')}
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('inventory.sortBy')}
            </label>
            <select
              value={filter.sortBy}
              onChange={(e) => setFilter({ ...filter, sortBy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="item.name">{t('inventory.item')}</option>
              <option value="currentStock">{t('inventory.currentStock')}</option>
              <option value="item.form">{t('inventory.form')}</option>
              <option value="item.expiryDate">{t('inventory.expiryDate')}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('inventory.sortOrder')}
            </label>
            <select
              value={filter.sortOrder}
              onChange={(e) => setFilter({ ...filter, sortOrder: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="asc">{t('inventory.ascending')}</option>
              <option value="desc">{t('inventory.descending')}</option>
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
                  {t('inventory.item')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inventory.form')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inventory.expiryDate')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inventory.currentStock')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('inventory.stockLevel')}
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('inventory.modal.actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inventory.map((item: any) => {
                const getStockLevel = (stock: number) => {
                  if (stock === 0) return { text: t('inventory.outOfStock'), color: 'bg-red-100 text-red-800' };
                  if (stock <= 10) return { text: t('inventory.lowStock'), color: 'bg-yellow-100 text-yellow-800' };
                  return { text: t('inventory.inStock'), color: 'bg-green-100 text-green-800' };
                };
                
                const stockLevel = getStockLevel(item.currentStock);
                
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.item?.name || 'Article supprimé'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.item?.form ? translateForm(item.item.form) : '-'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                      isExpired(item.item?.expiryDate) 
                        ? 'bg-red-100 text-red-600 font-medium' 
                        : 'text-gray-900'
                    }`}>
                      {item.item?.expiryDate || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-medium">{item.currentStock}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockLevel.color}`}>
                        {stockLevel.text}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          {t('inventory.modal.editItem')}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {inventory.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {t('inventory.noStock')}
          </div>
        )}
      </div>

      {/* Item Modal */}
      {isModalOpen && (
        <ItemModal
          item={editingItem}
          onSubmit={handleSubmit}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          isLoading={createItemMutation.isPending || updateItemMutation.isPending}
        />
      )}
    </div>
  );
}

// Item Modal Component
interface ItemModalProps {
  item: any;
  onSubmit: (data: any) => void;
  onClose: () => void;
  isLoading: boolean;
}

function ItemModal({ item, onSubmit, onClose, isLoading }: ItemModalProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: item?.item?.name || '',
    description: item?.item?.description || '',
    form: item?.item?.form || 'TABLET',
    expiryDate: item?.item?.expiryDate || '',
    initialStock: item?.currentStock || 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {item ? t('inventory.modal.editItem') : t('inventory.modal.addNewItem')}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('inventory.modal.nameRequired')}
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('inventory.modal.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('inventory.modal.form')}
              </label>
              <select
                value={formData.form}
                onChange={(e) => setFormData({ ...formData, form: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="TABLET">{t('inventory.form.tablet')}</option>
                <option value="CAPSULE">{t('inventory.form.capsule')}</option>
                <option value="GEL">{t('inventory.form.gel')}</option>
                <option value="EYE_DROPS">{t('inventory.form.eyeDrops')}</option>
                <option value="POWDER">{t('inventory.form.powder')}</option>
                <option value="CREAM">{t('inventory.form.cream')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('inventory.modal.expiryDate')}
              </label>
              <input
                type="text"
                placeholder={t('inventory.modal.expiryDatePlaceholder')}
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Quantity field - only show when creating new items */}
            {!item && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('inventory.modal.initialQuantity')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.initialStock}
                  onChange={(e) => setFormData({ ...formData, initialStock: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            )}

            {/* Adjustment hint */}
            {item && (
              <div className="mb-2">
                <span className="text-xs text-gray-500">
                  {t('inventory.modal.adjustHint')}
                </span>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                {t('inventory.modal.cancel')}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? t('inventory.modal.saving') : (item ? t('inventory.modal.update') : t('inventory.modal.create'))}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}