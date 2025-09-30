import axios from 'axios';
import { LoginRequest, LoginResponse, User } from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

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

// Items API
export const itemsApi = {
  getItems: async (params?: any) => {
    const response = await api.get('/items', { params });
    return response.data;
  },

  getItem: async (id: string) => {
    const response = await api.get(`/items/${id}`);
    return response.data;
  },

  createItem: async (data: any) => {
    const response = await api.post('/items', data);
    return response.data;
  },

  updateItem: async (id: string, data: any) => {
    const response = await api.put(`/items/${id}`, data);
    return response.data;
  },

  deleteItem: async (id: string) => {
    const response = await api.delete(`/items/${id}`);
    return response.data;
  },
};

// Inventory API
export const inventoryApi = {
  getInventoryLogs: async (params?: any) => {
    const response = await api.get('/inventory/logs', { params });
    return response.data;
  },

  getCurrentStock: async (params?: any) => {
    const response = await api.get('/inventory/stock', { params });
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

  // Admin item management
  createItem: async (data: any) => {
    const response = await api.post('/inventory/items', data);
    return response.data;
  },

  updateItem: async (id: string, data: any) => {
    const response = await api.put(`/inventory/items/${id}`, data);
    return response.data;
  },

  updateItemStock: async (id: string, currentStock: number) => {
    const response = await api.put(`/inventory/items/${id}/stock`, { currentStock });
    return response.data;
  },
};

// Users API
export const usersApi = {
  getUsers: async (params?: any) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getUser: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  createUser: async (data: any) => {
    const response = await api.post('/users', data);
    return response.data;
  },

  updateUser: async (id: string, data: any) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  changePassword: async (id: string, data: any) => {
    const response = await api.post(`/users/${id}/change-password`, data);
    return response.data;
  },

  deactivateUser: async (id: string) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};

export default api;
