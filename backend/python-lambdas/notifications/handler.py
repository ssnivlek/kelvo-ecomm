"""Order Notification Lambda for Kelvo E-Comm.

POST /api/notifications/order-confirmation
POST /api/notifications/shipping-update
"""

from __future__ import annotations

import json
import logging
from typing import Any

from datadog_lambda.wrapper import datadog_lambda_wrapper
from ddtrace import tracer

from shared.utils import json_response, error_response

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _send_order_confirmation(body: dict[str, Any]) -> dict[str, Any]:
    """Simulate sending order confirmation email."""
    with tracer.trace("notification.prepare", service="rum-shop-notifications"):
        order_id = body.get("orderId")
        customer_email = body.get("customerEmail")
        customer_name = body.get("customerName")
        items = body.get("items", [])
        total_amount = body.get("totalAmount")

        if not all([order_id, customer_email, customer_name, total_amount is not None]):
            return error_response(
                "Missing required fields: orderId, customerEmail, customerName, items, totalAmount",
                status_code=400,
                error_code="VALIDATION_ERROR",
            )

    with tracer.trace("notification.send", service="rum-shop-notifications"):
        logger.info(
            "Order confirmation email (simulated): orderId=%s to=%s items=%s total=%s",
            order_id,
            customer_email,
            len(items),
            total_amount,
        )
        return json_response(
            {
                "success": True,
                "message": "Order confirmation sent",
                "orderId": order_id,
            }
        )


def _send_shipping_update(body: dict[str, Any]) -> dict[str, Any]:
    """Simulate sending shipping notification."""
    with tracer.trace("notification.prepare", service="rum-shop-notifications"):
        order_id = body.get("orderId")
        customer_email = body.get("customerEmail")
        tracking_number = body.get("trackingNumber")
        status = body.get("status")

        if not all([order_id, customer_email, tracking_number, status]):
            return error_response(
                "Missing required fields: orderId, customerEmail, trackingNumber, status",
                status_code=400,
                error_code="VALIDATION_ERROR",
            )

    with tracer.trace("notification.send", service="rum-shop-notifications"):
        logger.info(
            "Shipping update email (simulated): orderId=%s to=%s tracking=%s status=%s",
            order_id,
            customer_email,
            tracking_number,
            status,
        )
        return json_response(
            {
                "success": True,
                "message": "Shipping update sent",
                "orderId": order_id,
            }
        )


def _handle_health(event: dict[str, Any]) -> dict[str, Any]:
    """Handle health check."""
    return json_response({"status": "healthy", "service": "rum-shop-notifications"})


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

        if "order-confirmation" in path:
            if http_method == "POST":
                try:
                    body = json.loads(event.get("body") or "{}")
                except json.JSONDecodeError:
                    return error_response("Invalid JSON body", status_code=400, error_code="INVALID_JSON")
                return _send_order_confirmation(body)
            return error_response("Method not allowed", status_code=405, error_code="METHOD_NOT_ALLOWED")

        if "shipping-update" in path:
            if http_method == "POST":
                try:
                    body = json.loads(event.get("body") or "{}")
                except json.JSONDecodeError:
                    return error_response("Invalid JSON body", status_code=400, error_code="INVALID_JSON")
                return _send_shipping_update(body)
            return error_response("Method not allowed", status_code=405, error_code="METHOD_NOT_ALLOWED")

        return error_response("Not found", status_code=404, error_code="NOT_FOUND")
    except Exception as e:
        logger.exception("Unhandled error in notifications handler")
        return error_response(str(e), status_code=500, error_code="INTERNAL_ERROR")


@datadog_lambda_wrapper
def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Datadog-instrumented Lambda entry point."""
    return _handler(event, context)
