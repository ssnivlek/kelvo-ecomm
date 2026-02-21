import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiX, FiMinus, FiPlus, FiShoppingBag, FiTag } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import './CartDrawer.css';

const PLACEHOLDER_IMG = '/images/products/placeholder.svg';

export function CartDrawer() {
  const { t } = useTranslation();
  const {
    items,
    totals,
    coupon,
    isDrawerOpen,
    closeDrawer,
    updateQuantity,
    removeItem,
    applyCoupon,
    removeCoupon,
    isLoading,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    await applyCoupon(couponInput.trim());
    setCouponInput('');
  };

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <>
          <motion.div
            key="cart-overlay"
            className="cart-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeDrawer}
          />
          <motion.aside
            key="cart-drawer"
            className="cart-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="cart-drawer-header">
              <h2>{t('cart.title')}</h2>
              <button
                className="icon-btn close-btn"
                onClick={closeDrawer}
                aria-label="Close cart"
              >
                <FiX size={24} />
              </button>
            </div>

            <div className="cart-drawer-body">
              {items.length === 0 ? (
                <div className="cart-empty">
                  <FiShoppingBag size={48} className="empty-icon" />
                  <p>{t('cart.empty')}</p>
                  <Link to="/products" className="btn btn-primary" onClick={closeDrawer}>
                    {t('cart.browse')}
                  </Link>
                </div>
              ) : (
                <>
                  <ul className="cart-items">
                    {items.map((item) => (
                      <li key={item.productId} className="cart-item">
                        <div className="cart-item-image">
                          <img
                            src={item.imageUrl || PLACEHOLDER_IMG}
                            alt={item.productName}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = PLACEHOLDER_IMG;
                            }}
                          />
                        </div>
                        <div className="cart-item-details">
                          <span className="cart-item-name">{item.productName}</span>
                          <span className="cart-item-price">${item.price.toFixed(2)}</span>
                          <div className="cart-item-actions">
                            <div className="quantity-controls">
                              <button
                                className="qty-btn"
                                onClick={() =>
                                  updateQuantity(item.productId, item.quantity - 1)
                                }
                                aria-label="Decrease quantity"
                              >
                                <FiMinus size={14} />
                              </button>
                              <span className="qty-value">{item.quantity}</span>
                              <button
                                className="qty-btn"
                                onClick={() =>
                                  updateQuantity(item.productId, item.quantity + 1)
                                }
                                aria-label="Increase quantity"
                              >
                                <FiPlus size={14} />
                              </button>
                            </div>
                            <button
                              className="remove-btn"
                              onClick={() => removeItem(item.productId)}
                            >
                              {t('cart.remove')}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="coupon-section">
                    {coupon ? (
                      <div className="coupon-applied">
                        <FiTag size={14} />
                        <span className="coupon-code">{coupon}</span>
                        <button className="coupon-remove-btn" onClick={removeCoupon}>
                          <FiX size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="coupon-input-row">
                        <input
                          type="text"
                          className="coupon-input"
                          placeholder={t('cart.couponPlaceholder')}
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                          disabled={isLoading}
                        />
                        <button
                          className="btn btn-sm coupon-apply-btn"
                          onClick={handleApplyCoupon}
                          disabled={isLoading || !couponInput.trim()}
                        >
                          {t('cart.couponApply')}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="cart-totals">
                    <div className="total-row">
                      <span>{t('cart.subtotal')}</span>
                      <span>${totals.subtotal.toFixed(2)}</span>
                    </div>
                    {(totals.discount ?? 0) > 0 && (
                      <div className="total-row total-row-discount">
                        <span>{t('cart.discount')}</span>
                        <span>-${(totals.discount ?? 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="total-row">
                      <span>{t('cart.tax')}</span>
                      <span>${totals.tax.toFixed(2)}</span>
                    </div>
                    <div className="total-row">
                      <span>{t('cart.shipping')}</span>
                      <span>{totals.shipping === 0 ? t('cart.shippingFree') : `$${totals.shipping.toFixed(2)}`}</span>
                    </div>
                    <div className="total-row total-row-final">
                      <span>{t('cart.total')}</span>
                      <span>${totals.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <Link
                    to="/checkout"
                    className="btn btn-primary checkout-btn"
                    onClick={closeDrawer}
                  >
                    {t('cart.checkout')}
                  </Link>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
