/**
 * Kelvo E-Comm Payment Lambda - Payment intent and confirmation backed by Redis.
 * @module payment/handler
 */

const tracer = require('../shared/tracer');
const { v4: uuidv4 } = require('uuid');
const { success, error, created, CORS_HEADERS } = require('../shared/responses');
const { getPaymentIntent, savePaymentIntent } = require('../shared/redis');

async function createIntent(params) {
  return tracer.trace('payment.createIntent', async () => {
    const { amount, currency = 'usd', customerEmail, orderId } = params;
    const paymentIntentId = `pi_mock_${uuidv4().replace(/-/g, '')}`;
    const clientSecret = `${paymentIntentId}_secret_${uuidv4().replace(/-/g, '')}`;

    const intent = {
      id: paymentIntentId,
      clientSecret,
      amount: Math.round(amount * 100),
      currency,
      customerEmail,
      orderId,
      status: 'requires_payment_method',
      createdAt: new Date().toISOString(),
    };

    await savePaymentIntent(paymentIntentId, intent);
    return intent;
  });
}

async function processCharge(paymentIntentId) {
  return tracer.trace('payment.processCharge', async () => {
    const intent = await getPaymentIntent(paymentIntentId);
    if (!intent) throw new Error('Payment intent not found');
    intent.status = 'processing';
    await savePaymentIntent(paymentIntentId, intent);
    return { success: true };
  });
}

async function confirmPayment(paymentIntentId) {
  return tracer.trace('payment.confirm', async () => {
    const intent = await getPaymentIntent(paymentIntentId);
    if (!intent) throw new Error('Payment intent not found');

    intent.status = 'succeeded';
    await savePaymentIntent(paymentIntentId, intent);

    return {
      status: 'succeeded',
      receiptUrl: `https://rumshop.com/receipts/${intent.id}`,
      paymentIntentId: intent.id,
      amount: intent.amount / 100,
      currency: intent.currency,
    };
  });
}

async function handleCreateIntent(body) {
  const { amount, currency = 'usd', customerEmail, orderId } = body;

  if (!amount || amount <= 0) {
    return error('Invalid amount', 400);
  }

  const intent = await createIntent({
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

async function handleConfirm(body) {
  const { paymentIntentId } = body;

  if (!paymentIntentId) {
    return error('Missing paymentIntentId', 400);
  }

  try {
    await processCharge(paymentIntentId);
    const result = await confirmPayment(paymentIntentId);
    return success(result);
  } catch (err) {
    return error(err.message || 'Payment confirmation failed', 400);
  }
}

function handleWebhook(body) {
  const eventType = body?.type || 'unknown';
  const eventId = body?.id || uuidv4();

  console.log('[Payment Webhook]', {
    eventId,
    type: eventType,
    timestamp: new Date().toISOString(),
    payload: JSON.stringify(body).slice(0, 500),
  });

  return success({
    received: true,
    eventId,
    eventType,
  });
}

async function handler(event, context) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    const { httpMethod, path, body: rawBody } = event;
    const body = rawBody ? (typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody) : {};

    if (httpMethod === 'POST' && path.endsWith('/create-intent')) return handleCreateIntent(body);
    if (httpMethod === 'POST' && path.endsWith('/confirm')) return handleConfirm(body);
    if (httpMethod === 'POST' && path.endsWith('/webhook')) return handleWebhook(body);

    return error('Not Found', 404);
  } catch (err) {
    console.error('Payment handler error:', err);
    return error(err.message || 'Internal server error', 500);
  }
}

module.exports = { handler };
