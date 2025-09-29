import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuthStore } from '../store/authStore';
import { usersApi } from '../services/api';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon
} from '@heroicons/react/24/outline';

interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'PHARMACIST' | 'TECHNICIAN';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserFormData {
  username: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'PHARMACIST' | 'TECHNICIAN';
}

export default function UsersPage() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: 'TECHNICIAN'
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'ADMIN';

  // If user is not admin, show access denied message
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.users')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('users.subtitle')}</p>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center">
            <div className="text-red-600 text-lg font-medium mb-2">{t('users.accessDenied')}</div>
            <p className="text-gray-500">{t('users.noPermission')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch users with React Query
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['users', { search: searchTerm, role: roleFilter, page: currentPage }],
    queryFn: () => usersApi.getUsers({
      search: searchTerm,
      role: roleFilter,
      page: currentPage.toString(),
      limit: '10'
    }),
    enabled: isAdmin
  });

  const users = usersData?.users || [];

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data: Omit<UserFormData, 'confirmPassword'>) => usersApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccessMessage(t('users.userCreatedSuccess'));
      setErrorMessage(null);
      handleCancel();
    },
    onError: (error: any) => {
      console.error('Error creating user:', error);
      setErrorMessage(error.response?.data?.error || t('users.createError'));
      setSuccessMessage(null);
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserFormData> }) => 
      usersApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccessMessage(t('users.userUpdatedSuccess'));
      setErrorMessage(null);
      handleCancel();
    },
    onError: (error: any) => {
      console.error('Error updating user:', error);
      setErrorMessage(error.response?.data?.error || t('users.updateError'));
      setSuccessMessage(null);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccessMessage(t('users.userDeletedSuccess'));
      setErrorMessage(null);
      setShowDeleteConfirm(null);
    },
    onError: (error: any) => {
      console.error('Error deleting user:', error);
      setErrorMessage(error.response?.data?.error || t('users.deleteError'));
      setSuccessMessage(null);
    }
  });

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      role: 'TECHNICIAN'
    });
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.username.trim()) {
      errors.username = t('users.usernameRequired');
    }
    if (!formData.firstName.trim()) {
      errors.firstName = t('users.firstNameRequired');
    }
    if (!formData.lastName.trim()) {
      errors.lastName = t('users.lastNameRequired');
    }
    if (!formData.role) {
      errors.role = t('users.roleRequired');
    }

    // For new users or when password is provided
    if (isAdding || formData.password) {
      if (!formData.password) {
        errors.password = t('users.passwordRequired');
      } else if (formData.password.length < 6) {
        errors.password = t('users.passwordMinLength');
      }
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = t('users.passwordMismatch');
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const { confirmPassword, ...userData } = formData;

    if (isAdding) {
      createUserMutation.mutate(userData);
    } else if (isEditing && editingUser) {
      // For updates, only include password if it's provided
      const updateData = userData.password 
        ? userData 
        : { username: userData.username, firstName: userData.firstName, lastName: userData.lastName, role: userData.role };
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      confirmPassword: '',
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    });
    setIsEditing(true);
    setIsAdding(false);
  };

  const handleAdd = () => {
    resetForm();
    setIsAdding(true);
    setIsEditing(false);
    setEditingUser(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsAdding(false);
    setEditingUser(null);
    resetForm();
  };

  const handleDelete = async (userId: string) => {
    deleteUserMutation.mutate(userId);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return t('users.roleAdmin');
      case 'PHARMACIST': return t('users.rolePharmacist');
      case 'TECHNICIAN': return t('users.roleTechnician');
      default: return role;
    }
  };

  const getStatusLabel = (isActive: boolean) => {
    return isActive ? t('users.statusActive') : t('users.statusInactive');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.users')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('users.subtitle')}</p>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">{t('users.loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.users')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('users.subtitle')}</p>
        </div>
        <div className="text-red-600 text-center py-8">
          {t('users.error')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav.users')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('users.subtitle')}</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleAdd}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            {t('users.addUser')}
          </button>
        )}
      </div>

      {/* Error/Success Messages */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {t('users.error')}
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {errorMessage}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setErrorMessage(null)}
                  className="bg-red-50 px-2 py-1.5 rounded-md text-sm font-medium text-red-800 hover:bg-red-100"
                >
                  {t('users.dismiss')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                {t('users.success')}
              </h3>
              <div className="mt-2 text-sm text-green-700">
                {successMessage}
              </div>
              <div className="mt-4">
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="bg-green-50 px-2 py-1.5 rounded-md text-sm font-medium text-green-800 hover:bg-green-100"
                >
                  {t('users.dismiss')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              {t('users.search')}
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page when searching
              }}
              placeholder={t('users.searchPlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="roleFilter" className="block text-sm font-medium text-gray-700 mb-1">
              {t('users.filterByRole')}
            </label>
            <select
              id="roleFilter"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1); // Reset to first page when filtering
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('users.allRoles')}</option>
              <option value="ADMIN">{t('users.roleAdmin')}</option>
              <option value="PHARMACIST">{t('users.rolePharmacist')}</option>
              <option value="TECHNICIAN">{t('users.roleTechnician')}</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('');
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t('users.clearFilters')}
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('users.username')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('users.firstName')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('users.lastName')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('users.role')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('users.status')}
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('users.actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users && Array.isArray(users) && users.length > 0 ? users.map((user: User) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.firstName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getRoleLabel(user.role)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {getStatusLabel(user.isActive)}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )) : (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-4 text-center text-sm text-gray-500">
                    {isLoading ? t('users.loading') : 'No users found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {usersData?.pagination && usersData.pagination.pages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('users.previous')}
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(usersData.pagination.pages, prev + 1))}
              disabled={currentPage === usersData.pagination.pages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('users.next')}
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                {t('users.showing')} <span className="font-medium">{((currentPage - 1) * 10) + 1}</span> {t('users.to')} <span className="font-medium">{Math.min(currentPage * 10, usersData.pagination.total)}</span> {t('users.of')} <span className="font-medium">{usersData.pagination.total}</span> {t('users.results')}
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('users.previous')}
                </button>
                {Array.from({ length: usersData.pagination.pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === currentPage
                        ? 'z-10 bg-primary-50 border-primary-500 text-primary-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(usersData.pagination.pages, prev + 1))}
                  disabled={currentPage === usersData.pagination.pages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('users.next')}
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {(isAdding || isEditing) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {isAdding ? t('users.addUser') : t('users.editUser')}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('users.username')}
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isEditing} // Don't allow username changes when editing
                  />
                  {formErrors.username && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.username}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {isAdding ? t('users.password') : t('users.newPassword')}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={isEditing ? "Leave blank to keep current password" : ""}
                  />
                  {formErrors.password && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                  )}
                </div>

                {(isAdding || formData.password) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('users.confirmPassword')}
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {formErrors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.confirmPassword}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('users.firstName')}
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('users.lastName')}
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.lastName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('users.role')}
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="TECHNICIAN">{t('users.roleTechnician')}</option>
                    <option value="PHARMACIST">{t('users.rolePharmacist')}</option>
                    <option value="ADMIN">{t('users.roleAdmin')}</option>
                  </select>
                  {formErrors.role && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t('users.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    {createUserMutation.isPending || updateUserMutation.isPending ? t('users.saving') : t('users.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('users.deleteUser')}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {t('users.confirmDelete')}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t('users.cancel')}
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  disabled={deleteUserMutation.isPending}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {deleteUserMutation.isPending ? t('users.deleting') : t('users.deleteUser')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
