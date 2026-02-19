import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { datadogRum } from '@datadog/browser-rum';
import toast from 'react-hot-toast';
import {
  CartItem,
  CartTotals,
  Product,
} from '../types';
import {
  getCart,
  addToCart as apiAddToCart,
  updateCartItem as apiUpdateCartItem,
  removeFromCart as apiRemoveFromCart,
  clearCart as apiClearCart,
} from '../services/api';

const SESSION_KEY = 'rum_shop_session_id';
const TAX_RATE = 0.085;
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_COST = 5.99;

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function calculateTotals(items: CartItem[]): CartTotals {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const tax = (subtotal + shipping) * TAX_RATE;
  const total = subtotal + shipping + tax;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    shipping: Math.round(shipping * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

interface CartState {
  items: CartItem[];
  totals: CartTotals;
  isLoading: boolean;
  isDrawerOpen: boolean;
}

interface CartContextValue extends CartState {
  sessionId: string;
  addItem: (product: Product, quantity?: number) => Promise<void>;
  removeItem: (productId: string | number) => Promise<void>;
  updateQuantity: (productId: string | number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [sessionId] = useState(getSessionId);
  const [state, setState] = useState<CartState>({
    items: [],
    totals: { subtotal: 0, tax: 0, shipping: 0, total: 0 },
    isLoading: false,
    isDrawerOpen: false,
  });

  const loadCart = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await getCart(sessionId);
      setState((s) => ({
        ...s,
        items: res.items,
        totals: {
          subtotal: res.subtotal,
          tax: res.tax,
          shipping: res.shipping,
          total: res.total,
        },
        isLoading: false,
      }));
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [sessionId]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const addItem = useCallback(
    async (product: Product, quantity = 1) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const res = await apiAddToCart(sessionId, {
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity,
          imageUrl: product.imageUrl ?? null,
        });
        setState((s) => ({
          ...s,
          items: res.items,
          totals: {
            subtotal: res.subtotal,
            tax: res.tax,
            shipping: res.shipping,
            total: res.total,
          },
          isLoading: false,
          isDrawerOpen: true,
        }));
        toast.success(`Added ${product.name} to cart`);
        datadogRum.addAction('cart_add', {
          productId: product.id,
          productName: product.name,
          quantity,
        });
      } catch {
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity,
          imageUrl: product.imageUrl ?? null,
        };
        setState((s) => {
          const existing = s.items.find((i) => String(i.productId) === String(product.id));
          const items = existing
            ? s.items.map((i) =>
                String(i.productId) === String(product.id)
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              )
            : [...s.items, newItem];
          return {
            ...s,
            items,
            totals: calculateTotals(items),
            isLoading: false,
            isDrawerOpen: true,
          };
        });
        toast.success(`Added ${product.name} to cart`);
        datadogRum.addAction('cart_add', { productId: product.id, productName: product.name, quantity });
      }
    },
    [sessionId]
  );

  const removeItem = useCallback(
    async (productId: string | number) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const res = await apiRemoveFromCart(sessionId, productId);
        setState((s) => ({
          ...s,
          items: res.items,
          totals: {
            subtotal: res.subtotal,
            tax: res.tax,
            shipping: res.shipping,
            total: res.total,
          },
          isLoading: false,
        }));
        toast.success('Item removed from cart');
        datadogRum.addAction('cart_remove', { productId });
      } catch {
        setState((s) => {
          const items = s.items.filter((i) => String(i.productId) !== String(productId));
          return {
            ...s,
            items,
            totals: calculateTotals(items),
            isLoading: false,
          };
        });
        toast.success('Item removed from cart');
        datadogRum.addAction('cart_remove', { productId });
      }
    },
    [sessionId]
  );

  const updateQuantity = useCallback(
    async (productId: string | number, quantity: number) => {
      if (quantity < 1) {
        await removeItem(productId);
        return;
      }
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const res = await apiUpdateCartItem(sessionId, productId, quantity);
        setState((s) => ({
          ...s,
          items: res.items,
          totals: {
            subtotal: res.subtotal,
            tax: res.tax,
            shipping: res.shipping,
            total: res.total,
          },
          isLoading: false,
        }));
        datadogRum.addAction('cart_update', { productId, quantity });
      } catch {
        setState((s) => {
          const items = s.items.map((i) =>
            String(i.productId) === String(productId) ? { ...i, quantity } : i
          );
          return {
            ...s,
            items,
            totals: calculateTotals(items),
            isLoading: false,
          };
        });
        datadogRum.addAction('cart_update', { productId, quantity });
      }
    },
    [sessionId, removeItem]
  );

  const clearCart = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      await apiClearCart(sessionId);
      setState({
        items: [],
        totals: { subtotal: 0, tax: 0, shipping: 0, total: 0 },
        isLoading: false,
        isDrawerOpen: false,
      });
      toast.success('Cart cleared');
      datadogRum.addAction('cart_clear');
    } catch {
      setState({
        items: [],
        totals: { subtotal: 0, tax: 0, shipping: 0, total: 0 },
        isLoading: false,
        isDrawerOpen: false,
      });
      toast.success('Cart cleared');
      datadogRum.addAction('cart_clear');
    }
  }, [sessionId]);

  const openDrawer = useCallback(() => setState((s) => ({ ...s, isDrawerOpen: true })), []);
  const closeDrawer = useCallback(() => setState((s) => ({ ...s, isDrawerOpen: false })), []);
  const toggleDrawer = useCallback(
    () => setState((s) => ({ ...s, isDrawerOpen: !s.isDrawerOpen })),
    []
  );

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  const value: CartContextValue = {
    ...state,
    sessionId,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    itemCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
