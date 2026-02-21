import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTruck, FiCreditCard, FiHeadphones, FiRotateCcw } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ProductCard } from '../components/ProductCard';
import { fetchProducts, getRecommendations } from '../services/api';
import { Product } from '../types';
import './HomePage.css';

const CATEGORIES = [
  { name: 'Electronics', icon: '📱' },
  { name: 'Clothing', icon: '👕' },
  { name: 'Home & Kitchen', icon: '🏠' },
  { name: 'Sports', icon: '⚽' },
  { name: 'Books', icon: '📚' },
  { name: 'Beauty', icon: '💄' },
  { name: 'Toys & Games', icon: '🎮' },
];

export function HomePage() {
  const { t } = useTranslation();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.DD_RUM?.addAction('page_view', { page: 'home' });
  }, []);

  useEffect(() => {
    getRecommendations(undefined, 4)
      .then(setFeaturedProducts)
      .catch(() => fetchProducts().then((p) => setFeaturedProducts(p.slice(0, 4))))
      .finally(() => setLoading(false));
  }, []);

  const FEATURES = [
    { icon: FiTruck, titleKey: 'home.fastShipping', descKey: 'home.fastShippingDesc' },
    { icon: FiCreditCard, titleKey: 'home.securePayment', descKey: 'home.securePaymentDesc' },
    { icon: FiHeadphones, titleKey: 'home.support', descKey: 'home.supportDesc' },
    { icon: FiRotateCcw, titleKey: 'home.easyReturns', descKey: 'home.easyReturnsDesc' },
  ];

  return (
    <main className="home-page">
      <section className="hero">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1>{t('hero.title')}</h1>
          <p className="hero-tagline">{t('hero.subtitle')}</p>
          <Link to="/products" className="btn btn-primary hero-cta">
            {t('hero.cta')}
          </Link>
        </motion.div>
      </section>

      <section className="section featured-section">
        <div className="container">
          <h2 className="section-title">{t('hero.featuredTitle')}</h2>
          {loading ? (
            <div className="products-loading">
              <div className="spinner" />
              <p>{t('home.loading')}</p>
            </div>
          ) : (
            <div className="grid-products">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          <div className="section-cta">
            <Link to="/products" className="btn btn-outline">
              {t('home.viewAll')}
            </Link>
          </div>
        </div>
      </section>

      <section className="section categories-section">
        <div className="container">
          <h2 className="section-title">{t('home.shopByCategory')}</h2>
          <div className="categories-grid">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                to={`/products?category=${encodeURIComponent(cat.name)}`}
                className="category-card card"
              >
                <span className="category-icon">{cat.icon}</span>
                <h3>{t(`categories.${cat.name}`, cat.name)}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section features-section">
        <div className="container">
          <h2 className="section-title">{t('home.whyChooseUs')}</h2>
          <div className="features-grid">
            {FEATURES.map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="feature-card">
                <div className="feature-icon">
                  <Icon size={28} />
                </div>
                <h3>{t(titleKey)}</h3>
                <p>{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section newsletter-section">
        <div className="container">
          <div className="newsletter-card">
            <h2>{t('home.stayUpdated')}</h2>
            <p>{t('home.stayUpdatedDesc')}</p>
            <form
              className="newsletter-form"
              onSubmit={(e) => {
                e.preventDefault();
                window.DD_RUM?.addAction('newsletter_signup');
              }}
            >
              <input
                type="email"
                placeholder={t('home.emailPlaceholder')}
                required
                className="newsletter-input"
              />
              <button type="submit" className="btn btn-primary">
                {t('home.subscribe')}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
