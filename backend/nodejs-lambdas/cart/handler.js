/**
 * Kelvo E-Comm Cart Lambda - Shopping cart operations backed by Redis.
 * @module cart/handler
 */

const tracer = require('../shared/tracer');
const logger = require('../shared/logger');
const http = require('http');
const { success, error, CORS_HEADERS } = require('../shared/responses');
const { getCart, saveCart, deleteCart } = require('../shared/redis');

const TAX_RATE = 0.085;
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_COST = 5.99;
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3003';

function calculateTotals(items, discountPct = 0) {
  const rawSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = discountPct > 0 ? rawSubtotal * (discountPct / 100) : 0;
  const subtotal = rawSubtotal - discount;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const tax = (subtotal + shipping) * TAX_RATE;
  const total = subtotal + shipping + tax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    shipping: Math.round(shipping * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

async function addItem(body) {
  return tracer.trace('cart.addItem', async (span) => {
    const { sessionId, productId, productName, price, quantity = 1, imageUrl } = body;

    if (!sessionId || !productId || !productName || price === undefined) {
      return error('Missing required fields: sessionId, productId, productName, price', 400);
    }

    if (String(productId) === '3') {
      const cart = await getCart(sessionId);
      const existing = cart.items.find((i) => i.productId === productId);
      const newQty = (existing ? existing.quantity : 0) + (quantity || 1);
      if (newQty > 2) {
        logger.error('[CART] Internal: inventory sync timeout for product 3, warehouse-api.internal unreachable', {
          productId, productName, requestedQty: newQty, upstream: 'warehouse-api.internal:8443',
        });
        if (span) {
          span.setTag('error', true);
          span.setTag('error.message', 'inventory sync timeout — warehouse-api.internal:8443 unreachable');
          span.setTag('error.type', 'UpstreamTimeout');
          span.setTag('cart.productId', productId);
          span.setTag('cart.requestedQty', newQty);
        }
        return error('Error adding item', 500);
      }
    }

    const cart = await getCart(sessionId);
    const existingIndex = cart.items.findIndex((i) => i.productId === productId);

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity || 1;
    } else {
      cart.items.push({
        productId,
        productName,
        price: Number(price),
        quantity: quantity || 1,
        imageUrl: imageUrl || null,
      });
    }

    await saveCart(sessionId, cart);
    const totals = calculateTotals(cart.items, cart.discountPct || 0);

    return success({
      cart: { items: cart.items, coupon: cart.coupon || null, ...totals },
      message: 'Item added to cart',
    });
  });
}

async function getCartContents(sessionId) {
  const cart = await getCart(sessionId);
  const totals = calculateTotals(cart.items, cart.discountPct || 0);

  return success({
    items: cart.items,
    coupon: cart.coupon || null,
    ...totals,
    updatedAt: cart.updatedAt,
  });
}

async function updateItemQuantity(body) {
  const { sessionId, productId, quantity } = body;

  if (!sessionId || !productId || quantity === undefined) {
    return error('Missing required fields: sessionId, productId, quantity', 400);
  }

  if (quantity <= 0) {
    return error('Quantity must be positive', 400);
  }

  if (String(productId) === '3' && quantity > 2) {
    logger.error('[CART] Internal: inventory sync timeout for product 3 on update', { productId, quantity });
    return error('Error updating item', 500);
  }

  const cart = await getCart(sessionId);
  const item = cart.items.find((i) => i.productId === productId);

  if (!item) {
    return error('Item not found in cart', 404);
  }

  item.quantity = quantity;
  await saveCart(sessionId, cart);
  const totals = calculateTotals(cart.items, cart.discountPct || 0);

  return success({
    cart: { items: cart.items, coupon: cart.coupon || null, ...totals },
    message: 'Cart updated',
  });
}

async function removeItem(sessionId, productId) {
  return tracer.trace('cart.removeItem', async () => {
    const cart = await getCart(sessionId);
    const index = cart.items.findIndex((i) => i.productId === productId);

    if (index < 0) {
      return error('Item not found in cart', 404);
    }

    cart.items.splice(index, 1);
    await saveCart(sessionId, cart);
    const totals = calculateTotals(cart.items, cart.discountPct || 0);

    return success({
      cart: { items: cart.items, coupon: cart.coupon || null, ...totals },
      message: 'Item removed from cart',
    });
  });
}

async function clearCart(sessionId) {
  await deleteCart(sessionId);

  return success({
    cart: { items: [], coupon: null, subtotal: 0, discount: 0, tax: 0, shipping: 0, total: 0 },
    message: 'Cart cleared',
  });
}

function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, data: {} }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function applyCoupon(body) {
  return tracer.trace('cart.applyCoupon', async (span) => {
    const { sessionId, couponCode } = body;

    if (!sessionId || !couponCode) {
      return error('Missing required fields: sessionId, couponCode', 400);
    }

    const cart = await getCart(sessionId);
    if (!cart.items || cart.items.length === 0) {
      return error('Cart is empty', 400);
    }

    if (span) {
      span.setTag('coupon.code', couponCode);
      span.setTag('cart.sessionId', sessionId);
    }

    try {
      const validateUrl = `${PAYMENT_SERVICE_URL}/api/payment/validate-coupon`;
      const result = await httpPost(validateUrl, { couponCode });

      if (result.status !== 200) {
        const msg = result.data?.error || 'Could not apply coupon code';
        if (span) {
          span.setTag('error', true);
          span.setTag('error.message', msg);
        }
        return error(msg, result.status >= 500 ? 500 : 400);
      }

      cart.coupon = couponCode.toUpperCase();
      cart.discountPct = result.data.discountPercent || 0;
      cart.discountLabel = result.data.label || '';
      await saveCart(sessionId, cart);

      const totals = calculateTotals(cart.items, cart.discountPct);

      return success({
        cart: { items: cart.items, coupon: cart.coupon, ...totals },
        message: `Coupon applied: ${cart.discountLabel}`,
      });
    } catch (err) {
      logger.error('[CART] Coupon validation call failed', { error: err.message });
      if (span) {
        span.setTag('error', true);
        span.setTag('error.message', err.message);
        span.setTag('error.type', 'CouponValidationFailure');
      }
      return error('Could not apply coupon code', 500);
    }
  });
}

