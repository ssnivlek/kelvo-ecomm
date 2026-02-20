import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './LoginPage.css';

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      toast.success('Welcome back!');
      window.DD_RUM?.addAction('auth_login_success');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (registerForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(registerForm.email, registerForm.name, registerForm.password);
      toast.success('Account created!');
      window.DD_RUM?.addAction('auth_register_success');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page section">
      <div className="container">
        <div className="login-card card">
          <div className="login-tabs">
            <button
              className={`tab-btn ${tab === 'login' ? 'active' : ''}`}
              onClick={() => setTab('login')}
            >
              Login
            </button>
            <button
              className={`tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => setTab('register')}
            >
              Register
            </button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="you@example.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="••••••••"
                />
              </div>
              <p className="demo-hint">
                Demo: try demo@rumshop.com / password123
              </p>
              <button
                type="submit"
                className="btn btn-primary full-width"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="login-form">
              <div className="form-group">
                <label htmlFor="reg-name">Name</label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={registerForm.name}
                  onChange={(e) =>
                    setRegisterForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Your name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-email">Email</label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="you@example.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-password">Password</label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-confirm">Confirm Password</label>
                <input
                  id="reg-confirm"
                  type="password"
                  required
                  value={registerForm.confirmPassword}
                  onChange={(e) =>
                    setRegisterForm((f) => ({
                      ...f,
                      confirmPassword: e.target.value,
                    }))
                  }
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary full-width"
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
