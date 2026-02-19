import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiShoppingBag, FiSearch, FiShoppingCart, FiUser, FiMenu, FiX } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './Header.css';

export function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { itemCount, openDrawer } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const categories = ['Electronics', 'Clothing', 'Home & Kitchen', 'Sports'];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  return (
    <header className="header header-sticky">
      <div className="header-inner container">
        <Link to="/" className="header-logo" onClick={() => setMobileMenuOpen(false)}>
          <FiShoppingBag className="logo-icon" />
          <span>RUM Shop</span>
        </Link>

        <nav className="header-nav desktop-only">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/products" className="nav-link">Products</Link>
          <div
            className="nav-dropdown-trigger"
            onMouseEnter={() => setCategoriesOpen(true)}
            onMouseLeave={() => setCategoriesOpen(false)}
          >
            <span className="nav-link">Categories</span>
            <div className={`dropdown categories-dropdown ${categoriesOpen ? 'open' : ''}`}>
              {categories.map((cat) => (
                <Link
                  key={cat}
                  to={`/products?category=${encodeURIComponent(cat)}`}
                  className="dropdown-item"
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <form className="header-search desktop-only" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            aria-label="Search"
          />
          <button type="submit" className="search-btn" aria-label="Search">
            <FiSearch size={20} />
          </button>
        </form>

        <div className="header-actions">
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
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                    Login
                  </Link>
                  <Link to="/login?tab=register" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                    Register
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
          <Link to="/" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Home</Link>
          <Link to="/products" className="mobile-link" onClick={() => setMobileMenuOpen(false)}>Products</Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              to={`/products?category=${encodeURIComponent(cat)}`}
              className="mobile-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              {cat}
            </Link>
          ))}
          <form onSubmit={handleSearch} className="mobile-search">
            <input
              type="search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        </div>
      )}
    </header>
  );
}
