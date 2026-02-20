/**
 * Kelvo E-Comm Cart Lambda - Shopping cart operations backed by Redis.
 * @module cart/handler
 */

const tracer = require('../shared/tracer');
const { success, error, CORS_HEADERS } = require('../shared/responses');
const { getCart, saveCart, deleteCart } = require('../shared/redis');

const TAX_RATE = 0.085;
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_COST = 5.99;

function calculateTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const tax = (subtotal + shipping) * TAX_RATE;
  const total = subtotal + shipping + tax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
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

    // BUG: Smart Watch Pro (product 3) fails when adding more than 2 units.
    // This is intentional — used to demo Datadog RUM→APM error trace correlation.
    if (String(productId) === '3') {
      const cart = await getCart(sessionId);
      const existing = cart.items.find((i) => i.productId === productId);
      const newQty = (existing ? existing.quantity : 0) + (quantity || 1);
      if (newQty > 2) {
        const err = new Error(
          `Inventory validation failed: product ${productId} ("${productName}") ` +
          `cannot exceed 2 units per order — requested ${newQty}. ` +
          `Contact warehouse-api.internal for stock allocation.`
        );
        err.code = 'INVENTORY_LIMIT_EXCEEDED';
        console.error('[CART] Inventory check error:', err.message, { productId, productName, requestedQty: newQty });
        if (span) {
          span.setTag('error', true);
          span.setTag('error.message', err.message);
          span.setTag('error.type', 'InventoryLimitExceeded');
          span.setTag('cart.productId', productId);
          span.setTag('cart.requestedQty', newQty);
        }
        return error(err.message, 500);
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
    const totals = calculateTotals(cart.items);

    return success({
      cart: { items: cart.items, ...totals },
      message: 'Item added to cart',
    });
  });
}

async function getCartContents(sessionId) {
  const cart = await getCart(sessionId);
  const totals = calculateTotals(cart.items);

  return success({
    items: cart.items,
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

  // BUG: Smart Watch Pro (product 3) — same inventory limit on update.
  if (String(productId) === '3' && quantity > 2) {
    const errMsg =
      `Inventory validation failed: product ${productId} ` +
      `cannot exceed 2 units per order — requested ${quantity}. ` +
      `Contact warehouse-api.internal for stock allocation.`;
    console.error('[CART] Inventory check error on update:', errMsg, { productId, quantity });
    return error(errMsg, 500);
  }

  const cart = await getCart(sessionId);
  const item = cart.items.find((i) => i.productId === productId);

  if (!item) {
    return error('Item not found in cart', 404);
  }

  item.quantity = quantity;
  await saveCart(sessionId, cart);
  const totals = calculateTotals(cart.items);

  return success({
    cart: { items: cart.items, ...totals },
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
    const totals = calculateTotals(cart.items);

    return success({
      cart: { items: cart.items, ...totals },
      message: 'Item removed from cart',
    });
  });
}

async function clearCart(sessionId) {
  await deleteCart(sessionId);

  return success({
    cart: { items: [], subtotal: 0, tax: 0, shipping: 0, total: 0 },
    message: 'Cart cleared',
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
    if (httpMethod === 'GET' && sessionId) return getCartContents(sessionId);
    if (httpMethod === 'PUT' && path.endsWith('/update')) return updateItemQuantity(body);
    if (httpMethod === 'DELETE' && sessionId && productId) return removeItem(sessionId, productId);
    if (httpMethod === 'DELETE' && sessionId && !productId) return clearCart(sessionId);

    return error('Not Found', 404);
  } catch (err) {
    console.error('Cart handler error:', err);
    return error(err.message || 'Internal server error', 500);
  }
}

module.exports = { handler };
