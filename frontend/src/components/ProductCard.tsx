import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiShoppingCart, FiStar } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import './ProductCard.css';

const PLACEHOLDER_IMG = '/images/products/placeholder.svg';

interface ProductCardProps {
  product: Product;
  showRating?: boolean;
}

export function ProductCard({ product, showRating = true }: ProductCardProps) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const { addItem } = useCart();

  const imgSrc = imgError || !product.imageUrl
    ? PLACEHOLDER_IMG
    : product.imageUrl.startsWith('http') || product.imageUrl.startsWith('/')
    ? product.imageUrl
    : `/images/products/${product.slug || product.id}.svg`;

  const rating = 4 + (product.id % 2) * 0.5;
  const stars = Math.floor(rating);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem(product);
    window.DD_RUM?.addAction?.('product_card_view', {
      productId: product.id,
      productName: product.name,
      action: 'add_to_cart',
    });
  };

  const handleView = () => {
    window.DD_RUM?.addAction?.('product_card_view', {
      productId: product.id,
      productName: product.name,
    });
  };

  return (
    <motion.div
      className="product-card card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
    >
      <Link to={`/products/${product.id}`} onClick={handleView}>
        <div className="product-card-image">
          <img
            src={imgSrc}
            alt={product.name}
            onError={() => setImgError(true)}
          />
          <span className="category-badge">{t(`categories.${product.category}`, product.category)}</span>
        </div>
        <div className="product-card-content">
          <h3 className="product-name">{product.name}</h3>
          {showRating && (
            <div className="product-rating">
              {Array.from({ length: 5 }).map((_, i) => (
                <FiStar
                  key={i}
                  className={i < stars ? 'star filled' : 'star'}
                  size={14}
                />
              ))}
              <span className="rating-text">{rating}</span>
            </div>
          )}
          <p className="product-price">${product.price.toFixed(2)}</p>
          <motion.button
            className="btn btn-primary add-to-cart-btn"
            onClick={handleAddToCart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FiShoppingCart size={16} />
            {t('products.addToCart')}
          </motion.button>
        </div>
      </Link>
    </motion.div>
  );
}
