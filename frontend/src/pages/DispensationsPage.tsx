import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';

interface Medication {
  id: string;
  name: string;
  forms: string[];
  expiryDates: string[];
}

interface DispensationForm {
  itemId: string;
  form: string;
  expiryDate: string;
  quantity: number;
  notes?: string;
}

interface StagedMedication {
  id: string;
  itemId: string;
  name: string;
  form: string;
  expiryDate: string;
  quantity: number;
}

export default function DispensationsPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [dispensationForm, setDispensationForm] = useState<DispensationForm>({
    itemId: '',
    form: '',
    expiryDate: '',
    quantity: 1,
    notes: ''
  });
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stagedMedications, setStagedMedications] = useState<StagedMedication[]>([]);

  // Fetch current stock data
  const { data: stockData, isLoading, error } = useQuery({
    queryKey: ['current-stock-all'],
    queryFn: () => inventoryApi.getCurrentStock({ limit: 1000 })
  });

  // Fetch recent dispensations for prescribed medications display
  const { data: recentDispensations } = useQuery({
    queryKey: ['recent-dispensations'],
    queryFn: () => inventoryApi.getInventoryLogs({ 
      reason: 'DISPENSATION',
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  });

  // Process medications data to group by name and collect forms/expiry dates
  const medications = useMemo(() => {
    if (!stockData?.inventory) return [];
    
    const medicationMap = new Map<string, Medication>();
    
    stockData.inventory.forEach((item: any) => {
      if (!item.item || item.currentStock <= 0) return;
      
      const name = item.item.name;
      if (!medicationMap.has(name)) {
        medicationMap.set(name, {
          id: item.item.id, // This will be the first item's ID, we'll update it when form/expiry is selected
          name,
          forms: [],
          expiryDates: []
        });
      }
      
      const medication = medicationMap.get(name)!;
      if (item.item.form && !medication.forms.includes(item.item.form)) {
        medication.forms.push(item.item.form);
      }
      if (item.item.expiryDate && !medication.expiryDates.includes(item.item.expiryDate)) {
        medication.expiryDates.push(item.item.expiryDate);
      }
    });
    
    return Array.from(medicationMap.values());
  }, [stockData]);

  // Find the correct item ID based on medication name, form, and expiry date
  const findItemId = (medicationName: string, form: string, expiryDate: string) => {
    if (!stockData?.inventory) return null;
    
    const item = stockData.inventory.find((inv: any) => 
      inv.item?.name === medicationName && 
      inv.item?.form === form && 
      inv.item?.expiryDate === expiryDate
    );
    
    return item?.item?.id || null;
  };

  // Filter medications based on search
  const filteredMedications = useMemo(() => {
    if (!searchTerm) return medications;
    return medications.filter(med => 
      med.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [medications, searchTerm]);

  // Dispensation mutation
  const dispensationMutation = useMutation({
    mutationFn: async (formData: DispensationForm) => {
      // Create dispensation log entry
      return inventoryApi.createInventoryAdjustment({
        itemId: formData.itemId,
        quantity: -formData.quantity, // Negative for dispensation
        reason: 'DISPENSATION',
        notes: formData.notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-stock-all'] });
      queryClient.invalidateQueries({ queryKey: ['recent-dispensations'] });
      setShowModal(false);
      setSelectedMedication(null);
      setDispensationForm({
        itemId: '',
        form: '',
        expiryDate: '',
        quantity: 1,
        notes: ''
      });
      alert(t('dispensations.dispensedSuccessfully'));
    },
    onError: (error) => {
      console.error('Dispensation error:', error);
      alert(t('dispensations.errorDispensing'));
    }
  });

  const handleMedicationClick = (medication: Medication) => {
    setSelectedMedication(medication);
    const firstForm = medication.forms[0] || '';
    const firstExpiryDate = medication.expiryDates[0] || '';
    
    // Find the correct item ID for the first form and expiry date combination
    const correctItemId = findItemId(medication.name, firstForm, firstExpiryDate);
    
    setDispensationForm(prev => ({
      ...prev,
      itemId: correctItemId || medication.id,
      form: firstForm,
      expiryDate: firstExpiryDate
    }));
    setShowModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Find the correct item ID based on the selected form and expiry date
    const correctItemId = findItemId(selectedMedication?.name || '', dispensationForm.form, dispensationForm.expiryDate);
    if (!correctItemId) {
      alert('Selected medication combination not found in inventory');
      return;
    }
    
    // Add or merge medication into staging area
    setStagedMedications(prev => {
      const existing = prev.find(m => m.itemId === correctItemId);
      if (existing) {
        return prev.map(m =>
          m.itemId === correctItemId
            ? { ...m, quantity: m.quantity + dispensationForm.quantity }
            : m
        );
      }

      const stagedMedication: StagedMedication = {
        id: correctItemId,
        itemId: correctItemId,
        name: selectedMedication?.name || '',
        form: dispensationForm.form,
        expiryDate: dispensationForm.expiryDate,
        quantity: dispensationForm.quantity
      };

      return [...prev, stagedMedication];
    });
    
    // Close modal and reset form
    setShowModal(false);
    setSelectedMedication(null);
    setDispensationForm({
      itemId: '',
      form: '',
      expiryDate: '',
      quantity: 1,
      notes: ''
    });
  };

  const translateForm = (form: string) => {
    const formMap: { [key: string]: string } = {
      'CAPSULE': t('inventory.form.capsule'),
      'TABLET': t('inventory.form.tablet'),
      'EYE_DROPS': t('inventory.form.eyeDrops'),
      'GEL_CAPSULE': t('inventory.form.gelCapsule'),
      'GEL': t('inventory.form.gel'),
      'POWDER': t('inventory.form.powder')
    };
    return formMap[form] || form;
  };

  const removeStagedMedication = (id: string) => {
    setStagedMedications(prev => prev.filter(med => med.id !== id));
  };

  const confirmDispensation = async () => {
    if (stagedMedications.length === 0) {
      alert(t('dispensations.noStagedMedications'));
      return;
    }

    try {
      // Process each staged medication
      for (const medication of stagedMedications) {
        await inventoryApi.createInventoryAdjustment({
          itemId: medication.itemId,
          quantity: -medication.quantity, // Negative for dispensation
          reason: 'DISPENSATION',
          notes: `Dispensed: ${medication.name} (${translateForm(medication.form)}) - ${medication.expiryDate}`
        });
      }

      // Clear staging area and refresh data
      setStagedMedications([]);
      queryClient.invalidateQueries({ queryKey: ['current-stock-all'] });
      queryClient.invalidateQueries({ queryKey: ['recent-dispensations'] });
      
      alert(t('dispensations.dispensedSuccessfully'));
    } catch (error) {
      console.error('Dispensation error:', error);
      alert(t('dispensations.errorDispensing'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">{t('dispensations.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-center py-8">
        {t('dispensations.error')}
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50">
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('nav.dispensations')}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('dispensations.subtitle')}
            </p>
          </div>

          {/* Recent Prescribed Medications */}
          {recentDispensations?.logs && recentDispensations.logs.length > 0 && (
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {t('dispensations.recentPrescriptions')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentDispensations.logs.slice(0, 6).map((log: any) => (
                  <div key={log.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="text-sm font-medium text-gray-900">
                      {log.item?.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {log.item?.form && translateForm(log.item.form)}
                      {log.item?.expiryDate && ` | ${log.item.expiryDate}`}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="bg-white p-4 rounded-lg shadow">
            <input
              type="text"
              placeholder={t('dispensations.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Medication Pills Grid */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {t('dispensations.selectMedication')}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {filteredMedications.map((medication) => (
                <button
                  key={medication.id}
                  onClick={() => handleMedicationClick(medication)}
                  className="p-3 text-center border-2 border-blue-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {medication.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {medication.forms.length} {t('dispensations.forms')}
                  </div>
                </button>
              ))}
            </div>
            
            {filteredMedications.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {t('dispensations.noMedications')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Staging Sidebar */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col max-h-screen">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {t('dispensations.stagingArea')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t('dispensations.stagingSubtitle')}
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {stagedMedications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <div className="text-sm">{t('dispensations.noStagedItems')}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {stagedMedications.map((medication) => (
                <div key={medication.id} className="bg-gray-50 rounded-lg p-3 border">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {medication.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {translateForm(medication.form)} | {medication.expiryDate}
                      </div>
                    </div>
                    <button
                      onClick={() => removeStagedMedication(medication.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-sm font-medium text-blue-600">
                    {t('dispensations.quantity')}: {medication.quantity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <div className="mb-3">
            <div className="text-sm text-gray-600">
              {t('dispensations.totalItems')}: {stagedMedications.length}
            </div>
            <div className="text-sm text-gray-600">
              {t('dispensations.totalQuantity')}: {stagedMedications.reduce((sum, med) => sum + med.quantity, 0)}
            </div>
          </div>
          <button
            onClick={confirmDispensation}
            disabled={stagedMedications.length === 0}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {t('dispensations.confirmDispensation')}
          </button>
        </div>
      </div>

      {/* Dispensation Modal */}
      {showModal && selectedMedication && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('dispensations.dispenseMedication')}: {selectedMedication.name}
              </h3>
              
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Form Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('dispensations.form')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMedication.forms.map(form => (
                      <button
                        key={form}
                        type="button"
                        onClick={() => {
                          setDispensationForm(prev => ({ ...prev, form }));
                          // Update item ID when form changes
                          if (selectedMedication && dispensationForm.expiryDate) {
                            const newItemId = findItemId(selectedMedication.name, form, dispensationForm.expiryDate);
                            if (newItemId) {
                              setDispensationForm(prev => ({ ...prev, itemId: newItemId }));
                            }
                          }
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                          dispensationForm.form === form
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {translateForm(form)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expiry Date Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('dispensations.expiryDate')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMedication.expiryDates.map(date => (
                      <button
                        key={date}
                        type="button"
                        onClick={() => {
                          setDispensationForm(prev => ({ ...prev, expiryDate: date }));
                          // Update item ID when expiry date changes
                          if (selectedMedication && dispensationForm.form) {
                            const newItemId = findItemId(selectedMedication.name, dispensationForm.form, date);
                            if (newItemId) {
                              setDispensationForm(prev => ({ ...prev, itemId: newItemId }));
                            }
                          }
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                          dispensationForm.expiryDate === date
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {date}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('dispensations.quantity')}
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setDispensationForm(prev => ({ 
                        ...prev, 
                        quantity: Math.max(1, prev.quantity - 1) 
                      }))}
                      className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={dispensationForm.quantity}
                      onChange={(e) => setDispensationForm(prev => ({ 
                        ...prev, 
                        quantity: Math.max(1, parseInt(e.target.value) || 1) 
                      }))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setDispensationForm(prev => ({ 
                        ...prev, 
                        quantity: prev.quantity + 1 
                      }))}
                      className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>
                </div>


                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('dispensations.notes')} ({t('common.optional')})
                  </label>
                  <textarea
                    value={dispensationForm.notes}
                    onChange={(e) => setDispensationForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder={t('dispensations.notesPlaceholder')}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={dispensationMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {dispensationMutation.isPending ? t('common.saving') : t('dispensations.dispense')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
