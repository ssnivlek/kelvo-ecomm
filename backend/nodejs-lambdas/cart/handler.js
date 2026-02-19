/**
 * RUM Shop Cart Lambda - Shopping cart operations with Datadog APM.
 * @module cart/handler
 */

const tracer = require('../shared/tracer');
const { success, error, CORS_HEADERS } = require('../shared/responses');
const { getCart, saveCart } = require('../shared/mockDb');

const TAX_RATE = 0.085;
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_COST = 5.99;

/**
 * Calculates cart totals (subtotal, tax, shipping, total).
 * @param {Array<{price: number, quantity: number}>} items - Cart items
 * @returns {object} Totals object
 */
function calculateTotals(items) {
  return tracer.trace('cart.calculateTotals', () => {
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
  });
}

/**
 * Add item to cart.
 * @param {object} body - Request body
 * @returns {object} API Gateway response
 */
function addItem(body) {
  return tracer.trace('cart.addItem', () => {
    const { sessionId, productId, productName, price, quantity = 1, imageUrl } = body;

    if (!sessionId || !productId || !productName || price === undefined) {
      return error('Missing required fields: sessionId, productId, productName, price', 400);
    }

    const cart = getCart(sessionId);
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

    saveCart(sessionId, cart);
    const totals = calculateTotals(cart.items);

    return success({
      cart: { items: cart.items, ...totals },
      message: 'Item added to cart',
    });
  });
}

/**
 * Get cart contents.
 * @param {string} sessionId - Session identifier
 * @returns {object} API Gateway response
 */
function getCartContents(sessionId) {
  const cart = getCart(sessionId);
  const totals = calculateTotals(cart.items);

  return success({
    items: cart.items,
    ...totals,
    updatedAt: cart.updatedAt,
  });
}

/**
 * Update item quantity.
 * @param {object} body - Request body
 * @returns {object} API Gateway response
 */
function updateItemQuantity(body) {
  const { sessionId, productId, quantity } = body;

  if (!sessionId || !productId || quantity === undefined) {
    return error('Missing required fields: sessionId, productId, quantity', 400);
  }

  const cart = getCart(sessionId);
  const item = cart.items.find((i) => i.productId === productId);

  if (!item) {
    return error('Item not found in cart', 404);
  }

  if (quantity <= 0) {
    return error('Quantity must be positive', 400);
  }

  item.quantity = quantity;
  saveCart(sessionId, cart);
  const totals = calculateTotals(cart.items);

  return success({
    cart: { items: cart.items, ...totals },
    message: 'Cart updated',
  });
}

/**
 * Remove item from cart.
 * @param {string} sessionId - Session identifier
 * @param {string} productId - Product identifier
 * @returns {object} API Gateway response
 */
function removeItem(sessionId, productId) {
  return tracer.trace('cart.removeItem', () => {
    const cart = getCart(sessionId);
    const index = cart.items.findIndex((i) => i.productId === productId);

    if (index < 0) {
      return error('Item not found in cart', 404);
    }

    cart.items.splice(index, 1);
    saveCart(sessionId, cart);
    const totals = calculateTotals(cart.items);

    return success({
      cart: { items: cart.items, ...totals },
      message: 'Item removed from cart',
    });
  });
}

/**
 * Clear entire cart.
 * @param {string} sessionId - Session identifier
 * @returns {object} API Gateway response
 */
function clearCart(sessionId) {
  const cart = getCart(sessionId);
  cart.items = [];
  saveCart(sessionId, cart);

  return success({
    cart: { items: [], subtotal: 0, tax: 0, shipping: 0, total: 0 },
    message: 'Cart cleared',
  });
}

/**
 * Main Lambda handler - routes requests to appropriate handlers.
 * @param {object} event - API Gateway event
 * @param {object} context - Lambda context
 * @returns {Promise<object>} API Gateway response
 */
async function handler(event, context) {
  try {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: '',
      };
    }

    const { httpMethod, path, pathParameters = {}, body: rawBody } = event;
    const body = rawBody ? (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody) : {};
    const { sessionId, productId } = pathParameters;

    // POST /api/cart/add
    if (httpMethod === 'POST' && path.endsWith('/add')) {
      return addItem(body);
    }

    // GET /api/cart/{sessionId}
    if (httpMethod === 'GET' && sessionId) {
      return getCartContents(sessionId);
    }

    // PUT /api/cart/update
    if (httpMethod === 'PUT' && path.endsWith('/update')) {
      return updateItemQuantity(body);
    }

    // DELETE /api/cart/{sessionId}/item/{productId}
    if (httpMethod === 'DELETE' && sessionId && productId) {
      return removeItem(sessionId, productId);
    }

    // DELETE /api/cart/{sessionId}
    if (httpMethod === 'DELETE' && sessionId && !productId) {
      return clearCart(sessionId);
    }

    return error('Not Found', 404);
  } catch (err) {
    console.error('Cart handler error:', err);
    return error(err.message || 'Internal server error', 500);
  }
}

module.exports = { handler };
