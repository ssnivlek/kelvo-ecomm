import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTag, FiX } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  createOrder,
  createPaymentIntent,
  confirmPayment,
  sendOrderConfirmation,
} from '../services/api';
import { CreateOrderRequest } from '../types';
import './CheckoutPage.css';

const PLACEHOLDER_IMG = '/images/products/placeholder.svg';

export function CheckoutPage() {
  const navigate = useNavigate();
  const { items, totals, coupon, sessionId, clearCart, applyCoupon, removeCoupon, isLoading } = useCart();
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'error'>('form');
  const [orderId, setOrderId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    address: '',
    city: '',
    zip: '',
    cardNumber: '4242424242424242',
    exp: '12/28',
    cvc: '123',
  });
  const [couponInput, setCouponInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMsg('Your cart is empty');
      return;
    }

    setStep('processing');
    setErrorMsg('');
    window.DD_RUM?.addAction('checkout_start');

    try {
      const orderData: CreateOrderRequest = {
        customerEmail: form.email,
        customerName: form.name,
        shippingAddress: [form.address, form.city, form.zip].filter(Boolean).join(', '),
        items: items.map((i) => ({
          productId: Number(i.productId),
          quantity: i.quantity,
        })),
      };

      const order = await createOrder(orderData, totals.total);
      setOrderId(order.id);
      window.DD_RUM?.addAction('checkout_order_created', { orderId: order.id });

      const { paymentIntentId } = await createPaymentIntent(
        totals.total,
        'usd',
        form.email,
        String(order.id)
      );
      window.DD_RUM?.addAction('checkout_payment_intent_created');

      await confirmPayment(paymentIntentId);
      window.DD_RUM?.addAction('checkout_payment_confirmed');

      await sendOrderConfirmation({
        orderId: order.id,
        customerEmail: form.email,
        customerName: form.name,
        items: items.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          price: i.price,
        })),
        totalAmount: totals.total,
      });

      await clearCart();
      setStep('success');
      window.DD_RUM?.addAction('checkout_complete', { orderId: order.id });
      window.DD_RUM?.addAction('session_end', { reason: 'checkout_completed', orderId: order.id });
      window.DD_RUM?.stopSession();
      navigate(`/order-confirmation/${order.id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Checkout failed');
      setStep('error');
      window.DD_RUM?.addError(err instanceof Error ? err : new Error('Checkout failed'), {
        source: 'custom',
        context: { step: 'checkout', itemCount: items.length, total: totals.total },
      });
    }
  };

  if (items.length === 0 && step !== 'success' && step !== 'error') {
    return (
      <main className="checkout-page section">
        <div className="container">
          <div className="checkout-empty">
            <h2>Your cart is empty</h2>
            <p>Add some products before checkout.</p>
            <button onClick={() => navigate('/products')} className="btn btn-primary">
              Browse Products
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (step === 'processing') {
    return (
      <main className="checkout-page section">
        <div className="container">
          <div className="checkout-processing">
            <div className="spinner" />
            <h2>Processing your order...</h2>
            <p>Please wait while we complete your purchase.</p>
          </div>
        </div>
      </main>
    );
  }

  if (step === 'success' && orderId) {
    return (
      <main className="checkout-page section">
        <div className="container">
          <div className="checkout-success">
            <div className="success-icon">✓</div>
            <h2>Order Placed Successfully!</h2>
            <p>Order #{orderId}</p>
            <button onClick={() => navigate('/products')} className="btn btn-primary">
              Continue Shopping
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-page section">
      <div className="container">
        <h1 className="page-title">Checkout</h1>

        {step === 'error' && errorMsg && (
          <div className="checkout-error">
            <p>{errorMsg}</p>
            <button onClick={() => setStep('form')} className="btn btn-outline">
              Try Again
            </button>
          </div>
        )}

        <form className="checkout-layout" onSubmit={handleSubmit}>
          <div className="checkout-form-section">
            <h2>Shipping Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="address">Address</label>
                <input
                  id="address"
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="city">City</label>
                <input
                  id="city"
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="zip">ZIP Code</label>
                <input
                  id="zip"
                  type="text"
                  value={form.zip}
                  onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))}
                />
              </div>
            </div>

            <h2>Payment</h2>
            <div className="form-group">
              <label>Card Number</label>
              <input
                type="text"
                value={form.cardNumber}
                onChange={(e) => setForm((f) => ({ ...f, cardNumber: e.target.value }))}
                placeholder="4242 4242 4242 4242"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Expiry</label>
                <input
                  type="text"
                  value={form.exp}
                  onChange={(e) => setForm((f) => ({ ...f, exp: e.target.value }))}
                  placeholder="MM/YY"
                />
              </div>
              <div className="form-group">
                <label>CVC</label>
                <input
                  type="text"
                  value={form.cvc}
                  onChange={(e) => setForm((f) => ({ ...f, cvc: e.target.value }))}
                  placeholder="123"
                />
              </div>
            </div>
          </div>

          <div className="checkout-summary">
            <div className="summary-card">
              <h2>Order Summary</h2>
              <ul className="summary-items">
                {items.map((item) => (
                  <li key={item.productId} className="summary-item">
                    <img
                      src={item.imageUrl || PLACEHOLDER_IMG}
                      alt={item.productName}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                      }}
                    />
                    <div>
                      <span>{item.productName}</span>
                      <span>×{item.quantity}</span>
                    </div>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              <div className="checkout-coupon">
                {coupon ? (
                  <div className="coupon-applied">
                    <FiTag size={14} />
                    <span className="coupon-code">{coupon}</span>
                    <button className="coupon-remove-btn" onClick={removeCoupon} type="button">
                      <FiX size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="coupon-input-row">
                    <input
                      type="text"
                      className="coupon-input"
                      placeholder="Coupon code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (couponInput.trim()) applyCoupon(couponInput.trim());
                          setCouponInput('');
                        }
                      }}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="btn btn-sm coupon-apply-btn"
                      onClick={() => { if (couponInput.trim()) applyCoupon(couponInput.trim()); setCouponInput(''); }}
                      disabled={isLoading || !couponInput.trim()}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              <div className="summary-totals">
                <div><span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span></div>
                {(totals.discount ?? 0) > 0 && (
                  <div className="discount-row"><span>Discount</span><span>-${(totals.discount ?? 0).toFixed(2)}</span></div>
                )}
                <div><span>Tax</span><span>${totals.tax.toFixed(2)}</span></div>
                <div><span>Shipping</span><span>{totals.shipping === 0 ? 'Free' : `$${totals.shipping.toFixed(2)}`}</span></div>
                <div className="total-row"><span>Total</span><span>${totals.total.toFixed(2)}</span></div>
              </div>
              <button type="submit" className="btn btn-primary place-order-btn">
                Place Order
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
