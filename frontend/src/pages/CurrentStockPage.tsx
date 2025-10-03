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
      forecastMonths?: number; // Individual forecast for this expiry date
    }>;
  }>;
  totalStock: number;
  lastMonthDispensations: number;
  forecastMonths: number | null;
}

// Function to format expiry date input (MM-YYYY)
const formatExpiryDateInput = (value: string) => {
  // Remove all non-numeric characters
  const numericValue = value.replace(/\D/g, '');
  
  // Limit to 6 digits (MMYYYY)
  const limitedValue = numericValue.slice(0, 6);
  
  // Add dash after 2 digits if we have more than 2 digits
  if (limitedValue.length > 2) {
    return limitedValue.slice(0, 2) + '-' + limitedValue.slice(2);
  }
  
  return limitedValue;
};

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
  const [prePopulatedName, setPrePopulatedName] = useState<string>('');
  const [isDisposeModalOpen, setIsDisposeModalOpen] = useState(false);
  const [disposeItem, setDisposeItem] = useState<any>(null);
  const [disposeReason, setDisposeReason] = useState<string>('');

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
    mutationFn: async ({ itemId, quantity, reason }: { itemId: string; quantity: number; reason: string }) => {
      // First dispose the stock
      await inventoryApi.createInventoryAdjustment({
        itemId,
        quantity: -quantity, // Negative quantity to subtract
        reason: 'DISPOSE',
        notes: `Disposed of all ${quantity} units. Reason: ${reason}`
      });
      
      // Then deactivate the item
      await inventoryApi.deactivateItem(itemId);
    },
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
    mutationFn: (itemId: string) => inventoryApi.deactivateItem(itemId),
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

  const handlePurchaseAgain = (medicineName: string) => {
    // Close the selection modal
    setIsSelectionModalOpen(false);
    setSelectedMedicineGroup(null);
    
    // Set editingItem to null to indicate new item creation
    setEditingItem(null);
    
    // Store the medicine name to pre-populate the form
    setPrePopulatedName(medicineName);
    
    // Open the item modal
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
    setDisposeItem(item);
    setDisposeReason('');
    setIsDisposeModalOpen(true);
  };

  const handleConfirmDispose = () => {
    if (!disposeReason.trim()) {
      alert('Please provide a reason for disposal.');
      return;
    }
    
    disposeItemMutation.mutate({
      itemId: disposeItem.item.id,
      quantity: disposeItem.currentStock,
      reason: disposeReason.trim()
    });
    
    setIsDisposeModalOpen(false);
    setDisposeItem(null);
    setDisposeReason('');
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

  const handleExportCSV = () => {
    // Prepare CSV data with the required columns
    const csvData = [];
    
    // Add header row
    csvData.push([
      t('inventory.modal.name'), 
      t('inventory.form'), 
      t('inventory.expiryDate'), 
      t('inventory.quantity'), 
      t('inventory.monthlyUsage'), 
      t('inventory.forecastedUsageBeforeExpiry'), 
      t('inventory.stockWillLastMonths')
    ]);
    
    // Add data rows
    filteredMedicineGroups.forEach(group => {
      group.forms.forEach(formEntry => {
        formEntry.expiryDates.forEach(expiryEntry => {
          const row = [
            group.name,
            translateForm(formEntry.form),
            expiryEntry.expiryDate,
            expiryEntry.currentStock.toString(),
            group.lastMonthDispensations.toString(),
            expiryEntry.forecastMonths !== null && expiryEntry.forecastMonths !== undefined 
              ? `${expiryEntry.forecastMonths}%` 
              : 'N/A',
            group.forecastMonths !== null 
              ? group.forecastMonths.toString() 
              : 'N/A'
          ];
          csvData.push(row);
        });
      });
    });
    
    // Convert to CSV string
    const csvContent = csvData.map(row => 
      row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `current_stock_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fetch all inventory data once
  const { data: stockData, isLoading, error } = useQuery({
    queryKey: ['current-stock-all'],
    queryFn: () => inventoryApi.getCurrentStock({ limit: 1000 }), // Get all items
    refetchOnWindowFocus: true, // Refresh when page regains focus
    staleTime: 0 // Always consider data stale to ensure fresh data
  });

  // Fetch dispensation and adjustment data for the last month
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

  // Fetch adjustment data for the last month
  const { data: adjustmentData } = useQuery({
    queryKey: ['adjustments-last-month'],
    queryFn: () => {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return inventoryApi.getInventoryLogs({
        reason: 'ADJUSTMENT',
        startDate: oneMonthAgo.toISOString(),
        limit: 1000
      });
    },
    refetchOnWindowFocus: true, // Refresh when page regains focus
    staleTime: 0 // Always consider data stale to ensure fresh data
  });

  const allInventory = stockData?.inventory || [];
  const dispensations = dispensationData?.logs || [];
  const adjustments = adjustmentData?.logs || [];

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

    // Process dispensation data (1 month)
    dispensations.forEach((dispensation: any) => {
      const medicineName = dispensation.item?.name;
      if (!medicineName || !groups.has(medicineName)) return;

      const group = groups.get(medicineName)!;
      group.lastMonthDispensations += Math.abs(dispensation.totalAmount);
    });

    // Process adjustment data (only negative adjustments that reduce stock) - 1 month
    adjustments.forEach((adjustment: any) => {
      const medicineName = adjustment.item?.name;
      if (!medicineName || !groups.has(medicineName)) return;

      const group = groups.get(medicineName)!;
      // Only include negative adjustments (stock reductions) in dispensation calculation
      if (adjustment.totalAmount < 0) {
        group.lastMonthDispensations += Math.abs(adjustment.totalAmount);
      }
    });

    // Calculate forecast for each medicine
    groups.forEach((group) => {
      if (group.lastMonthDispensations > 0 && group.totalStock > 0) {
        // Collect all non-expired stock with their expiry dates and references to form entries
        const stockEntries: Array<{ 
          expiryDate: string; 
          stock: number; 
          itemId: string;
          formEntry: any;
          expiryEntry: any;
        }> = [];
        
        group.forms.forEach(formEntry => {
          formEntry.expiryDates.forEach(expiryEntry => {
            if (!isExpired(expiryEntry.expiryDate)) {
              stockEntries.push({
                expiryDate: expiryEntry.expiryDate,
                stock: expiryEntry.currentStock,
                itemId: expiryEntry.itemId,
                formEntry,
                expiryEntry
              });
            }
          });
        });
        
        if (stockEntries.length === 0) {
          // If all stock is expired, set forecast to 0
          group.forecastMonths = 0;
          // Set individual forecasts to 0
          group.forms.forEach(formEntry => {
            formEntry.expiryDates.forEach(expiryEntry => {
              expiryEntry.forecastMonths = 0;
            });
          });
          return;
        }
        
        // Sort by expiry date (earliest first)
        stockEntries.sort((a, b) => {
          const dateA = parseExpiryDate(a.expiryDate);
          const dateB = parseExpiryDate(b.expiryDate);
          return dateA.getTime() - dateB.getTime();
        });
        
        // Calculate forecast chronologically
        let remainingStock = 0;
        let totalForecastMonths = 0;
        const currentDate = new Date();
        const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        for (const entry of stockEntries) {
          const expiryDate = parseExpiryDate(entry.expiryDate);
          const monthsUntilExpiry = Math.max(0, 
            (expiryDate.getFullYear() - currentMonth.getFullYear()) * 12 + 
            (expiryDate.getMonth() - currentMonth.getMonth())
          );
          
          // Add this batch of stock to our remaining stock
          remainingStock += entry.stock;
          
          // Calculate how many months this batch will last
          const monthsThisBatchLasts = Math.floor(remainingStock / group.lastMonthDispensations);
          
          // The effective months for this batch is the minimum of:
          // 1. How long this batch lasts based on usage
          // 2. How long until this batch expires
          const effectiveMonths = Math.min(monthsThisBatchLasts, monthsUntilExpiry);
          
          // Calculate percentage of this batch that will be used before expiry
          let usagePercentage = 0;
          if (monthsUntilExpiry > 0 && group.lastMonthDispensations > 0) {
            // Calculate how much of this batch will be consumed
            const stockConsumed = Math.min(entry.stock, effectiveMonths * group.lastMonthDispensations);
            usagePercentage = Math.round((stockConsumed / entry.stock) * 100);
          }
          
          // Store individual forecast for this expiry date (now as percentage)
          entry.expiryEntry.forecastMonths = usagePercentage;
          
          if (effectiveMonths > 0) {
            totalForecastMonths += effectiveMonths;
            // Reduce remaining stock by what was consumed
            remainingStock -= effectiveMonths * group.lastMonthDispensations;
          }
          
          // If we've used up all stock or reached expiry, break
          if (remainingStock <= 0 || effectiveMonths === monthsUntilExpiry) {
            break;
          }
        }
        
        // Set remaining expiry dates to 0 forecast if they weren't processed
        group.forms.forEach(formEntry => {
          formEntry.expiryDates.forEach(expiryEntry => {
            if (expiryEntry.forecastMonths === undefined) {
              expiryEntry.forecastMonths = 0;
            }
          });
        });
        
        group.forecastMonths = totalForecastMonths;
      } else {
        // Set all individual forecasts to undefined if no dispensations or stock
        group.forms.forEach(formEntry => {
          formEntry.expiryDates.forEach(expiryEntry => {
            expiryEntry.forecastMonths = undefined;
          });
        });
      }
    });

    return Array.from(groups.values());
  }, [allInventory, dispensations, adjustments, showInactive]);

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
            onClick={handleExportCSV}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {t('inventory.exportCSV')}
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
          onPurchaseAgain={handlePurchaseAgain}
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
            setPrePopulatedName(''); // Clear pre-populated name when closing
          }}
          isLoading={createItemMutation.isPending || updateItemMutation.isPending || disposeItemMutation.isPending || deactivateItemMutation.isPending}
          prePopulatedName={prePopulatedName}
        />
      )}

      {/* Dispose Modal */}
      {isDisposeModalOpen && disposeItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Dispose Item
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  You are about to dispose of <strong>{disposeItem.item.name}</strong> with <strong>{disposeItem.currentStock}</strong> units in stock.
                </p>
                <p className="text-sm text-red-600 font-medium">
                  This action cannot be undone. The item will be deactivated after disposal.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What is the reason for disposal? *
                </label>
                <textarea
                  value={disposeReason}
                  onChange={(e) => setDisposeReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Enter reason for disposal (e.g., expired, damaged, recalled, etc.)"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDisposeModalOpen(false);
                    setDisposeItem(null);
                    setDisposeReason('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDispose}
                  disabled={disposeItemMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {disposeItemMutation.isPending ? 'Disposing...' : 'Dispose Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
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
                  <div className="flex flex-col">
                    <span className={`${
                      isExpired(expiryEntry.expiryDate) 
                        ? 'text-red-600 font-medium' 
                        : 'text-gray-600'
                    }`}>
                      {expiryEntry.expiryDate}
                    </span>
                    {expiryEntry.forecastMonths !== null && expiryEntry.forecastMonths !== undefined && (
                      <span className={`text-xs ${
                        expiryEntry.forecastMonths === 0 
                          ? 'text-red-500' 
                          : expiryEntry.forecastMonths <= 75 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                      }`}>
                        {expiryEntry.forecastMonths === 0 ? t('inventory.zeroPercentUsedBeforeExpiry') : t('inventory.willUsePercentBeforeExpiry').replace('{percentage}', expiryEntry.forecastMonths.toString())}
                      </span>
                    )}
                  </div>
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
            <span className="text-gray-600">Total Forecast:</span>
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
  onPurchaseAgain: (medicineName: string) => void;
  onClose: () => void;
}

function ItemSelectionModal({ medicineGroup, translateForm, isExpired, onSelectItem, onPurchaseAgain, onClose }: ItemSelectionModalProps) {
  const { t } = useLanguage();

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
                          {expiryEntry.forecastMonths !== null && expiryEntry.forecastMonths !== undefined && (
                            <div className={`text-xs mt-1 ${
                              expiryEntry.forecastMonths === 0 
                                ? 'text-red-500' 
                                : expiryEntry.forecastMonths <= 75 
                                  ? 'text-yellow-600' 
                                  : 'text-green-600'
                            }`}>
                              {expiryEntry.forecastMonths === 0 ? t('inventory.zeroPercentUsedBeforeExpiry') : t('inventory.willUsePercentBeforeExpiry').replace('{percentage}', expiryEntry.forecastMonths.toString())}
                            </div>
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

          <div className="flex justify-between pt-4 mt-6 border-t">
            <button
              type="button"
              onClick={() => onPurchaseAgain(medicineGroup.name)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Purchase Again
            </button>
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
  prePopulatedName?: string;
}

function ItemModal({ item, onSubmit, onDispose, onDeactivate, onClose, isLoading, prePopulatedName }: ItemModalProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: item?.item?.name || prePopulatedName || '',
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
                onChange={(e) => {
                  const formattedValue = formatExpiryDateInput(e.target.value);
                  setFormData({ ...formData, expiryDate: formattedValue });
                }}
                onKeyDown={(e) => {
                  // Allow: backspace, delete, tab, escape, enter, home, end, left, right, up, down
                  if ([8, 9, 27, 13, 46, 35, 36, 37, 38, 39, 40].indexOf(e.keyCode) !== -1 ||
                      // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                      (e.keyCode === 65 && e.ctrlKey === true) ||
                      (e.keyCode === 67 && e.ctrlKey === true) ||
                      (e.keyCode === 86 && e.ctrlKey === true) ||
                      (e.keyCode === 88 && e.ctrlKey === true)) {
                    return;
                  }
                  // Ensure that it is a number and stop the keypress
                  if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                    e.preventDefault();
                  }
                }}
                maxLength={7}
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