import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

declare global {
  interface Window { DD_RUM?: any; DD_LOGS?: any; }
}
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
  applyCoupon as apiApplyCoupon,
  removeCoupon as apiRemoveCoupon,
} from '../services/api';

const SESSION_KEY = 'kelvo_ecomm_session_id';
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

function applyServerTotals(res: any): CartTotals {
  return {
    subtotal: res.subtotal ?? 0,
    discount: res.discount ?? 0,
    tax: res.tax ?? 0,
    shipping: res.shipping ?? 0,
    total: res.total ?? 0,
  };
}

interface CartState {
  items: CartItem[];
  totals: CartTotals;
  coupon: string | null;
  isLoading: boolean;
  isDrawerOpen: boolean;
}

interface CartContextValue extends CartState {
  sessionId: string;
  addItem: (product: Product, quantity?: number) => Promise<void>;
  removeItem: (productId: string | number) => Promise<void>;
  updateQuantity: (productId: string | number, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
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
    coupon: null,
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
        coupon: res.coupon ?? null,
        totals: applyServerTotals(res),
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
          coupon: res.coupon ?? s.coupon,
          totals: applyServerTotals(res),
          isLoading: false,
          isDrawerOpen: true,
        }));
        toast.success(`Added ${product.name} to cart`);
        window.DD_RUM?.addAction('cart_add', {
          productId: product.id,
          productName: product.name,
          quantity,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error adding item');
        setState((s) => ({ ...s, isLoading: false }));
        window.DD_RUM?.addAction('cart_add_error', {
          productId: product.id,
          productName: product.name,
          quantity,
        });
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
          totals: applyServerTotals(res),
          isLoading: false,
        }));
        toast.success('Item removed from cart');
        window.DD_RUM?.addAction('cart_remove', { productId });
      } catch {
        setState((s) => {
          const items = s.items.filter((i) => String(i.productId) !== String(productId));
          return { ...s, items, totals: calculateTotals(items), isLoading: false };
        });
        toast.success('Item removed from cart');
        window.DD_RUM?.addAction('cart_remove', { productId });
      }
    },
    [sessionId]
  );

  const updateQuantity = useCallback(
    async (productId: string | number, quantity: number) => {
      if (quantity < 1) { await removeItem(productId); return; }
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const res = await apiUpdateCartItem(sessionId, productId, quantity);
        setState((s) => ({
          ...s,
          items: res.items,
          totals: applyServerTotals(res),
          isLoading: false,
        }));
        window.DD_RUM?.addAction('cart_update', { productId, quantity });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error updating item');
        setState((s) => ({ ...s, isLoading: false }));
      }
    },
    [sessionId, removeItem]
  );

  const clearCartAction = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      await apiClearCart(sessionId);
    } catch { /* ignore */ }
    setState({
      items: [],
      totals: { subtotal: 0, tax: 0, shipping: 0, total: 0 },
      coupon: null,
      isLoading: false,
      isDrawerOpen: false,
    });
    toast.success('Cart cleared');
    window.DD_RUM?.addAction('cart_clear');
  }, [sessionId]);

  const applyCoupon = useCallback(async (code: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await apiApplyCoupon(sessionId, code);
      setState((s) => ({
        ...s,
        items: res.cart.items,
        coupon: res.cart.coupon ?? code.toUpperCase(),
        totals: applyServerTotals(res.cart),
        isLoading: false,
      }));
      toast.success(res.message || 'Coupon applied');
      window.DD_RUM?.addAction('coupon_apply', { code: code.toUpperCase(), success: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not apply coupon code');
      setState((s) => ({ ...s, isLoading: false }));
      window.DD_RUM?.addAction('coupon_apply_error', { code: code.toUpperCase() });
    }
  }, [sessionId]);

  const removeCouponAction = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await apiRemoveCoupon(sessionId);
      setState((s) => ({
        ...s,
        items: res.cart.items,
        coupon: null,
        totals: applyServerTotals(res.cart),
        isLoading: false,
      }));
      toast.success('Coupon removed');
      window.DD_RUM?.addAction('coupon_remove');
    } catch {
      setState((s) => ({ ...s, coupon: null, isLoading: false }));
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
    clearCart: clearCartAction,
    applyCoupon,
    removeCoupon: removeCouponAction,
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
