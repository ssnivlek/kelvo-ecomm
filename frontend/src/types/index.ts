export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
  stockQuantity: number;
  sku?: string;
  slug?: string;
}

export interface CartItem {
  productId: string | number;
  productName: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
}

export interface User {
  email: string;
  name: string;
  createdAt?: string;
}

export interface OrderItemRequest {
  productId: number;
  quantity: number;
}

export interface CreateOrderRequest {
  customerEmail: string;
  customerName: string;
  shippingAddress?: string;
  items: OrderItemRequest[];
}

export interface Order {
  id: number;
  customerEmail: string;
  customerName: string;
  status: string;
  totalAmount: number;
  items?: Array<{ productId: number; quantity: number; productName?: string; price?: number }>;
}
