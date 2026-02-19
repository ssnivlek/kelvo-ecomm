package com.rumshop.orders.exception;

public class InsufficientStockException extends RuntimeException {

    public InsufficientStockException(String message) {
        super(message);
    }

    public InsufficientStockException(Long productId, int requested, int available) {
        super(String.format("Insufficient stock for product %d: requested %d, available %d", productId, requested, available));
    }
}
