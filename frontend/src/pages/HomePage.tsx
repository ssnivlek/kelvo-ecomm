import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTruck, FiCreditCard, FiHeadphones, FiRotateCcw } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { datadogRum } from '@datadog/browser-rum';
import { ProductCard } from '../components/ProductCard';
import { fetchProducts, getRecommendations } from '../services/api';
import { Product } from '../types';
import './HomePage.css';

const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics', icon: '📱' },
  { name: 'Clothing', slug: 'clothing', icon: '👕' },
  { name: 'Home & Kitchen', slug: 'home-kitchen', icon: '🏠' },
  { name: 'Sports', slug: 'sports', icon: '⚽' },
];

const FEATURES = [
  { icon: FiTruck, title: 'Fast Shipping', desc: 'Free delivery on orders over $50' },
  { icon: FiCreditCard, title: 'Secure Payment', desc: '100% secure checkout' },
  { icon: FiHeadphones, title: '24/7 Support', desc: 'Dedicated customer service' },
  { icon: FiRotateCcw, title: 'Easy Returns', desc: '30-day hassle-free returns' },
];

export function HomePage() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    datadogRum.addAction('page_view', { page: 'home' });
  }, []);

  useEffect(() => {
    getRecommendations(undefined, 4)
      .then(setFeaturedProducts)
      .catch(() => fetchProducts().then((p) => setFeaturedProducts(p.slice(0, 4))))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="home-page">
      <section className="hero">
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1>Premium Products, Exceptional Experience</h1>
          <p className="hero-tagline">
            Discover curated quality at Kelvo E-Comm. From electronics to lifestyle — we've got you covered.
          </p>
          <Link to="/products" className="btn btn-primary hero-cta">
            Shop Now
          </Link>
        </motion.div>
      </section>

      <section className="section featured-section">
        <div className="container">
          <h2 className="section-title">Featured Products</h2>
          {loading ? (
            <div className="products-loading">
              <div className="spinner" />
              <p>Loading products...</p>
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
              View All Products
            </Link>
          </div>
        </div>
      </section>

      <section className="section categories-section">
        <div className="container">
          <h2 className="section-title">Shop by Category</h2>
          <div className="categories-grid">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                to={`/products?category=${encodeURIComponent(cat.name)}`}
                className="category-card card"
              >
                <span className="category-icon">{cat.icon}</span>
                <h3>{cat.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section features-section">
        <div className="container">
          <h2 className="section-title">Why Choose Us</h2>
          <div className="features-grid">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="feature-card">
                <div className="feature-icon">
                  <Icon size={28} />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section newsletter-section">
        <div className="container">
          <div className="newsletter-card">
            <h2>Stay Updated</h2>
            <p>Subscribe for exclusive offers and new arrivals.</p>
            <form
              className="newsletter-form"
              onSubmit={(e) => {
                e.preventDefault();
                datadogRum.addAction('newsletter_signup');
              }}
            >
              <input
                type="email"
                placeholder="Enter your email"
                required
                className="newsletter-input"
              />
              <button type="submit" className="btn btn-primary">
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
