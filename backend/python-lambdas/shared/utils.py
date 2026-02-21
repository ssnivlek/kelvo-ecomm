"""Shared utilities for Kelvo E-Comm Python Lambda functions.

Provides JSON/error response helpers, Datadog trace context propagation,
and mock product data consistent with the Java order service.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# CORS headers for API Gateway responses
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def json_response(
    body: dict[str, Any] | list[Any],
    status_code: int = 200,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Build an API Gateway response with JSON body and CORS headers.

    Args:
        body: Response body (will be JSON-serialized).
        status_code: HTTP status code.
        headers: Optional additional headers (merged with CORS_HEADERS).

    Returns:
        API Gateway response dict with statusCode, headers, and body.
    """
    merged_headers = {**CORS_HEADERS}
    if headers:
        merged_headers.update(headers)
    return {
        "statusCode": status_code,
        "headers": merged_headers,
        "body": json.dumps(body),
    }


def error_response(
    message: str,
    status_code: int = 500,
    error_code: str | None = None,
) -> dict[str, Any]:
    """Build an API Gateway error response with CORS headers.

    Args:
        message: Error message for the client.
        status_code: HTTP status code.
        error_code: Optional error code for programmatic handling.

    Returns:
        API Gateway response dict.
    """
    body: dict[str, Any] = {"error": message}
    if error_code:
        body["code"] = error_code
    return json_response(body, status_code=status_code)


def get_trace_context() -> dict[str, str]:
    """Extract Datadog trace context for propagation to downstream services.

    Returns:
        Dict with trace_id and span_id if available, else empty dict.
    """
    try:
        from ddtrace import tracer

        span = tracer.current_span()
        if span and span.context:
            return {
                "x-datadog-trace-id": str(span.context.trace_id),
                "x-datadog-parent-id": str(span.context.span_id),
            }
    except ImportError:
        logger.debug("ddtrace not available for trace context")
    except Exception as e:
        logger.debug("Could not extract trace context: %s", e)
    return {}


