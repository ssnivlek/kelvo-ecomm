import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingBag, FiSearch, FiShoppingCart, FiUser, FiMenu, FiX, FiSun, FiMoon } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { changeLanguageSafe } from '../i18n';
import toast from 'react-hot-toast';
import './Header.css';

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'pt', flag: '🇧🇷', label: 'Português' },
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
];

export function Header() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const { itemCount, openDrawer } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const categories = ['Electronics', 'Clothing', 'Home & Kitchen', 'Sports', 'Books', 'Beauty', 'Toys & Games'];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  const handleLanguageChange = async (code: string) => {
    try {
      await changeLanguageSafe(code);
    } catch {
      toast.error(t('errors.translationLoadFailed'));
    }
    setLangMenuOpen(false);
  };

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  return (
    <header className="header header-sticky">
      <div className="header-inner container">
        <Link to="/" className="header-logo" onClick={() => setMobileMenuOpen(false)}>
          <FiShoppingBag className="logo-icon" />
          <span>Kelvo E-Comm</span>
        </Link>

        <nav className="header-nav desktop-only">
          <Link to="/" className="nav-link">{t('nav.home')}</Link>
          <Link to="/products" className="nav-link">{t('nav.products')}</Link>
          <div
            className="nav-dropdown-trigger"
            onMouseEnter={() => setCategoriesOpen(true)}
            onMouseLeave={() => setCategoriesOpen(false)}
          >
            <span className="nav-link">{t('nav.categories')}</span>
            <div className={`dropdown categories-dropdown ${categoriesOpen ? 'open' : ''}`}>
              {categories.map((cat) => (
                <Link
                  key={cat}
                  to={`/products?category=${encodeURIComponent(cat)}`}
                  className="dropdown-item"
                >
                  {t(`categories.${cat}`, cat)}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <form className="header-search desktop-only" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder={t('nav.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            aria-label={t('nav.search')}
          />
          <button type="submit" className="search-btn" aria-label={t('nav.search')}>
            <FiSearch size={20} />
          </button>
        </form>

        <div className="header-actions">
          <div
            className="lang-menu-wrapper"
            onMouseEnter={() => setLangMenuOpen(true)}
            onMouseLeave={() => setLangMenuOpen(false)}
          >
            <button className="icon-btn lang-btn" aria-label="Language">
              <span className="lang-flag">{currentLang.flag}</span>
            </button>
            <div className={`dropdown lang-dropdown ${langMenuOpen ? 'open' : ''}`}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  className={`dropdown-item lang-item ${i18n.language === lang.code ? 'active' : ''}`}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  <span className="lang-flag">{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            className="icon-btn theme-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('theme.light') : t('theme.dark')}
            title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
          >
            {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
          </button>

          <button
            className="icon-btn cart-btn"
            onClick={openDrawer}
            aria-label="Open cart"
          >
            <FiShoppingCart size={22} />
            {itemCount > 0 && (
              <span className="cart-badge">{itemCount > 99 ? '99+' : itemCount}</span>
            )}
          </button>

          <div
            className="user-menu-wrapper"
            onMouseEnter={() => setUserMenuOpen(true)}
            onMouseLeave={() => setUserMenuOpen(false)}
          >
            <button className="icon-btn user-btn" aria-label="User menu">
              <FiUser size={22} />
            </button>
            <div className={`dropdown user-dropdown ${userMenuOpen ? 'open' : ''}`}>
              {isAuthenticated && user ? (
                <>
                  <div className="dropdown-header">
                    <strong>{user.name}</strong>
                    <span className="dropdown-email">{user.email}</span>
                  </div>
                  <button
                    className="dropdown-item"
                    onClick={() => {
                      logout();
                      setUserMenuOpen(false);
                    }}
                  >
                    {t('nav.logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                    {t('nav.login')}
                  </Link>
                  <Link to="/login?tab=register" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                    {t('nav.register')}
                  </Link>
                </>
              )}
            </div>
          </div>

          <button
            className="icon-btn mobile-menu-btn mobile-only"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-menu">
          <Link to="/" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>{t('nav.home')}</Link>
          <Link to="/products" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>{t('nav.products')}</Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              to={`/products?category=${encodeURIComponent(cat)}`}
              className="mobile-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t(`categories.${cat}`, cat)}
            </Link>
          ))}
          <form onSubmit={handleSearch} className="mobile-search">
            <input
              type="search"
              placeholder={t('nav.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="btn btn-primary">{t('nav.search')}</button>
          </form>
        </div>
      )}
    </header>
  );
}
