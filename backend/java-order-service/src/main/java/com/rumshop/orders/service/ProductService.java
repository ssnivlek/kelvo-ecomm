package com.rumshop.orders.service;

import com.rumshop.orders.dto.CreateProductRequest;
import com.rumshop.orders.exception.ResourceNotFoundException;
import com.rumshop.orders.model.Product;
import com.rumshop.orders.repository.ProductRepository;
import datadog.trace.api.Trace;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    @Trace(operationName = "product.findAll", resourceName = "ProductService.findAll", measured = true)
    @Transactional(readOnly = true)
    public List<Product> findAll() {
        return productRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<Product> findByCategory(String category) {
        return productRepository.findByCategory(category);
    }

    @Transactional(readOnly = true)
    public List<Product> searchByName(String query) {
        return productRepository.findByNameContainingIgnoreCase(query);
    }

    @Trace(operationName = "product.findById", resourceName = "ProductService.findById", measured = true)
    @Transactional(readOnly = true)
    public Product findById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product", id));
    }

    @Transactional
    public Product create(CreateProductRequest request) {
        Product product = Product.builder()
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .imageUrl(request.getImageUrl())
                .category(request.getCategory())
                .stockQuantity(request.getStockQuantity() != null ? request.getStockQuantity() : 0)
                .sku(request.getSku() != null ? request.getSku() : UUID.randomUUID().toString())
                .slug(request.getSlug())
                .build();
        return productRepository.save(product);
    }

    @Trace(operationName = "product.updateStock", resourceName = "ProductService.updateStock", measured = true)
    @Transactional
    public Product updateStock(Long id, Integer stockQuantity) {
        Product product = findById(id);
        product.setStockQuantity(stockQuantity);
        return productRepository.save(product);
    }
}
