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


# Mock product data - same 12 products as Java order service (DataSeeder)
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
]
