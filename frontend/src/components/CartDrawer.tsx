import React from 'react';
import { Link } from 'react-router-dom';
import { FiX, FiMinus, FiPlus, FiShoppingBag } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import './CartDrawer.css';

const PLACEHOLDER_IMG = '/images/products/placeholder.svg';

export function CartDrawer() {
  const {
    items,
    totals,
    isDrawerOpen,
    closeDrawer,
    updateQuantity,
    removeItem,
    itemCount,
  } = useCart();

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
              <h2>Your Cart</h2>
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
                  <p>Your cart is empty</p>
                  <Link to="/products" className="btn btn-primary" onClick={closeDrawer}>
                    Browse Products
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
                          <span className="cart-item-price">{item.price.toFixed(2)}</span>
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
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="cart-totals">
                    <div className="total-row">
                      <span>Subtotal</span>
                      <span>${totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="total-row">
                      <span>Tax</span>
                      <span>${totals.tax.toFixed(2)}</span>
                    </div>
                    <div className="total-row">
                      <span>Shipping</span>
                      <span>${totals.shipping.toFixed(2)}</span>
                    </div>
                    <div className="total-row total-row-final">
                      <span>Total</span>
                      <span>${totals.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <Link
                    to="/checkout"
                    className="btn btn-primary checkout-btn"
                    onClick={closeDrawer}
                  >
                    Proceed to Checkout
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
