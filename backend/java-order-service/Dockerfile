# Build stage
FROM eclipse-temurin:17-jdk-alpine AS builder

WORKDIR /app

# Copy Maven files
COPY pom.xml .
COPY src ./src

# Download dependencies and build (skip tests for faster build)
RUN apk add --no-cache maven && \
    mvn dependency:go-offline -B && \
    mvn clean package -DskipTests -B

# Download Datadog Java agent from Maven Central
RUN apk add --no-cache curl && \
    curl -sLo /app/dd-java-agent.jar \
    "https://repo1.maven.org/maven2/com/datadoghq/dd-java-agent/1.31.0/dd-java-agent-1.31.0.jar"

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy built artifact and Datadog agent from builder
COPY --from=builder /app/target/*.jar app.jar
COPY --from=builder /app/dd-java-agent.jar dd-java-agent.jar

# Datadog APM environment variables (can be overridden at runtime)
ENV DD_SERVICE=rum-shop-order-service
ENV DD_ENV=production
ENV DD_VERSION=1.0.0
ENV DD_LOGS_INJECTION=true
ENV DD_TRACE_SAMPLE_RATE=1.0

EXPOSE 8080

# Run with Datadog Java agent for APM instrumentation
ENTRYPOINT ["java", "-javaagent:/app/dd-java-agent.jar", "-jar", "/app/app.jar"]
