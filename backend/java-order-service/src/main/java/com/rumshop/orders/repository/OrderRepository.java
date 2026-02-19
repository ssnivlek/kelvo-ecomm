package com.rumshop.orders.repository;

import com.rumshop.orders.model.Order;
import com.rumshop.orders.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByCustomerEmail(String customerEmail);

    List<Order> findByStatus(OrderStatus status);
}
