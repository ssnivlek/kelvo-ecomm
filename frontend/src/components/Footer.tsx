import React from 'react';
import { Link } from 'react-router-dom';
import { FiShoppingBag, FiTwitter, FiInstagram, FiLinkedin } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import './Footer.css';

const categories = ['Electronics', 'Clothing', 'Home & Kitchen', 'Sports', 'Books', 'Beauty', 'Toys & Games'];

export function Footer() {
  const { t } = useTranslation();

  const quickLinks = [
    { to: '/products', label: t('footer.allProducts') },
    { to: '/checkout', label: t('checkout.title') },
    { to: '/login', label: t('nav.login') },
  ];

  return (
    <footer className="footer">
      <div className="footer-inner container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <FiShoppingBag size={24} />
              <span>Kelvo E-Comm</span>
            </Link>
            <p className="footer-tagline">
              {t('footer.tagline')}
            </p>
            <div className="footer-datadog">
              <span className="datadog-badge">Monitored by Datadog</span>
            </div>
          </div>

          <div className="footer-column">
            <h4>{t('footer.quickLinks')}</h4>
            <ul>
              {quickLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-column">
            <h4>{t('footer.categories')}</h4>
            <ul>
              {categories.map((cat) => (
                <li key={cat}>
                  <Link to={`/products?category=${encodeURIComponent(cat)}`}>
                    {t(`categories.${cat}`, cat)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-column">
            <h4>{t('footer.connect')}</h4>
            <div className="footer-social">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <FiTwitter size={20} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <FiInstagram size={20} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <FiLinkedin size={20} />
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Kelvo E-Comm. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
