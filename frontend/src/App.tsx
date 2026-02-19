import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { HomePage } from './pages/HomePage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { LoginPage } from './pages/LoginPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { SearchResults } from './components/SearchResults';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <div className="app">
          <Header />
          <main className="app-main">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/order-confirmation/:id" element={<OrderConfirmationPage />} />
              <Route path="/search" element={<SearchResults />} />
            </Routes>
          </main>
          <Footer />
          <CartDrawer />
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
            },
          }}
        />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
