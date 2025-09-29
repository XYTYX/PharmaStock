import axios from 'axios';
import { LoginRequest, LoginResponse, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  getCurrentUser: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Products API
export const productsApi = {
  getProducts: async (params?: any) => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  getProduct: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  createProduct: async (data: any) => {
    const response = await api.post('/products', data);
    return response.data;
  },

  updateProduct: async (id: string, data: any) => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },

  deleteProduct: async (id: string) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },

  getLowStockProducts: async () => {
    const response = await api.get('/products/alerts/low-stock');
    return response.data;
  },
};

// Categories API
export const categoriesApi = {
  getCategories: async () => {
    const response = await api.get('/categories');
    return response.data;
  },

  getCategory: async (id: string) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  createCategory: async (data: any) => {
    const response = await api.post('/categories', data);
    return response.data;
  },

  updateCategory: async (id: string, data: any) => {
    const response = await api.put(`/categories/${id}`, data);
    return response.data;
  },

  deleteCategory: async (id: string) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },
};

// Suppliers API
export const suppliersApi = {
  getSuppliers: async () => {
    const response = await api.get('/suppliers');
    return response.data;
  },

  getSupplier: async (id: string) => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  createSupplier: async (data: any) => {
    const response = await api.post('/suppliers', data);
    return response.data;
  },

  updateSupplier: async (id: string, data: any) => {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data;
  },

  deleteSupplier: async (id: string) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },
};

// Purchase Orders API
export const purchaseOrdersApi = {
  getPurchaseOrders: async (params?: any) => {
    const response = await api.get('/purchase-orders', { params });
    return response.data;
  },

  getPurchaseOrder: async (id: string) => {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data;
  },

  createPurchaseOrder: async (data: any) => {
    const response = await api.post('/purchase-orders', data);
    return response.data;
  },

  updatePurchaseOrderStatus: async (id: string, status: string) => {
    const response = await api.patch(`/purchase-orders/${id}/status`, { status });
    return response.data;
  },

  receivePurchaseOrder: async (id: string, receivedItems: any[]) => {
    const response = await api.post(`/purchase-orders/${id}/receive`, { receivedItems });
    return response.data;
  },
};

// Sales API
export const salesApi = {
  getSales: async (params?: any) => {
    const response = await api.get('/sales', { params });
    return response.data;
  },

  getSale: async (id: string) => {
    const response = await api.get(`/sales/${id}`);
    return response.data;
  },

  createSale: async (data: any) => {
    const response = await api.post('/sales', data);
    return response.data;
  },

  getDailySummary: async (date?: string) => {
    const response = await api.get('/sales/summary/daily', { 
      params: date ? { date } : {} 
    });
    return response.data;
  },
};

// Inventory API
export const inventoryApi = {
  getInventoryLogs: async (params?: any) => {
    const response = await api.get('/inventory/logs', { params });
    return response.data;
  },

  createInventoryAdjustment: async (data: any) => {
    const response = await api.post('/inventory/adjust', data);
    return response.data;
  },

  getStockAlerts: async () => {
    const response = await api.get('/inventory/alerts');
    return response.data;
  },

  getInventorySummary: async () => {
    const response = await api.get('/inventory/summary');
    return response.data;
  },
};

// Reports API
export const reportsApi = {
  getSalesReport: async (params?: any) => {
    const response = await api.get('/reports/sales', { params });
    return response.data;
  },

  getInventoryReport: async (params?: any) => {
    const response = await api.get('/reports/inventory', { params });
    return response.data;
  },

  getPurchaseOrdersReport: async (params?: any) => {
    const response = await api.get('/reports/purchase-orders', { params });
    return response.data;
  },

  getTopProducts: async (params?: any) => {
    const response = await api.get('/reports/top-products', { params });
    return response.data;
  },

  getDashboardData: async () => {
    const response = await api.get('/reports/dashboard');
    return response.data;
  },
};

export default api;
