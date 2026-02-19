import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getOrder } from '../services/api';
import { Order } from '../types';
import './OrderConfirmationPage.css';

export function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      setLoading(false);
      return;
    }
    getOrder(numId)
      .then(setOrder)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="order-confirmation-page section">
        <div className="container">
          <div className="confirmation-loading">
            <div className="spinner" />
            <p>Loading order...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="order-confirmation-page section">
      <div className="container">
        <motion.div
          className="confirmation-card card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="success-checkmark"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            ✓
          </motion.div>
          <h1>Thank You for Your Order!</h1>
          <p className="confirmation-message">
            Your order has been placed successfully.
          </p>
          {order && (
            <div className="order-summary">
              <p className="order-number">Order #{order.id}</p>
              <p className="order-total">
                Total: ${order.totalAmount?.toFixed(2) ?? '0.00'}
              </p>
            </div>
          )}
          {id && !order && (
            <p className="order-number">Order #{id}</p>
          )}
          <Link to="/products" className="btn btn-primary">
            Continue Shopping
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
