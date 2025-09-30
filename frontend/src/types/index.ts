export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'PHARMACIST' | 'TECHNICIAN';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
  };
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  internalId: string;
  sku: string;
  barcode?: string;
  categoryId: string;
  supplierId: string;
  unitPrice: number;
  costPrice: number;
  currentStock: number;
  unit: string;
  medicineType: 'TABLET' | 'CAPSULE' | 'GEL' | 'EYE_DROPS';
  isPrescription: boolean;
  requiresRefrigerator: boolean;
  isActive: boolean;
  expiryDate?: string; // Format: MM-YYYY
  createdAt: string;
  updatedAt: string;
  category?: Category;
  supplier?: Supplier;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  totalAmount: number;
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  user?: User;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity: number;
  createdAt: string;
  updatedAt: string;
  product?: Product;
}

export interface Dispensation {
  id: string;
  dispensationNumber: string;
  userId: string;
  patientName?: string;
  patientId?: string;
  prescriptionNumber?: string;
  totalAmount: number;
  dispensationDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
  items?: DispensationItem[];
}

export interface DispensationItem {
  id: string;
  dispensationId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
  product?: Product;
}

export interface InventoryLog {
  id: string;
  productId: string;
  userId: string;
  type: 'PURCHASE' | 'DISPENSATION' | 'ADJUSTMENT' | 'TRANSFER' | 'EXPIRED' | 'DAMAGED' | 'RETURN';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  reference?: string;
  createdAt: string;
  product?: Product;
  user?: User;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  pagination?: Pagination;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface DashboardData {
  todayDispensations: {
    count: number;
    totalAmount: number;
  };
  inventory: {
    totalProducts: number;
    pendingOrders: number;
  };
  recentDispensations: Dispensation[];
  recentInventoryLogs: InventoryLog[];
}
