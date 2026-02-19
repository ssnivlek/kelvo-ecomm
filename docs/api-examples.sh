#!/usr/bin/env bash
# ================================================================
# Kelvo-Ecomm — API curl examples
# ================================================================
# Run any of these after `docker-compose up -d`
# Swagger UI: http://localhost:8888
# ================================================================

BASE_ORDER="http://localhost:8080"
BASE_CART="http://localhost:3001"
BASE_AUTH="http://localhost:3002"
BASE_PAY="http://localhost:3003"
BASE_SEARCH="http://localhost:3004"
BASE_RECS="http://localhost:3005"
BASE_NOTIF="http://localhost:3006"

# ━━━ PRODUCTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "─── List products ───"
curl -s "$BASE_ORDER/api/products" | python3 -m json.tool

echo "─── Get product by ID ───"
curl -s "$BASE_ORDER/api/products/1" | python3 -m json.tool

echo "─── Search products by name ───"
curl -s "$BASE_ORDER/api/products/search?q=headphones" | python3 -m json.tool

echo "─── Create product ───"
curl -s -X POST "$BASE_ORDER/api/products" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gaming Mouse",
    "description": "12000 DPI optical sensor",
    "price": 59.99,
    "imageUrl": "/images/mouse.svg",
    "category": "Electronics",
    "stockQuantity": 200,
    "sku": "GM-010",
    "slug": "gaming-mouse"
  }' | python3 -m json.tool

echo "─── Update stock ───"
curl -s -X PUT "$BASE_ORDER/api/products/1/stock" \
  -H "Content-Type: application/json" \
  -d '{"stockQuantity": 75}' | python3 -m json.tool

# ━━━ ORDERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "─── Create order ───"
curl -s -X POST "$BASE_ORDER/api/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "kelvin@example.com",
    "customerName": "Kelvin Soares",
    "shippingAddress": "123 AWS Street, Cloud City",
    "items": [
      {"productId": 1, "quantity": 2},
      {"productId": 3, "quantity": 1}
    ]
  }' | python3 -m json.tool

echo "─── Get order ───"
curl -s "$BASE_ORDER/api/orders/1" | python3 -m json.tool

echo "─── Get orders by customer ───"
curl -s "$BASE_ORDER/api/orders/customer/kelvin@example.com" | python3 -m json.tool

echo "─── Update order status ───"
curl -s -X PUT "$BASE_ORDER/api/orders/1/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "CONFIRMED"}' | python3 -m json.tool

# ━━━ CART ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "─── Add to cart ───"
curl -s -X POST "$BASE_CART/api/cart/add" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_demo123",
    "productId": 1,
    "productName": "Wireless Headphones",
    "price": 149.99,
    "quantity": 2,
    "imageUrl": "/images/headphones.svg"
  }' | python3 -m json.tool

echo "─── Get cart ───"
curl -s "$BASE_CART/api/cart/sess_demo123" | python3 -m json.tool

echo "─── Update cart item ───"
curl -s -X PUT "$BASE_CART/api/cart/update" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "sess_demo123",
    "productId": 1,
    "quantity": 5
  }' | python3 -m json.tool

echo "─── Remove item from cart ───"
curl -s -X DELETE "$BASE_CART/api/cart/sess_demo123/item/1" | python3 -m json.tool

echo "─── Clear cart ───"
curl -s -X DELETE "$BASE_CART/api/cart/sess_demo123" | python3 -m json.tool

# ━━━ AUTH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "─── Register ───"
REGISTER=$(curl -s -X POST "$BASE_AUTH/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "kelvin@example.com",
    "name": "Kelvin Soares",
    "password": "Str0ngP@ss!"
  }')
echo "$REGISTER" | python3 -m json.tool
TOKEN=$(echo "$REGISTER" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

echo "─── Login ───"
curl -s -X POST "$BASE_AUTH/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "kelvin@example.com",
    "password": "Str0ngP@ss!"
  }' | python3 -m json.tool

echo "─── Get profile (JWT required) ───"
curl -s "$BASE_AUTH/api/auth/profile" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# ━━━ PAYMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "─── Create payment intent ───"
INTENT=$(curl -s -X POST "$BASE_PAY/api/payment/create-intent" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 332.97,
    "currency": "usd",
    "customerEmail": "kelvin@example.com",
    "orderId": "order_001"
  }')
echo "$INTENT" | python3 -m json.tool
PI_ID=$(echo "$INTENT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('paymentIntentId',''))")

echo "─── Confirm payment ───"
curl -s -X POST "$BASE_PAY/api/payment/confirm" \
  -H "Content-Type: application/json" \
  -d "{\"paymentIntentId\": \"$PI_ID\"}" | python3 -m json.tool

echo "─── Webhook ───"
curl -s -X POST "$BASE_PAY/api/payment/webhook" \
  -H "Content-Type: application/json" \
  -d '{"type": "payment_intent.succeeded", "id": "evt_abc123"}' | python3 -m json.tool

# ━━━ SEARCH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "─── Search: text query ───"
curl -s "$BASE_SEARCH/api/search?q=headphones" | python3 -m json.tool

echo "─── Search: category + price range ───"
curl -s "$BASE_SEARCH/api/search?category=Electronics&minPrice=50&maxPrice=200&sort=price_asc" | python3 -m json.tool

# ━━━ RECOMMENDATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "─── General recommendations ───"
curl -s "$BASE_RECS/api/recommendations?limit=4" | python3 -m json.tool

echo "─── Recommendations for product 1 ───"
curl -s "$BASE_RECS/api/recommendations?productId=1&limit=3" | python3 -m json.tool

# ━━━ NOTIFICATIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "─── Order confirmation ───"
curl -s -X POST "$BASE_NOTIF/api/notifications/order-confirmation" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_001",
    "customerEmail": "kelvin@example.com",
    "customerName": "Kelvin Soares",
    "items": [
      {"productName": "Wireless Headphones", "quantity": 2, "price": 149.99},
      {"productName": "Mechanical Keyboard", "quantity": 1, "price": 129.99}
    ],
    "totalAmount": 429.97
  }' | python3 -m json.tool

echo "─── Shipping update ───"
curl -s -X POST "$BASE_NOTIF/api/notifications/shipping-update" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order_001",
    "customerEmail": "kelvin@example.com",
    "trackingNumber": "1Z999AA10123456784",
    "status": "shipped"
  }' | python3 -m json.tool

# ━━━ HEALTH ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "─── Health checks ───"
for svc in "$BASE_ORDER/actuator/health" \
           "$BASE_CART/health" \
           "$BASE_AUTH/health" \
           "$BASE_PAY/health" \
           "$BASE_SEARCH/health" \
           "$BASE_RECS/health" \
           "$BASE_NOTIF/health"; do
  echo "  $svc"
  curl -s "$svc" | python3 -m json.tool
done
