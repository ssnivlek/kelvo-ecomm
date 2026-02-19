import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { fetchProducts } from '../services/api';
import { Product } from '../types';
import './ProductsPage.css';

const CATEGORIES = ['All', 'Electronics', 'Clothing', 'Home & Kitchen', 'Sports'];
const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name A-Z' },
];

function ProductSkeleton() {
  return (
    <div className="product-skeleton card">
      <div className="skeleton-image" />
      <div className="skeleton-content">
        <div className="skeleton-line" style={{ width: '80%' }} />
        <div className="skeleton-line" style={{ width: '60%' }} />
        <div className="skeleton-line" style={{ width: '40%' }} />
      </div>
    </div>
  );
}

export function ProductsPage() {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | undefined>(
    categoryParam || undefined
  );
  const [sort, setSort] = useState<string>('default');

  useEffect(() => {
    if (categoryParam) setCategory(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    setLoading(true);
    const cat = category === 'All' ? undefined : category;
    fetchProducts(cat)
      .then((data) => {
        let sorted = [...data];
        if (sort === 'price_asc') sorted.sort((a, b) => a.price - b.price);
        if (sort === 'price_desc') sorted.sort((a, b) => b.price - a.price);
        if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(sorted);
      })
      .finally(() => setLoading(false));
  }, [category, sort]);

  return (
    <main className="products-page section">
      <div className="container">
        <h1 className="page-title">Products</h1>

        <div className="products-controls">
          <div className="category-buttons">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`cat-btn ${category === cat || (!category && cat === 'All') ? 'active' : ''}`}
                onClick={() => setCategory(cat === 'All' ? undefined : cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="sort-control">
            <label htmlFor="sort">Sort by</label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
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
          <div className="grid-products">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid-products">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {!loading && products.length === 0 && (
          <div className="products-empty">
            <p>No products found in this category.</p>
          </div>
        )}
      </div>
    </main>
  );
}
