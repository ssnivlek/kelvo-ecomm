package com.rumshop.orders.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateOrderRequest {

    @NotBlank(message = "Customer email is required")
    @Email(message = "Invalid email format")
    private String customerEmail;

    @NotBlank(message = "Customer name is required")
    private String customerName;

    private String shippingAddress;

    @NotEmpty(message = "Order must have at least one item")
    @Valid
    private List<OrderItemRequest> items;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderItemRequest {
        @jakarta.validation.constraints.NotNull(message = "Product ID is required")
        private Long productId;

        @jakarta.validation.constraints.NotNull(message = "Quantity is required")
        @jakarta.validation.constraints.Min(value = 1, message = "Quantity must be at least 1")
        private Integer quantity;
    }
}
