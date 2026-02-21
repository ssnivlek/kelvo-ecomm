import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './LoginPage.css';

export function LoginPage() {
  const { t } = useTranslation();
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
      toast.success(t('auth.welcomeBack'));
      window.DD_RUM?.addAction('auth_login_success');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error(t('auth.passwordMismatch'));
      return;
    }
    if (registerForm.password.length < 6) {
      toast.error(t('auth.passwordMinLength'));
      return;
    }
    setLoading(true);
    try {
      await register(registerForm.email, registerForm.name, registerForm.password);
      toast.success(t('auth.accountCreated'));
      window.DD_RUM?.addAction('auth_register_success');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.registerFailed'));
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
              {t('auth.loginTitle')}
            </button>
            <button
              className={`tab-btn ${tab === 'register' ? 'active' : ''}`}
              onClick={() => setTab('register')}
            >
              {t('auth.registerTitle')}
            </button>
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label htmlFor="login-email">{t('auth.email')}</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="login-password">{t('auth.password')}</label>
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
                {t('auth.demoHint')}
              </p>
              <button
                type="submit"
                className="btn btn-primary full-width"
                disabled={loading}
              >
                {loading ? t('auth.signingIn') : t('auth.signIn')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="login-form">
              <div className="form-group">
                <label htmlFor="reg-name">{t('auth.name')}</label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={registerForm.name}
                  onChange={(e) =>
                    setRegisterForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder={t('auth.namePlaceholder')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-email">{t('auth.email')}</label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-password">{t('auth.password')}</label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-confirm">{t('auth.confirmPassword')}</label>
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
                {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
