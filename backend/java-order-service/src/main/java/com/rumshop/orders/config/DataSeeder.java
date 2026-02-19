package com.rumshop.orders.config;

import com.rumshop.orders.model.Product;
import com.rumshop.orders.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final ProductRepository productRepository;

    @Override
    public void run(String... args) {
        if (productRepository.count() > 0) {
            return;
        }

        List<Product> products = List.of(
                createProduct("Wireless Noise-Cancelling Headphones",
                        "Premium over-ear headphones with active noise cancellation and 30-hour battery life",
                        new BigDecimal("299.99"), "wireless-noise-cancelling-headphones", "Electronics", 50, "ELEC-001"),
                createProduct("Ultra-Slim Laptop 15\"",
                        "Lightweight 15-inch laptop with 16GB RAM and 512GB SSD",
                        new BigDecimal("1299.99"), "ultra-slim-laptop-15", "Electronics", 25, "ELEC-002"),
                createProduct("Smart Watch Pro",
                        "Advanced fitness tracking, heart rate monitoring, and 7-day battery life",
                        new BigDecimal("399.99"), "smart-watch-pro", "Electronics", 75, "ELEC-003"),
                createProduct("4K Action Camera",
                        "Waterproof action camera with 4K video and image stabilization",
                        new BigDecimal("249.99"), "4k-action-camera", "Electronics", 40, "ELEC-004"),
                createProduct("Premium Cotton T-Shirt",
                        "100% organic cotton, comfortable fit, available in multiple colors",
                        new BigDecimal("39.99"), "premium-cotton-tshirt", "Clothing", 200, "CLTH-001"),
                createProduct("Leather Crossbody Bag",
                        "Handcrafted genuine leather bag with adjustable strap",
                        new BigDecimal("89.99"), "leather-crossbody-bag", "Clothing", 60, "CLTH-002"),
                createProduct("Running Shoes Ultra",
                        "Lightweight running shoes with responsive cushioning",
                        new BigDecimal("129.99"), "running-shoes-ultra", "Clothing", 80, "CLTH-003"),
                createProduct("Denim Jacket Classic",
                        "Timeless denim jacket with a comfortable relaxed fit",
                        new BigDecimal("79.99"), "denim-jacket-classic", "Clothing", 45, "CLTH-004"),
                createProduct("Robot Vacuum Cleaner",
                        "Smart mapping, app control, and self-emptying base",
                        new BigDecimal("449.99"), "robot-vacuum-cleaner", "Home & Kitchen", 30, "HOME-001"),
                createProduct("Stainless Steel Cookware Set",
                        "10-piece set with induction-compatible pots and pans",
                        new BigDecimal("199.99"), "stainless-steel-cookware-set", "Home & Kitchen", 35, "HOME-002"),
                createProduct("Yoga Mat Premium",
                        "Extra thick non-slip mat with carrying strap",
                        new BigDecimal("49.99"), "yoga-mat-premium", "Sports", 100, "SPRT-001"),
                createProduct("Mountain Bike Helmet",
                        "Ventilated helmet with MIPS technology for enhanced safety",
                        new BigDecimal("69.99"), "mountain-bike-helmet", "Sports", 90, "SPRT-002")
        );

        productRepository.saveAll(products);
    }

    private Product createProduct(String name, String description, BigDecimal price,
                                  String slug, String category, int stock, String sku) {
        return Product.builder()
                .name(name)
                .description(description)
                .price(price)
                .imageUrl("/images/products/" + slug + ".svg")
                .category(category)
                .stockQuantity(stock)
                .sku(sku)
                .slug(slug)
                .build();
    }
}
