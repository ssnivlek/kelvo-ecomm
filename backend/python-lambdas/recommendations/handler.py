"""Product Recommendations Lambda for Kelvo E-Comm.

GET /api/recommendations?productId={id}&limit=4
- Given a product ID, returns similar products from the same category.
- If no productId, returns top/featured products.
"""

from __future__ import annotations

import logging
from typing import Any

from datadog_lambda.wrapper import datadog_lambda_wrapper
from ddtrace import tracer

from shared.utils import json_response, error_response, PRODUCTS

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _get_product_by_id(product_id: int) -> dict[str, Any] | None:
    """Find a product by ID."""
    for p in PRODUCTS:
        if p["id"] == product_id:
            return p
    return None


def _get_recommendations_for_product(product_id: int, limit: int) -> list[dict[str, Any]]:
    """Get similar products from the same category, excluding the given product."""
    with tracer.trace("recommendations.calculate", service="kelvo-ecomm-recommendations"):
        product = _get_product_by_id(product_id)
        if not product:
            return []

        category = product["category"]
        with tracer.trace("recommendations.filter", service="kelvo-ecomm-recommendations"):
            same_category = [p for p in PRODUCTS if p["category"] == category and p["id"] != product_id]
            return same_category[:limit]


def _get_featured_products(limit: int) -> list[dict[str, Any]]:
    """Get top/featured products (first N by ID as featured)."""
    with tracer.trace("recommendations.calculate", service="kelvo-ecomm-recommendations"):
        with tracer.trace("recommendations.filter", service="kelvo-ecomm-recommendations"):
            return PRODUCTS[:limit]


def _handle_recommendations(event: dict[str, Any]) -> dict[str, Any]:
    """Handle GET /api/recommendations request."""
    params = event.get("queryStringParameters") or {}
    product_id_str = params.get("productId")
    limit_str = params.get("limit", "4")

    try:
        limit = min(max(int(limit_str), 1), 20)
    except ValueError:
        return error_response("Invalid limit parameter", status_code=400, error_code="INVALID_LIMIT")

    if product_id_str:
        try:
            product_id = int(product_id_str)
        except ValueError:
            return error_response("Invalid productId parameter", status_code=400, error_code="INVALID_PRODUCT_ID")
        recommendations = _get_recommendations_for_product(product_id, limit)
    else:
        recommendations = _get_featured_products(limit)

    return json_response({"recommendations": recommendations})


def _handle_health(event: dict[str, Any]) -> dict[str, Any]:
    """Handle health check."""
    return json_response({"status": "healthy", "service": "kelvo-ecomm-recommendations"})


def _handle_options() -> dict[str, Any]:
    """Handle CORS preflight OPTIONS request."""
    return json_response({}, status_code=204)


def _handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Main Lambda handler with routing."""
    try:
        path = event.get("path", "")
        http_method = event.get("httpMethod", "GET")

        if http_method == "OPTIONS":
            return _handle_options()
        if path.endswith("/health") or path == "/health":
            return _handle_health(event)
        if path.endswith("/recommendations") or "/api/recommendations" in path:
            if http_method == "GET":
                return _handle_recommendations(event)
            return error_response("Method not allowed", status_code=405, error_code="METHOD_NOT_ALLOWED")

        return error_response("Not found", status_code=404, error_code="NOT_FOUND")
    except Exception as e:
        logger.exception("Unhandled error in recommendations handler")
        return error_response(str(e), status_code=500, error_code="INTERNAL_ERROR")


@datadog_lambda_wrapper
def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Datadog-instrumented Lambda entry point."""
    return _handler(event, context)
