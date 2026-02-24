/**
 * Kelvo E-Comm Payment Lambda - Payment intent and confirmation backed by Redis.
 * @module payment/handler
 */

const tracer = require('../shared/tracer');
const logger = require('../shared/logger');
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
      receiptUrl: `https://kelvo-ecomm.com/receipts/${intent.id}`,
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
    customerEmail: customerEmail || 'guest@kelvo-ecomm.com',
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

  logger.info('[Payment Webhook]', {
    eventId,
    type: eventType,
    payload: JSON.stringify(body).slice(0, 500),
  });

  return success({
    received: true,
    eventId,
    eventType,
  });
}

async function handleValidateCoupon(body) {
  return tracer.trace('payment.validateCoupon', async (span) => {
    const { couponCode } = body;

    if (!couponCode) {
      return error('Missing couponCode', 400);
    }

    const code = couponCode.toUpperCase().trim();
    if (span) span.setTag('coupon.code', code);

    const VALID_COUPONS = {
      KELVO10:  { discountPercent: 10, label: '10% off your order' },
      KELVO25:  { discountPercent: 25, label: '25% off your order' },
      FRETE:    { discountPercent: 0,  label: 'Free shipping', freeShipping: true },
      WELCOME5: { discountPercent: 5,  label: '5% welcome discount' },
    };

    if (code === 'BLACKFRIDAY') {
      logger.error('[PAYMENT] Coupon store failure: Redis connection timeout at coupon-store.internal:6380, pool exhausted after 3 retries', {
        couponCode: code, upstream: 'coupon-store.internal:6380', retries: 3,
      });
      if (span) {
        span.setTag('error', true);
        span.setTag('error.message', 'Redis connection timeout at coupon-store.internal:6380');
        span.setTag('error.type', 'UpstreamTimeout');
        span.setTag('coupon.upstream', 'coupon-store.internal:6380');
      }
      return error('Could not apply coupon code', 500);
    }

    const coupon = VALID_COUPONS[code];
    if (!coupon) {
      return error('Invalid coupon code', 400);
    }

    return success(coupon);
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
    if (httpMethod === 'POST' && path.endsWith('/validate-coupon')) return handleValidateCoupon(body);

    return error('Not Found', 404);
  } catch (err) {
    logger.error('Payment handler error', { error: err.message, stack: err.stack });
    return error(err.message || 'Internal server error', 500);
  }
}

module.exports = { handler };
