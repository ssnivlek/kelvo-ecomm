/**
 * RUM Shop Payment Lambda - Payment intent and confirmation (mock Stripe) with Datadog APM.
 * @module payment/handler
 */

const tracer = require('../shared/tracer');
const { v4: uuidv4 } = require('uuid');
const { success, error, created, CORS_HEADERS } = require('../shared/responses');

/** In-memory store for mock payment intents */
const paymentIntents = new Map();

/**
 * Create mock Stripe payment intent.
 * @param {object} params - Payment params
 * @returns {object} Mock payment intent
 */
function createIntent(params) {
  return tracer.trace('payment.createIntent', () => {
    const { amount, currency = 'usd', customerEmail, orderId } = params;
    const paymentIntentId = `pi_mock_${uuidv4().replace(/-/g, '')}`;
    const clientSecret = `${paymentIntentId}_secret_${uuidv4().replace(/-/g, '')}`;

    const intent = {
      id: paymentIntentId,
      clientSecret,
      amount: Math.round(amount * 100), // cents
      currency,
      customerEmail,
      orderId,
      status: 'requires_payment_method',
      createdAt: new Date(),
    };

    paymentIntents.set(paymentIntentId, intent);
    return intent;
  });
}

/**
 * Process charge (simulate).
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {object} Charge result
 */
function processCharge(paymentIntentId) {
  return tracer.trace('payment.processCharge', () => {
    const intent = paymentIntents.get(paymentIntentId);
    if (!intent) {
      throw new Error('Payment intent not found');
    }
    // Simulate processing
    intent.status = 'processing';
    return { success: true };
  });
}

/**
 * Confirm payment (simulate).
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {object} Confirmation result
 */
function confirmPayment(paymentIntentId) {
  return tracer.trace('payment.confirm', () => {
    const intent = paymentIntents.get(paymentIntentId);
    if (!intent) {
      throw new Error('Payment intent not found');
    }

    intent.status = 'succeeded';
    const receiptUrl = `https://rumshop.com/receipts/${intent.id}`;

    return {
      status: 'succeeded',
      receiptUrl,
      paymentIntentId: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency,
    };
  });
}

/**
 * Create payment intent endpoint.
 * @param {object} body - Request body
 * @returns {object} API Gateway response
 */
function handleCreateIntent(body) {
  const { amount, currency = 'usd', customerEmail, orderId } = body;

  if (!amount || amount <= 0) {
    return error('Invalid amount', 400);
  }

  const intent = createIntent({
    amount: Number(amount),
    currency,
    customerEmail: customerEmail || 'guest@rumshop.com',
    orderId: orderId || `order_${uuidv4()}`,
  });

  return created({
    clientSecret: intent.clientSecret,
    paymentIntentId: intent.id,
    status: intent.status,
  });
}

/**
 * Confirm payment endpoint.
 * @param {object} body - Request body
 * @returns {object} API Gateway response
 */
function handleConfirm(body) {
  const { paymentIntentId } = body;

  if (!paymentIntentId) {
    return error('Missing paymentIntentId', 400);
  }

  try {
    processCharge(paymentIntentId);
    const result = confirmPayment(paymentIntentId);
    return success(result);
  } catch (err) {
    return error(err.message || 'Payment confirmation failed', 400);
  }
}

/**
 * Webhook handler - simulates Stripe webhook.
 * @param {object} body - Webhook payload
 * @returns {object} API Gateway response
 */
function handleWebhook(body) {
  const event = body?.type || 'unknown';
  const eventId = body?.id || uuidv4();

  console.log('[Payment Webhook]', {
    eventId,
    type: event,
    timestamp: new Date().toISOString(),
    payload: JSON.stringify(body).slice(0, 500),
  });

  return success({
    received: true,
    eventId,
    eventType: event,
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
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: '',
      };
    }

    const { httpMethod, path, body: rawBody } = event;
    const body = rawBody ? (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody) : {};

    // POST /api/payment/create-intent
    if (httpMethod === 'POST' && path.endsWith('/create-intent')) {
      return handleCreateIntent(body);
    }

    // POST /api/payment/confirm
    if (httpMethod === 'POST' && path.endsWith('/confirm')) {
      return handleConfirm(body);
    }

    // POST /api/payment/webhook
    if (httpMethod === 'POST' && path.endsWith('/webhook')) {
      return handleWebhook(body);
    }

    return error('Not Found', 404);
  } catch (err) {
    console.error('Payment handler error:', err);
    return error(err.message || 'Internal server error', 500);
  }
}

module.exports = { handler };
