import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiShoppingCart, FiStar } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ProductCard } from '../components/ProductCard';
import { fetchProduct, getRecommendations } from '../services/api';
import { useCart } from '../context/CartContext';
import { Product } from '../types';
import './ProductDetailPage.css';

const PLACEHOLDER_IMG = '/images/products/placeholder.svg';

export function ProductDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    if (!id) return;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetchProduct(numId),
      getRecommendations(numId, 4),
    ])
      .then(([p, recs]) => {
        setProduct(p || null);
        setRecommendations(recs || []);
        if (p) {
          window.DD_RUM?.addAction('product_view', {
            productId: p.id,
            productName: p.name,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    addItem(product, quantity);
  };

  if (loading) {
    return (
      <main className="product-detail-page section">
        <div className="container">
          <div className="product-detail-loading">
            <div className="spinner" />
            <p>{t('order.loadingProduct')}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-detail-page section">
        <div className="container">
          <div className="product-not-found">
            <h2>{t('order.productNotFound')}</h2>
            <Link to="/products" className="btn btn-primary">{t('order.backToProducts')}</Link>
          </div>
        </div>
      </main>
    );
  }

  const imgSrc = imgError || !product.imageUrl
    ? PLACEHOLDER_IMG
    : product.imageUrl.startsWith('http') || product.imageUrl.startsWith('/')
    ? product.imageUrl
    : `/images/products/${product.slug || product.id}.svg`;

  const rating = 4 + (product.id % 2) * 0.5;
  const stars = Math.floor(rating);

  return (
    <main className="product-detail-page section">
      <div className="container">
        <div className="product-detail-layout">
          <motion.div
            className="product-detail-image"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <img
              src={imgSrc}
              alt={product.name}
              onError={() => setImgError(true)}
            />
          </motion.div>

          <motion.div
            className="product-detail-info"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <span className="product-category">{t(`categories.${product.category}`, product.category)}</span>
            <h1>{product.name}</h1>
            <div className="product-rating">
              {Array.from({ length: 5 }).map((_, i) => (
                <FiStar
                  key={i}
                  className={i < stars ? 'star filled' : 'star'}
                  size={18}
                />
              ))}
              <span className="rating-text">{rating} (12 {t('products.reviews')})</span>
            </div>
            <p className="product-price">${product.price.toFixed(2)}</p>
            <p className="product-description">{product.description}</p>
            {product.sku && (
              <p className="product-sku">{t('products.sku')}: {product.sku}</p>
            )}
            <p className="product-stock">
              {product.stockQuantity > 0
                ? `${t('products.inStock')} (${product.stockQuantity})`
                : t('products.outOfStock')}
            </p>

            <div className="product-actions">
              <div className="quantity-selector">
                <label>{t('products.quantity')}</label>
                <div className="qty-controls">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    −
                  </button>
                  <span>{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stockQuantity, q + 1))}
                    disabled={quantity >= product.stockQuantity}
                  >
                    +
                  </button>
                </div>
              </div>
              <motion.button
                className="btn btn-primary add-cart-btn"
                onClick={handleAddToCart}
                disabled={product.stockQuantity <= 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FiShoppingCart size={20} />
                {t('products.addToCart')}
              </motion.button>
            </div>
          </motion.div>
        </div>

        {recommendations.length > 0 && (
          <section className="recommendations-section">
            <h2>{t('products.relatedProducts')}</h2>
            <div className="grid-products">
              {recommendations.map((rec) => (
                <ProductCard key={rec.id} product={rec} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
