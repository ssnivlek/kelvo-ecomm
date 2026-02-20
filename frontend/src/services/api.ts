import { Product, CartItem, CartTotals, User, CreateOrderRequest, Order } from '../types';
import { MOCK_PRODUCTS } from '../data/mockProducts';

const API_BASE = {
  orders: process.env.REACT_APP_ORDER_API || 'http://localhost:8080',
  cart: process.env.REACT_APP_CART_API || 'http://localhost:3001',
  auth: process.env.REACT_APP_AUTH_API || 'http://localhost:3002',
  payment: process.env.REACT_APP_PAYMENT_API || 'http://localhost:3003',
  search: process.env.REACT_APP_SEARCH_API || 'http://localhost:3004',
  recommendations: process.env.REACT_APP_RECOMMENDATIONS_API || 'http://localhost:3005',
  notifications: process.env.REACT_APP_NOTIFICATIONS_API || 'http://localhost:3006',
};

async function fetchWithError<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'omit',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`);
    }
    return data as T;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Network error');
  }
}

// Products
export async function fetchProducts(category?: string): Promise<Product[]> {
  try {
    const url = category
      ? `${API_BASE.orders}/api/products?category=${encodeURIComponent(category)}`
      : `${API_BASE.orders}/api/products`;
    return await fetchWithError<Product[]>(url);
  } catch {
    return MOCK_PRODUCTS.filter((p) => !category || p.category === category);
  }
}

export async function fetchProduct(id: number): Promise<Product | null> {
  try {
    return await fetchWithError<Product>(`${API_BASE.orders}/api/products/${id}`);
  } catch {
    return MOCK_PRODUCTS.find((p) => p.id === id) ?? null;
  }
}

export interface SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'name';
}

export async function searchProducts(
  query: string,
  filters?: SearchFilters
): Promise<Product[]> {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.minPrice != null) params.set('minPrice', String(filters.minPrice));
    if (filters?.maxPrice != null) params.set('maxPrice', String(filters.maxPrice));
    if (filters?.sort) params.set('sort', filters.sort);
    const url = `${API_BASE.search}/api/search?${params}`;
    const res = await fetchWithError<{ products: Product[] }>(url);
    return res.products || [];
  } catch {
    let results = MOCK_PRODUCTS;
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    if (filters?.category) {
      results = results.filter((p) => p.category === filters!.category);
    }
    if (filters?.minPrice != null) {
      results = results.filter((p) => p.price >= filters!.minPrice!);
    }
    if (filters?.maxPrice != null) {
      results = results.filter((p) => p.price <= filters!.maxPrice!);
    }
    if (filters?.sort === 'price_asc') results.sort((a, b) => a.price - b.price);
    if (filters?.sort === 'price_desc') results.sort((a, b) => b.price - a.price);
    if (filters?.sort === 'name') results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }
}

// Cart
export interface CartResponse {
  items: CartItem[];
  coupon?: string | null;
  subtotal: number;
  discount?: number;
  tax: number;
  shipping: number;
  total: number;
}

export async function getCart(sessionId: string): Promise<CartResponse> {
  try {
    return await fetchWithError<CartResponse>(
      `${API_BASE.cart}/api/cart/${sessionId}`
    );
  } catch {
    return { items: [], subtotal: 0, tax: 0, shipping: 0, total: 0 };
  }
}

export async function addToCart(
  sessionId: string,
  item: Omit<CartItem, 'quantity'> & { quantity?: number }
): Promise<CartResponse> {
  try {
    const res = await fetchWithError<{ cart: CartResponse }>(
      `${API_BASE.cart}/api/cart/add`,
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          productId: String(item.productId),
          productName: item.productName,
          price: item.price,
          quantity: item.quantity ?? 1,
          imageUrl: item.imageUrl ?? null,
        }),
      }
    );
    return res.cart;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to add to cart');
  }
}

export async function updateCartItem(
  sessionId: string,
  productId: string | number,
  quantity: number
): Promise<CartResponse> {
  try {
    const res = await fetchWithError<{ cart: CartResponse }>(
      `${API_BASE.cart}/api/cart/update`,
      {
        method: 'PUT',
        body: JSON.stringify({
          sessionId,
          productId: String(productId),
          quantity,
        }),
      }
    );
    return res.cart;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update cart');
  }
}

export async function removeFromCart(
  sessionId: string,
  productId: string | number
): Promise<CartResponse> {
  try {
    return await fetchWithError<CartResponse>(
      `${API_BASE.cart}/api/cart/${sessionId}/item/${productId}`,
      { method: 'DELETE' }
    );
  } catch {
    throw new Error('Failed to remove from cart');
  }
}

export async function clearCart(sessionId: string): Promise<CartResponse> {
  try {
    return await fetchWithError<CartResponse>(
      `${API_BASE.cart}/api/cart/${sessionId}`,
      { method: 'DELETE' }
    );
  } catch {
    return { items: [], subtotal: 0, tax: 0, shipping: 0, total: 0 };
  }
}

export async function applyCoupon(
  sessionId: string,
  couponCode: string
): Promise<{ cart: CartResponse; message: string }> {
  return fetchWithError<{ cart: CartResponse; message: string }>(
    `${API_BASE.cart}/api/cart/apply-coupon`,
    {
      method: 'POST',
      body: JSON.stringify({ sessionId, couponCode }),
    }
  );
}

export async function removeCoupon(
  sessionId: string
): Promise<{ cart: CartResponse; message: string }> {
  return fetchWithError<{ cart: CartResponse; message: string }>(
    `${API_BASE.cart}/api/cart/remove-coupon`,
    {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }
  );
}

// Auth
export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: User }> {
  try {
    const res = await fetchWithError<{ token: string; user: User }>(
      `${API_BASE.auth}/api/auth/login`,
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    return res;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Login failed');
  }
}

export async function register(
  email: string,
  name: string,
  password: string
): Promise<{ token: string; user: User }> {
  try {
    const res = await fetchWithError<{ token: string; user: User }>(
      `${API_BASE.auth}/api/auth/register`,
      {
        method: 'POST',
        body: JSON.stringify({ email, name, password }),
      }
    );
    return res;
  } catch (err) {
    throw err instanceof Error ? err : new Error('Registration failed');
  }
}

export async function getProfile(token: string): Promise<User> {
  const res = await fetchWithError<{ user: User }>(
    `${API_BASE.auth}/api/auth/profile`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.user;
}

// Payment
export async function createPaymentIntent(
  amount: number,
  currency: string,
  email: string,
  orderId: string
): Promise<{ paymentIntentId: string; clientSecret: string }> {
  try {
    const res = await fetchWithError<{
      paymentIntentId: string;
      clientSecret: string;
    }>(`${API_BASE.payment}/api/payment/create-intent`, {
      method: 'POST',
      body: JSON.stringify({
        amount,
        currency,
        customerEmail: email,
        orderId,
      }),
    });
    return res;
  } catch {
    return {
      paymentIntentId: `pi_mock_${orderId}`,
      clientSecret: `secret_${orderId}`,
    };
  }
}

export async function confirmPayment(
  intentId: string
): Promise<{ status: string; receiptUrl?: string }> {
  try {
    return await fetchWithError<{ status: string; receiptUrl?: string }>(
      `${API_BASE.payment}/api/payment/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ paymentIntentId: intentId }),
      }
    );
  } catch {
    return { status: 'succeeded' };
  }
}

