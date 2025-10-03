import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { generateCountingWorksheets } from '../services/pdfGenerator';

interface MedicineGroup {
  name: string;
  forms: Array<{
    form: string;
    expiryDates: Array<{
      expiryDate: string;
      currentStock: number;
      itemId: string;
    }>;
  }>;
  totalStock: number;
  lastMonthDispensations: number;
  forecastMonths: number | null;
}

export default function CurrentStockPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState({
    search: '',
    sortBy: 'name' as 'name' | 'expiryDate',
    sortOrder: 'asc' as 'asc' | 'desc'
  });
  const [showInactive, setShowInactive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [selectedMedicineGroup, setSelectedMedicineGroup] = useState<MedicineGroup | null>(null);

  // All users can edit items
  const canEdit = true;

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

  const disposeItemMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => 
      inventoryApi.createInventoryAdjustment({
        itemId,
        quantity: -quantity, // Negative quantity to subtract
        reason: 'DISPOSE',
        notes: `Disposed of all ${quantity} units`
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-stock-all'] });
      setIsModalOpen(false);
      setEditingItem(null);
    },
    onError: (error) => {
      console.error('Error disposing item:', error);
      alert('Failed to dispose item. Please try again.');
    }
  });

  const deactivateItemMutation = useMutation({
    mutationFn: (itemId: string) => inventoryApi.updateItem(itemId, { isActive: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-stock-all'] });
      setIsModalOpen(false);
      setEditingItem(null);
      alert(t('inventory.modal.deactivatedSuccessfully'));
    },
    onError: (error) => {
      console.error('Error deactivating item:', error);
      alert('Failed to deactivate item. Please try again.');
    }
  });

  // Admin functions
  const handleEdit = (medicineGroup: MedicineGroup) => {
    setSelectedMedicineGroup(medicineGroup);
    setIsSelectionModalOpen(true);
  };

  const handleSelectItemToEdit = (itemId: string) => {
    // Find the specific item from allInventory
    const item = allInventory.find((inv: any) => inv.item.id === itemId);
    if (item) {
      setEditingItem(item);
      setIsSelectionModalOpen(false);
      setIsModalOpen(true);
    }
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

  const handleDispose = (item: any) => {
    const confirmMessage = t('inventory.modal.disposeConfirm')
      .replace('{quantity}', item.currentStock.toString())
      .replace('{itemName}', item.item.name);
    
    if (window.confirm(confirmMessage)) {
      disposeItemMutation.mutate({
        itemId: item.item.id,
        quantity: item.currentStock
      });
    }
  };

  const handleDeactivate = (item: any) => {
    const confirmMessage = t('inventory.modal.deactivateConfirm')
      .replace('{itemName}', item.item.name);
    
    if (window.confirm(confirmMessage)) {
      deactivateItemMutation.mutate(item.item.id);
    }
  };

  const handleStartCount = () => {
    // Filter active medicines with stock > 0
    const activeMedicines = allInventory.filter((item: any) => 
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
    queryFn: () => inventoryApi.getCurrentStock({ limit: 1000 }), // Get all items
    refetchOnWindowFocus: true, // Refresh when page regains focus
    staleTime: 0 // Always consider data stale to ensure fresh data
  });

  // Fetch dispensation data for the last month
  const { data: dispensationData } = useQuery({
    queryKey: ['dispensations-last-month'],
    queryFn: () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return inventoryApi.getInventoryLogs({
        reason: 'DISPENSATION',
        startDate: oneMonthAgo.toISOString(),
        limit: 1000
      });
    },
    refetchOnWindowFocus: true, // Refresh when page regains focus
    staleTime: 0 // Always consider data stale to ensure fresh data
  });

  const allInventory = stockData?.inventory || [];
  const dispensations = dispensationData?.logs || [];

  // Group medicines by name and calculate dispensation data
  const medicineGroups = useMemo(() => {
    const groups = new Map<string, MedicineGroup>();

    // Process inventory data
    allInventory.forEach((item: any) => {
      // Filter based on showInactive state
      if (!showInactive && !item.item?.isActive) return;
      if (showInactive && item.item?.isActive) return;

      const medicineName = item.item.name;
      const form = item.item.form || 'TABLET';
      const expiryDate = item.item.expiryDate || 'No Expiry';
      const currentStock = item.currentStock;
      const itemId = item.item.id;

      if (!groups.has(medicineName)) {
        groups.set(medicineName, {
          name: medicineName,
          forms: [],
          totalStock: 0,
          lastMonthDispensations: 0,
          forecastMonths: null
        });
      }

      const group = groups.get(medicineName)!;
      group.totalStock += currentStock;

      // Find or create form
      let formEntry = group.forms.find(f => f.form === form);
      if (!formEntry) {
        formEntry = { form, expiryDates: [] };
        group.forms.push(formEntry);
      }

      // Add expiry date entry
      formEntry.expiryDates.push({
        expiryDate,
        currentStock,
        itemId
      });
    });

    // Process dispensation data
    dispensations.forEach((dispensation: any) => {
      const medicineName = dispensation.item?.name;
      if (!medicineName || !groups.has(medicineName)) return;

      const group = groups.get(medicineName)!;
      group.lastMonthDispensations += Math.abs(dispensation.totalAmount);
    });

    // Calculate forecast for each medicine
    groups.forEach((group) => {
      if (group.lastMonthDispensations > 0 && group.totalStock > 0) {
        // Calculate months until stock runs out based on last month's usage
        group.forecastMonths = Math.floor(group.totalStock / group.lastMonthDispensations);
      }
    });

    return Array.from(groups.values());
  }, [allInventory, dispensations, showInactive]);

  // Client-side filtering and sorting
  const filteredMedicineGroups = useMemo(() => {
    let filtered = medicineGroups;

    // Filter by search term
    if (filter.search) {
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(filter.search.toLowerCase())
      );
    }

    // Sort the results
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (filter.sortBy === 'name') {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      } else if (filter.sortBy === 'expiryDate') {
        // Sort by earliest expiry date
        const aEarliestExpiry = Math.min(...a.forms.flatMap(f => 
          f.expiryDates.map(ed => parseExpiryDate(ed.expiryDate).getTime())
        ));
        const bEarliestExpiry = Math.min(...b.forms.flatMap(f => 
          f.expiryDates.map(ed => parseExpiryDate(ed.expiryDate).getTime())
        ));
        aValue = aEarliestExpiry;
        bValue = bEarliestExpiry;
      } else {
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
      }

      if (filter.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [medicineGroups, filter.search, filter.sortBy, filter.sortOrder]);

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
            onClick={() => setShowInactive(!showInactive)}
            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 ${
              showInactive 
                ? 'bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500' 
                : 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
            }`}
          >
            {showInactive ? t('inventory.hideInactive') : t('inventory.showInactive')}
          </button>
          <button
            onClick={handleStartCount}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {t('counting.startCount')}
          </button>
          {canEdit && (
            <button
              onClick={handleCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('inventory.modal.addNewItem')}
            </button>
          )}
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
              onChange={(e) => setFilter({ ...filter, sortBy: e.target.value as 'name' | 'expiryDate' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">{t('inventory.item')}</option>
              <option value="expiryDate">{t('inventory.expiryDate')}</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('inventory.sortOrder')}
            </label>
            <select
              value={filter.sortOrder}
              onChange={(e) => setFilter({ ...filter, sortOrder: e.target.value as 'asc' | 'desc' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="asc">{t('inventory.ascending')}</option>
              <option value="desc">{t('inventory.descending')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Medicine Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMedicineGroups.map((group) => (
          <MedicineCard
            key={group.name}
            group={group}
            translateForm={translateForm}
            isExpired={isExpired}
            canEdit={canEdit && !showInactive}
            onEdit={handleEdit}
            isInactive={showInactive}
          />
        ))}
      </div>

      {filteredMedicineGroups.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {showInactive ? t('inventory.noInactiveMedications') : t('inventory.noStock')}
        </div>
      )}

      {/* Item Selection Modal */}
      {isSelectionModalOpen && selectedMedicineGroup && (
        <ItemSelectionModal
          medicineGroup={selectedMedicineGroup}
          translateForm={translateForm}
          isExpired={isExpired}
          onSelectItem={handleSelectItemToEdit}
          onClose={() => {
            setIsSelectionModalOpen(false);
            setSelectedMedicineGroup(null);
          }}
        />
      )}

      {/* Item Modal */}
      {isModalOpen && (
        <ItemModal
          item={editingItem}
          onSubmit={handleSubmit}
          onDispose={handleDispose}
          onDeactivate={handleDeactivate}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          isLoading={createItemMutation.isPending || updateItemMutation.isPending || disposeItemMutation.isPending || deactivateItemMutation.isPending}
        />
      )}
    </div>
  );
}

// Medicine Card Component
interface MedicineCardProps {
  group: MedicineGroup;
  translateForm: (form: string) => string;
  isExpired: (dateStr: string) => boolean;
  canEdit: boolean;
  onEdit: (item: any) => void;
  isInactive?: boolean;
}

function MedicineCard({ group, translateForm, isExpired, canEdit, onEdit, isInactive }: MedicineCardProps) {
  const { t } = useLanguage();

  const getStockLevel = (stock: number, forecastMonths: number | null) => {
    if (stock <= 0) return { text: t('inventory.outOfStock'), color: 'bg-red-100 text-red-800' };
    if (forecastMonths === null) return { text: t('inventory.inStock'), color: 'bg-green-100 text-green-800' };
    if (forecastMonths <= 3) return { text: 'Critical Stock', color: 'bg-red-100 text-red-800' };
    if (forecastMonths <= 6) return { text: t('inventory.lowStock'), color: 'bg-yellow-100 text-yellow-800' };
    return { text: t('inventory.inStock'), color: 'bg-green-100 text-green-800' };
  };

  const stockLevel = getStockLevel(group.totalStock, group.forecastMonths);

  return (
    <div className={`rounded-lg shadow-md border p-6 transition-shadow ${
      isInactive 
        ? 'bg-gray-100 border-gray-300 opacity-75' 
        : 'bg-white border-gray-200 hover:shadow-lg'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className={`text-lg font-semibold mb-1 ${
            isInactive ? 'text-gray-600' : 'text-gray-900'
          }`}>
            {group.name}
            {isInactive && (
              <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                {t('inventory.inactiveMedications')}
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isInactive ? 'bg-gray-200 text-gray-600' : stockLevel.color
            }`}>
              {isInactive ? 'Inactive' : stockLevel.text}
            </span>
            <span className={`text-sm ${isInactive ? 'text-gray-500' : 'text-gray-600'}`}>
              Total: {group.totalStock}
            </span>
          </div>
        </div>
        {canEdit && !isInactive && (
          <button
            onClick={() => onEdit(group)}
            className="text-blue-600 hover:text-blue-900 text-sm"
          >
            {t('inventory.modal.editItem')}
          </button>
        )}
      </div>

      {/* Forms and Expiry Dates */}
      <div className="space-y-3 mb-4">
        {group.forms.map((formEntry, formIndex) => (
          <div key={formIndex} className="border-l-2 border-blue-200 pl-3">
            <div className="font-medium text-sm text-gray-700 mb-2">
              {translateForm(formEntry.form)}
            </div>
            <div className="space-y-1">
              {formEntry.expiryDates.map((expiryEntry, expiryIndex) => (
                <div key={expiryIndex} className="flex justify-between items-center text-sm">
                  <span className={`${
                    isExpired(expiryEntry.expiryDate) 
                      ? 'text-red-600 font-medium' 
                      : 'text-gray-600'
                  }`}>
                    {expiryEntry.expiryDate}
                  </span>
                  <span className="font-medium text-gray-900">
                    {expiryEntry.currentStock}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Dispensation Stats */}
      <div className="border-t pt-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Last Month Dispensed:</span>
          <span className="font-medium text-gray-900">{group.lastMonthDispensations}</span>
        </div>
        
        {group.forecastMonths !== null && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Forecast:</span>
            <span className={`font-medium ${
              group.forecastMonths <= 3 ? 'text-red-600' : 
              group.forecastMonths <= 6 ? 'text-yellow-600' : 
              'text-green-600'
            }`}>
              {group.forecastMonths} {group.forecastMonths === 1 ? 'month' : 'months'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Item Selection Modal Component
interface ItemSelectionModalProps {
  medicineGroup: MedicineGroup;
  translateForm: (form: string) => string;
  isExpired: (dateStr: string) => boolean;
  onSelectItem: (itemId: string) => void;
  onClose: () => void;
}

function ItemSelectionModal({ medicineGroup, translateForm, isExpired, onSelectItem, onClose }: ItemSelectionModalProps) {

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Select Item to Edit - {medicineGroup.name}
          </h3>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {medicineGroup.forms.map((formEntry, formIndex) => (
              <div key={formIndex} className="border border-gray-200 rounded-lg p-4">
                <div className="font-medium text-gray-700 mb-3">
                  {translateForm(formEntry.form)}
                </div>
                <div className="space-y-2">
                  {formEntry.expiryDates.map((expiryEntry, expiryIndex) => (
                    <button
                      key={expiryIndex}
                      onClick={() => onSelectItem(expiryEntry.itemId)}
                      className="w-full text-left p-3 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className={`font-medium ${
                            isExpired(expiryEntry.expiryDate) 
                              ? 'text-red-600' 
                              : 'text-gray-900'
                          }`}>
                            {expiryEntry.expiryDate}
                          </span>
                          {isExpired(expiryEntry.expiryDate) && (
                            <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          Stock: <span className="font-medium">{expiryEntry.currentStock}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 pt-4 mt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Item Modal Component
interface ItemModalProps {
  item: any;
  onSubmit: (data: any) => void;
  onDispose: (item: any) => void;
  onDeactivate: (item: any) => void;
  onClose: () => void;
  isLoading: boolean;
}

function ItemModal({ item, onSubmit, onDispose, onDeactivate, onClose, isLoading }: ItemModalProps) {
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

            {/* Action buttons section */}
            <div className="pt-4 space-y-4">
              {/* Destructive actions - only show for existing items */}
              {item && (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-700">Actions</div>
                  
                  {/* Dispose button - only show for items with stock */}
                  {item.currentStock > 0 && (
                    <div className="flex items-center justify-between p-3 border border-red-200 rounded-md bg-red-50">
                      <div>
                        <div className="text-sm font-medium text-red-800">{t('inventory.modal.dispose')}</div>
                        <div className="text-xs text-red-600">Sets quantity to 0 and deactivates</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDispose(item)}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                      >
                        {t('inventory.modal.dispose')}
                      </button>
                    </div>
                  )}
                  
                  {/* Deactivate button - only show for active items */}
                  {item.item?.isActive && (
                    <div className="flex items-center justify-between p-3 border border-orange-200 rounded-md bg-orange-50">
                      <div>
                        <div className="text-sm font-medium text-orange-800">{t('inventory.modal.deactivate')}</div>
                        <div className="text-xs text-orange-600">Hides the medicine from use</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeactivate(item)}
                        disabled={isLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                      >
                        {t('inventory.modal.deactivate')}
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Form action buttons */}
              <div className="flex justify-end space-x-3 pt-2 border-t">
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}