import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProductCard } from './ProductCard';
import { searchProducts, SearchFilters } from '../services/api';
import { Product } from '../types';
import './SearchResults.css';

const CATEGORIES = ['Electronics', 'Clothing', 'Home & Kitchen', 'Sports', 'Books', 'Beauty', 'Toys & Games'];

export function SearchResults() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SearchFilters>({
    category: searchParams.get('category') || undefined,
    sort: 'name',
  });

  useEffect(() => {
    setLoading(true);
    searchProducts(query, filters)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [query, filters]);

  const handleCategoryChange = (category: string | undefined) => {
    setFilters((f) => ({ ...f, category }));
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((f) => ({
      ...f,
      sort: e.target.value as SearchFilters['sort'],
    }));
  };

  const SORT_OPTIONS = [
    { value: 'name', label: t('search.nameAZ') },
    { value: 'price_asc', label: t('search.priceLowHigh') },
    { value: 'price_desc', label: t('search.priceHighLow') },
  ];

  return (
    <div className="search-results-page section">
      <div className="container">
        <div className="search-results-layout">
          <aside className="search-filters">
            <h3>{t('search.filters')}</h3>
            <div className="filter-group">
              <label>{t('search.category')}</label>
              <div className="filter-options">
                <button
                  className={`filter-btn ${!filters.category ? 'active' : ''}`}
                  onClick={() => handleCategoryChange(undefined)}
                >
                  {t('products.allCategories')}
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={`filter-btn ${filters.category === cat ? 'active' : ''}`}
                    onClick={() => handleCategoryChange(cat)}
                  >
                    {t(`categories.${cat}`, cat)}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <label>{t('search.priceRange')}</label>
              <div className="price-inputs">
                <input
                  type="number"
                  placeholder={t('search.min')}
                  min={0}
                  step={0.01}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      minPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                />
                <span>-</span>
                <input
                  type="number"
                  placeholder={t('search.max')}
                  min={0}
                  step={0.01}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      maxPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
            </div>
          </aside>

          <main className="search-results-main">
            <div className="search-results-header">
              <p className="result-count">
                {loading ? t('search.searching') : t('search.productsFound', { count: products.length })}
                {query && ` for "${query}"`}
              </p>
              <div className="sort-control">
                <label htmlFor="sort">{t('search.sortBy')}</label>
                <select
                  id="sort"
                  value={filters.sort}
                  onChange={handleSortChange}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="search-loading">
                <div className="spinner" />
                <p>{t('search.searching')}</p>
              </div>
            ) : (
              <div className="grid-products">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {!loading && products.length === 0 && (
              <div className="search-empty">
                <p>{t('search.noResults')}</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
