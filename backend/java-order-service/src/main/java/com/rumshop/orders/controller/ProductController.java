package com.rumshop.orders.controller;

import com.rumshop.orders.dto.CreateProductRequest;
import com.rumshop.orders.dto.UpdateStockRequest;
import com.rumshop.orders.model.Product;
import com.rumshop.orders.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@CrossOrigin(origins = {"http://localhost:3000", "*"}, allowedHeaders = "*")
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public ResponseEntity<List<Product>> getAllProducts(
            @RequestParam(required = false) String category) {
        List<Product> products = category != null && !category.isBlank()
                ? productService.findByCategory(category)
                : productService.findAll();
        return ResponseEntity.ok(products);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> getProduct(@PathVariable Long id) {
        return ResponseEntity.ok(productService.findById(id));
    }

    @GetMapping("/search")
    public ResponseEntity<List<Product>> searchProducts(@RequestParam("q") String query) {
        return ResponseEntity.ok(productService.searchByName(query));
    }

    @PostMapping
    public ResponseEntity<Product> createProduct(@Valid @RequestBody CreateProductRequest request) {
        Product product = productService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(product);
    }

    @PutMapping("/{id}/stock")
    public ResponseEntity<Product> updateStock(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStockRequest request) {
        return ResponseEntity.ok(productService.updateStock(id, request.getStockQuantity()));
    }
}