# Mock product data - same 50 products as Java order service (DataSeeder)
PRODUCTS: list[dict[str, Any]] = [
    {
        "id": 1,
        "name": "Wireless Noise-Cancelling Headphones",
        "description": "Premium over-ear headphones with active noise cancellation and 30-hour battery life",
        "price": 299.99,
        "imageUrl": "/images/products/wireless-noise-cancelling-headphones.svg",
        "category": "Electronics",
        "stockQuantity": 50,
        "sku": "ELEC-001",
        "slug": "wireless-noise-cancelling-headphones",
    },
    {
        "id": 2,
        "name": "Ultra-Slim Laptop 15\"",
        "description": "Lightweight 15-inch laptop with 16GB RAM and 512GB SSD",
        "price": 1299.99,
        "imageUrl": "/images/products/ultra-slim-laptop-15.svg",
        "category": "Electronics",
        "stockQuantity": 25,
        "sku": "ELEC-002",
        "slug": "ultra-slim-laptop-15",
    },
    {
        "id": 3,
        "name": "Smart Watch Pro",
        "description": "Advanced fitness tracking, heart rate monitoring, and 7-day battery life",
        "price": 399.99,
        "imageUrl": "/images/products/smart-watch-pro.svg",
        "category": "Electronics",
        "stockQuantity": 75,
        "sku": "ELEC-003",
        "slug": "smart-watch-pro",
    },
    {
        "id": 4,
        "name": "4K Action Camera",
        "description": "Waterproof action camera with 4K video and image stabilization",
        "price": 249.99,
        "imageUrl": "/images/products/4k-action-camera.svg",
        "category": "Electronics",
        "stockQuantity": 40,
        "sku": "ELEC-004",
        "slug": "4k-action-camera",
    },
    {
        "id": 5,
        "name": "Premium Cotton T-Shirt",
        "description": "100% organic cotton, comfortable fit, available in multiple colors",
        "price": 39.99,
        "imageUrl": "/images/products/premium-cotton-tshirt.svg",
        "category": "Clothing",
        "stockQuantity": 200,
        "sku": "CLTH-001",
        "slug": "premium-cotton-tshirt",
    },
    {
        "id": 6,
        "name": "Leather Crossbody Bag",
        "description": "Handcrafted genuine leather bag with adjustable strap",
        "price": 89.99,
        "imageUrl": "/images/products/leather-crossbody-bag.svg",
        "category": "Clothing",
        "stockQuantity": 60,
        "sku": "CLTH-002",
        "slug": "leather-crossbody-bag",
    },
    {
        "id": 7,
        "name": "Running Shoes Ultra",
        "description": "Lightweight running shoes with responsive cushioning",
        "price": 129.99,
        "imageUrl": "/images/products/running-shoes-ultra.svg",
        "category": "Clothing",
        "stockQuantity": 80,
        "sku": "CLTH-003",
        "slug": "running-shoes-ultra",
    },
    {
        "id": 8,
        "name": "Denim Jacket Classic",
        "description": "Timeless denim jacket with a comfortable relaxed fit",
        "price": 79.99,
        "imageUrl": "/images/products/denim-jacket-classic.svg",
        "category": "Clothing",
        "stockQuantity": 45,
        "sku": "CLTH-004",
        "slug": "denim-jacket-classic",
    },
    {
        "id": 9,
        "name": "Robot Vacuum Cleaner",
        "description": "Smart mapping, app control, and self-emptying base",
        "price": 449.99,
        "imageUrl": "/images/products/robot-vacuum-cleaner.svg",
        "category": "Home & Kitchen",
        "stockQuantity": 30,
        "sku": "HOME-001",
        "slug": "robot-vacuum-cleaner",
    },
    {
        "id": 10,
        "name": "Stainless Steel Cookware Set",
        "description": "10-piece set with induction-compatible pots and pans",
        "price": 199.99,
        "imageUrl": "/images/products/stainless-steel-cookware-set.svg",
        "category": "Home & Kitchen",
        "stockQuantity": 35,
        "sku": "HOME-002",
        "slug": "stainless-steel-cookware-set",
    },
    {
        "id": 11,
        "name": "Yoga Mat Premium",
        "description": "Extra thick non-slip mat with carrying strap",
        "price": 49.99,
        "imageUrl": "/images/products/yoga-mat-premium.svg",
        "category": "Sports",
        "stockQuantity": 100,
        "sku": "SPRT-001",
        "slug": "yoga-mat-premium",
    },
    {
        "id": 12,
        "name": "Mountain Bike Helmet",
        "description": "Ventilated helmet with MIPS technology for enhanced safety",
        "price": 69.99,
        "imageUrl": "/images/products/mountain-bike-helmet.svg",
        "category": "Sports",
        "stockQuantity": 90,
        "sku": "SPRT-002",
        "slug": "mountain-bike-helmet",
    },
    {
        "id": 13,
        "name": "Bluetooth Speaker Mini",
        "description": "Compact portable speaker with 12-hour battery and rich bass",
        "price": 59.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Electronics",
        "stockQuantity": 120,
        "sku": "ELEC-005",
        "slug": "bluetooth-speaker-mini",
    },
    {
        "id": 14,
        "name": "Wireless Earbuds Pro",
        "description": "True wireless earbuds with active noise cancellation",
        "price": 149.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Electronics",
        "stockQuantity": 85,
        "sku": "ELEC-006",
        "slug": "wireless-earbuds-pro",
    },
    {
        "id": 15,
        "name": "Tablet 10\"",
        "description": "10-inch tablet with HD display and 64GB storage",
        "price": 279.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Electronics",
        "stockQuantity": 55,
        "sku": "ELEC-007",
        "slug": "tablet-10",
    },
    {
        "id": 16,
        "name": "Mechanical Keyboard RGB",
        "description": "Gaming mechanical keyboard with customizable RGB lighting",
        "price": 119.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Electronics",
        "stockQuantity": 70,
        "sku": "ELEC-008",
        "slug": "mechanical-keyboard-rgb",
    },
    {
        "id": 17,
        "name": "Wool Sweater Classic",
        "description": "Soft merino wool sweater, perfect for cool weather",
        "price": 89.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Clothing",
        "stockQuantity": 65,
        "sku": "CLTH-005",
        "slug": "wool-sweater-classic",
    },
    {
        "id": 18,
        "name": "Canvas Backpack",
        "description": "Sturdy canvas backpack with laptop compartment",
        "price": 54.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Clothing",
        "stockQuantity": 95,
        "sku": "CLTH-006",
        "slug": "canvas-backpack",
    },
    {
        "id": 19,
        "name": "Athletic Shorts",
        "description": "Moisture-wicking athletic shorts with built-in liner",
        "price": 34.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Clothing",
        "stockQuantity": 150,
        "sku": "CLTH-007",
        "slug": "athletic-shorts",
    },
    {
        "id": 20,
        "name": "Winter Parka",
        "description": "Insulated winter parka with hood and multiple pockets",
        "price": 159.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Clothing",
        "stockQuantity": 40,
        "sku": "CLTH-008",
        "slug": "winter-parka",
    },
    {
        "id": 21,
        "name": "Espresso Machine",
        "description": "Compact espresso maker with milk frother",
        "price": 189.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Home & Kitchen",
        "stockQuantity": 45,
        "sku": "HOME-003",
        "slug": "espresso-machine",
    },
    {
        "id": 22,
        "name": "Air Fryer XL",
        "description": "Large capacity air fryer with digital controls",
        "price": 129.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Home & Kitchen",
        "stockQuantity": 60,
        "sku": "HOME-004",
        "slug": "air-fryer-xl",
    },
    {
        "id": 23,
        "name": "Blender Pro",
        "description": "High-speed blender for smoothies and soups",
        "price": 99.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Home & Kitchen",
        "stockQuantity": 75,
        "sku": "HOME-005",
        "slug": "blender-pro",
    },
    {
        "id": 24,
        "name": "Coffee Grinder Burr",
        "description": "Electric burr grinder with 15 grind settings",
        "price": 69.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Home & Kitchen",
        "stockQuantity": 80,
        "sku": "HOME-006",
        "slug": "coffee-grinder-burr",
    },
    {
        "id": 25,
        "name": "Kitchen Knife Set",
        "description": "8-piece chef knife set with wooden block",
        "price": 149.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Home & Kitchen",
        "stockQuantity": 35,
        "sku": "HOME-007",
        "slug": "kitchen-knife-set",
    },
    {
        "id": 26,
        "name": "Food Storage Containers",
        "description": "20-piece BPA-free food storage container set",
        "price": 44.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Home & Kitchen",
        "stockQuantity": 110,
        "sku": "HOME-008",
        "slug": "food-storage-containers",
    },
    {
        "id": 27,
        "name": "Resistance Bands Set",
        "description": "Set of 5 resistance bands with different tension levels",
        "price": 24.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Sports",
        "stockQuantity": 130,
        "sku": "SPRT-003",
        "slug": "resistance-bands-set",
    },
    {
        "id": 28,
        "name": "Dumbbells Pair 10lb",
        "description": "Adjustable dumbbells with rubber coating",
        "price": 79.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Sports",
        "stockQuantity": 55,
        "sku": "SPRT-004",
        "slug": "dumbbells-pair-10lb",
    },
    {
        "id": 29,
        "name": "Tennis Racket Pro",
        "description": "Professional tennis racket with carbon fiber frame",
        "price": 119.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Sports",
        "stockQuantity": 45,
        "sku": "SPRT-005",
        "slug": "tennis-racket-pro",
    },
    {
        "id": 30,
        "name": "Running Armband",
        "description": "Phone holder armband for running and workouts",
        "price": 19.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Sports",
        "stockQuantity": 180,
        "sku": "SPRT-006",
        "slug": "running-armband",
    },
    {
        "id": 31,
        "name": "Foam Roller",
        "description": "High-density foam roller for muscle recovery",
        "price": 34.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Sports",
        "stockQuantity": 95,
        "sku": "SPRT-007",
        "slug": "foam-roller",
    },
    {
        "id": 32,
        "name": "Jump Rope Speed",
        "description": "Weighted speed jump rope for cardio training",
        "price": 29.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Sports",
        "stockQuantity": 120,
        "sku": "SPRT-008",
        "slug": "jump-rope-speed",
    },
    {
        "id": 33,
        "name": "The Art of Programming",
        "description": "Comprehensive guide to clean code and software design",
        "price": 24.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Books",
        "stockQuantity": 85,
        "sku": "BOOK-001",
        "slug": "the-art-of-programming",
    },
    {
        "id": 34,
        "name": "Cookbook Essentials",
        "description": "500 essential recipes for home cooks",
        "price": 19.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Books",
        "stockQuantity": 95,
        "sku": "BOOK-002",
        "slug": "cookbook-essentials",
    },
    {
        "id": 35,
        "name": "Travel Photography Guide",
        "description": "Tips and techniques for stunning travel photos",
        "price": 16.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Books",
        "stockQuantity": 70,
        "sku": "BOOK-003",
        "slug": "travel-photography-guide",
    },
    {
        "id": 36,
        "name": "Self-Help Best Seller",
        "description": "Bestselling guide to personal growth and productivity",
        "price": 14.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Books",
        "stockQuantity": 150,
        "sku": "BOOK-004",
        "slug": "self-help-best-seller",
    },
    {
        "id": 37,
        "name": "Mystery Novel Collection",
        "description": "Thrilling mystery series box set",
        "price": 29.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Books",
        "stockQuantity": 45,
        "sku": "BOOK-005",
        "slug": "mystery-novel-collection",
    },
    {
        "id": 38,
        "name": "Children's Storybook",
        "description": "Illustrated storybook for ages 4-8",
        "price": 12.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Books",
        "stockQuantity": 200,
        "sku": "BOOK-006",
        "slug": "childrens-storybook",
    },
    {
        "id": 39,
        "name": "Vitamin C Serum",
        "description": "Anti-aging serum with 20% vitamin C",
        "price": 34.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Beauty",
        "stockQuantity": 90,
        "sku": "BEAU-001",
        "slug": "vitamin-c-serum",
    },
    {
        "id": 40,
        "name": "Hydrating Face Cream",
        "description": "Deep moisturizing cream for all skin types",
        "price": 28.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Beauty",
        "stockQuantity": 110,
        "sku": "BEAU-002",
        "slug": "hydrating-face-cream",
    },
    {
        "id": 41,
        "name": "Lipstick Set",
        "description": "Set of 6 long-lasting lipstick shades",
        "price": 24.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Beauty",
        "stockQuantity": 75,
        "sku": "BEAU-003",
        "slug": "lipstick-set",
    },
    {
        "id": 42,
        "name": "Hair Dryer Professional",
        "description": "Salon-quality hair dryer with ionic technology",
        "price": 79.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Beauty",
        "stockQuantity": 50,
        "sku": "BEAU-004",
        "slug": "hair-dryer-professional",
    },
    {
        "id": 43,
        "name": "Essential Oil Diffuser",
        "description": "Ultrasonic aromatherapy diffuser with LED lights",
        "price": 39.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Beauty",
        "stockQuantity": 85,
        "sku": "BEAU-005",
        "slug": "essential-oil-diffuser",
    },
    {
        "id": 44,
        "name": "Nail Polish Collection",
        "description": "Set of 10 long-wear nail polish colors",
        "price": 18.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Beauty",
        "stockQuantity": 120,
        "sku": "BEAU-006",
        "slug": "nail-polish-collection",
    },
    {
        "id": 45,
        "name": "Board Game Strategy",
        "description": "Award-winning family strategy board game",
        "price": 34.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Toys & Games",
        "stockQuantity": 65,
        "sku": "TOYS-001",
        "slug": "board-game-strategy",
    },
    {
        "id": 46,
        "name": "Building Blocks Set",
        "description": "500-piece construction building blocks set",
        "price": 49.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Toys & Games",
        "stockQuantity": 55,
        "sku": "TOYS-002",
        "slug": "building-blocks-set",
    },
    {
        "id": 47,
        "name": "Puzzle 1000 Pieces",
        "description": "Landscape jigsaw puzzle, 1000 pieces",
        "price": 19.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Toys & Games",
        "stockQuantity": 80,
        "sku": "TOYS-003",
        "slug": "puzzle-1000-pieces",
    },
    {
        "id": 48,
        "name": "Remote Control Car",
        "description": "1:18 scale RC car with 2.4GHz control",
        "price": 59.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Toys & Games",
        "stockQuantity": 45,
        "sku": "TOYS-004",
        "slug": "remote-control-car",
    },
    {
        "id": 49,
        "name": "Card Game Party",
        "description": "Fast-paced party card game for 4-12 players",
        "price": 14.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Toys & Games",
        "stockQuantity": 140,
        "sku": "TOYS-005",
        "slug": "card-game-party",
    },
    {
        "id": 50,
        "name": "Plush Toy Bear",
        "description": "Soft plush teddy bear, 12 inches",
        "price": 24.99,
        "imageUrl": "/images/products/placeholder.svg",
        "category": "Toys & Games",
        "stockQuantity": 95,
        "sku": "TOYS-006",
        "slug": "plush-toy-bear",
    },
]
