# Multi-stage build for Crosstown node
# Builder stage
FROM rust:1.83-bookworm AS builder

ARG BUILD_MODE=remote

WORKDIR /build

# Build Crosstown based on BUILD_MODE
RUN if [ "$BUILD_MODE" = "remote" ]; then \
        # Remote mode: Clone from repository (URL TBD - placeholder for now)
        echo "Remote build mode not yet implemented - waiting for Crosstown repository URL"; \
        echo "For now, use BUILD_MODE=local and provide source at docker/crosstown/crosstown-src/"; \
        exit 1; \
    elif [ "$BUILD_MODE" = "local" ]; then \
        # Local mode: Expect source to be copied
        echo "Local build mode - source will be copied from crosstown-src/"; \
    else \
        echo "Invalid BUILD_MODE: $BUILD_MODE (must be 'remote' or 'local')"; \
        exit 1; \
    fi

# Copy local source if in local mode
COPY --chown=root:root crosstown-src/ /build/

# Build the Crosstown binary
RUN cargo build --release --bin crosstown || \
    (echo "ERROR: Crosstown build failed. Ensure crosstown-src/ contains valid Rust crate with 'crosstown' binary target."; exit 1)

# Verify binary was created
RUN if [ ! -f /build/target/release/crosstown ]; then \
        echo "ERROR: Crosstown binary not found at /build/target/release/crosstown"; \
        echo "Build succeeded but binary is missing. Check Cargo.toml [[bin]] configuration."; \
        exit 1; \
    fi

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 crosstown && \
    mkdir -p /var/lib/crosstown /etc/crosstown && \
    chown -R crosstown:crosstown /var/lib/crosstown /etc/crosstown

# Copy binary from builder with executable permissions
COPY --from=builder --chmod=0755 /build/target/release/crosstown /usr/local/bin/crosstown

# Copy configuration with read-only permissions
COPY --chmod=0644 config.toml /etc/crosstown/config.toml

# Switch to non-root user
USER crosstown

# Set working directory
WORKDIR /var/lib/crosstown

# Expose ports
EXPOSE 4040 4041 4042

# Set environment variables
ENV CROSSTOWN_NOSTR_PORT=4040
ENV CROSSTOWN_HTTP_PORT=4041
ENV CROSSTOWN_BITCRAFT_URL=ws://bitcraft-server:3000
ENV CROSSTOWN_LOG_LEVEL=info

# Run Crosstown node
CMD ["/usr/local/bin/crosstown", "--config", "/etc/crosstown/config.toml"]
