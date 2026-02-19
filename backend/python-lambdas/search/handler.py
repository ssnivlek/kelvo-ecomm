"""Product Search Lambda for Kelvo E-Comm.

GET /api/search?q={query}&category={category}&minPrice={min}&maxPrice={max}&sort={price_asc|price_desc|name}
"""

from __future__ import annotations

import logging
from typing import Any

from datadog_lambda.wrapper import datadog_lambda_wrapper
from ddtrace import tracer

from shared.utils import json_response, error_response, PRODUCTS

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

SORT_OPTIONS = {"price_asc", "price_desc", "name"}


def _search_products(
    query: str | None,
    category: str | None,
    min_price: float | None,
    max_price: float | None,
    sort: str,
) -> list[dict[str, Any]]:
    """Search products by name/description, filter by category and price, then sort."""
    with tracer.trace("search.query", service="rum-shop-search"):
        results = list(PRODUCTS)

        if query:
            q = query.lower()
            with tracer.trace("search.filter", service="rum-shop-search"):
                results = [
                    p
                    for p in results
                    if q in p["name"].lower() or q in p["description"].lower()
                ]

        if category:
            with tracer.trace("search.filter", service="rum-shop-search"):
                results = [p for p in results if p["category"].lower() == category.lower()]

        if min_price is not None:
            with tracer.trace("search.filter", service="rum-shop-search"):
                results = [p for p in results if p["price"] >= min_price]

        if max_price is not None:
            with tracer.trace("search.filter", service="rum-shop-search"):
                results = [p for p in results if p["price"] <= max_price]

        with tracer.trace("search.sort", service="rum-shop-search"):
            if sort == "price_asc":
                results.sort(key=lambda p: p["price"])
            elif sort == "price_desc":
                results.sort(key=lambda p: p["price"], reverse=True)
            elif sort == "name":
                results.sort(key=lambda p: p["name"].lower())

        return results


def _handle_search(event: dict[str, Any]) -> dict[str, Any]:
    """Handle GET /api/search request."""
    params = event.get("queryStringParameters") or {}
    query = params.get("q", "").strip() or None
    category = params.get("category", "").strip() or None
    sort = params.get("sort", "name")

    if sort not in SORT_OPTIONS:
        return error_response(
            f"Invalid sort. Must be one of: {', '.join(sorted(SORT_OPTIONS))}",
            status_code=400,
            error_code="INVALID_SORT",
        )

    min_price = None
    max_price = None
    if params.get("minPrice"):
        try:
            min_price = float(params["minPrice"])
        except ValueError:
            return error_response("Invalid minPrice", status_code=400, error_code="INVALID_MIN_PRICE")
    if params.get("maxPrice"):
        try:
            max_price = float(params["maxPrice"])
        except ValueError:
            return error_response("Invalid maxPrice", status_code=400, error_code="INVALID_MAX_PRICE")

    results = _search_products(query, category, min_price, max_price, sort)
    return json_response({"products": results, "count": len(results)})


def _handle_health(event: dict[str, Any]) -> dict[str, Any]:
    """Handle health check."""
    return json_response({"status": "healthy", "service": "rum-shop-search"})


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
        if path.endswith("/search") or "/api/search" in path:
            if http_method == "GET":
                return _handle_search(event)
            return error_response("Method not allowed", status_code=405, error_code="METHOD_NOT_ALLOWED")

        return error_response("Not found", status_code=404, error_code="NOT_FOUND")
    except Exception as e:
        logger.exception("Unhandled error in search handler")
        return error_response(str(e), status_code=500, error_code="INTERNAL_ERROR")


@datadog_lambda_wrapper
def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Datadog-instrumented Lambda entry point."""
    return _handler(event, context)
