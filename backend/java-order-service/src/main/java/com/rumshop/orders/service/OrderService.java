package com.rumshop.orders.service;

import com.rumshop.orders.dto.CreateOrderRequest;
import com.rumshop.orders.exception.InsufficientStockException;
import com.rumshop.orders.exception.ResourceNotFoundException;
import com.rumshop.orders.model.Order;
import com.rumshop.orders.model.OrderItem;
import com.rumshop.orders.model.OrderStatus;
import com.rumshop.orders.model.Product;
import com.rumshop.orders.repository.OrderRepository;
import datadog.trace.api.Trace;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final ProductService productService;

    @Trace(operationName = "order.create", resourceName = "OrderService.createOrder", measured = true)
    @Transactional
    public Order createOrder(CreateOrderRequest request) {
        Order order = Order.builder()
                .customerEmail(request.getCustomerEmail())
                .customerName(request.getCustomerName())
                .shippingAddress(request.getShippingAddress())
                .status(OrderStatus.PENDING)
                .totalAmount(BigDecimal.ZERO)
                .build();

        BigDecimal totalAmount = BigDecimal.ZERO;

        for (CreateOrderRequest.OrderItemRequest itemRequest : request.getItems()) {
            Product product = productService.findById(itemRequest.getProductId());
            validateStock(product, itemRequest.getQuantity());

            BigDecimal unitPrice = product.getPrice();
            BigDecimal subtotal = unitPrice.multiply(BigDecimal.valueOf(itemRequest.getQuantity()));
            totalAmount = totalAmount.add(subtotal);

            OrderItem orderItem = OrderItem.builder()
                    .productId(product.getId())
                    .productName(product.getName())
                    .quantity(itemRequest.getQuantity())
                    .unitPrice(unitPrice)
                    .subtotal(subtotal)
                    .build();

            order.addItem(orderItem);

            productService.updateStock(product.getId(), product.getStockQuantity() - itemRequest.getQuantity());
        }

        order.setTotalAmount(totalAmount);
        return orderRepository.save(order);
    }

    @Trace(operationName = "order.getById", resourceName = "OrderService.getOrderById", measured = true)
    @Transactional(readOnly = true)
    public Order getOrderById(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order", id));
    }

    @Trace(operationName = "order.getByCustomer", resourceName = "OrderService.getOrdersByCustomer", measured = true)
    @Transactional(readOnly = true)
    public List<Order> getOrdersByCustomer(String email) {
        return orderRepository.findByCustomerEmail(email);
    }

    @Trace(operationName = "order.updateStatus", resourceName = "OrderService.updateOrderStatus", measured = true)
    @Transactional
    public Order updateOrderStatus(Long id, OrderStatus status) {
        Order order = getOrderById(id);
        order.setStatus(status);
        return orderRepository.save(order);
    }

    private void validateStock(Product product, int quantity) {
        if (product.getStockQuantity() < quantity) {
            throw new InsufficientStockException(
                    product.getId(),
                    quantity,
                    product.getStockQuantity()
            );
        }
    }
}