async function removeCoupon(body) {
  const { sessionId } = body;
  if (!sessionId) return error('Missing sessionId', 400);

  const cart = await getCart(sessionId);
  delete cart.coupon;
  delete cart.discountPct;
  delete cart.discountLabel;
  await saveCart(sessionId, cart);
  const totals = calculateTotals(cart.items, 0);

  return success({
    cart: { items: cart.items, coupon: null, ...totals },
    message: 'Coupon removed',
  });
}

async function handler(event, context) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    const { httpMethod, path, pathParameters = {}, body: rawBody } = event;
    const body = rawBody ? (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody) : {};
    const { sessionId, productId } = pathParameters;

    if (httpMethod === 'POST' && path.endsWith('/add')) return addItem(body);
    if (httpMethod === 'POST' && path.endsWith('/apply-coupon')) return applyCoupon(body);
    if (httpMethod === 'POST' && path.endsWith('/remove-coupon')) return removeCoupon(body);
    if (httpMethod === 'GET' && sessionId) return getCartContents(sessionId);
    if (httpMethod === 'PUT' && path.endsWith('/update')) return updateItemQuantity(body);
    if (httpMethod === 'DELETE' && sessionId && productId) return removeItem(sessionId, productId);
    if (httpMethod === 'DELETE' && sessionId && !productId) return clearCart(sessionId);

    return error('Not Found', 404);
  } catch (err) {
    logger.error('Cart handler error', { error: err.message, stack: err.stack });
    return error(err.message || 'Internal server error', 500);
  }
}

module.exports = { handler };