// Orders
export async function createOrder(
  orderData: CreateOrderRequest,
  fallbackTotal?: number
): Promise<Order> {
  try {
    return await fetchWithError<Order>(`${API_BASE.orders}/api/orders`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  } catch {
    const totalAmount =
      fallbackTotal ??
      orderData.items.reduce((sum, item) => {
        const product = MOCK_PRODUCTS.find((p) => p.id === item.productId);
        return sum + (product?.price ?? 0) * item.quantity;
      }, 0);
    const mockOrder: Order = {
      id: Date.now(),
      customerEmail: orderData.customerEmail,
      customerName: orderData.customerName,
      status: 'CONFIRMED',
      totalAmount,
    };
    return mockOrder;
  }
}

export async function getOrder(id: number): Promise<Order | null> {
  try {
    return await fetchWithError<Order>(`${API_BASE.orders}/api/orders/${id}`);
  } catch {
    return null;
  }
}

// Recommendations
export async function getRecommendations(
  productId?: number,
  limit = 4
): Promise<Product[]> {
  try {
    const params = new URLSearchParams();
    if (productId) params.set('productId', String(productId));
    params.set('limit', String(limit));
    const res = await fetchWithError<{ recommendations: Product[] }>(
      `${API_BASE.recommendations}/api/recommendations?${params}`
    );
    return res.recommendations || [];
  } catch {
    const exclude = productId ? MOCK_PRODUCTS.find((p) => p.id === productId) : null;
    const category = exclude?.category;
    const filtered = category
      ? MOCK_PRODUCTS.filter(
          (p) => p.category === category && p.id !== productId
        )
      : MOCK_PRODUCTS;
    return filtered.slice(0, limit);
  }
}

// Notifications
export async function sendOrderConfirmation(data: {
  orderId: string | number;
  customerEmail: string;
  customerName: string;
  items: Array<{ productName: string; quantity: number; price: number }>;
  totalAmount: number;
}): Promise<{ success: boolean }> {
  try {
    const res = await fetchWithError<{ success: boolean }>(
      `${API_BASE.notifications}/api/notifications/order-confirmation`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return res;
  } catch {
    return { success: true };
  }
}
