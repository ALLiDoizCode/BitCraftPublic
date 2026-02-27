FROM clockworklabs/spacetime:latest

# Note: Base image runs as spacetime user (UID 1000) by default
# Switch to root temporarily for setup
USER root

# Create directories and set permissions
RUN mkdir -p /var/lib/spacetimedb /opt/bitcraft && \
    chown -R spacetime:spacetime /var/lib/spacetimedb /opt/bitcraft

# Copy BitCraft WASM module (placeholder - replace with real module)
COPY --chmod=0644 bitcraft.wasm /opt/bitcraft/bitcraft.wasm

# Copy and set permissions for initialization script
COPY --chmod=0755 init.sh /opt/bitcraft/init.sh

# Set environment variables
ENV SPACETIMEDB_LOG_LEVEL=info
ENV SPACETIMEDB_BIND=0.0.0.0:3000

# Switch to non-root user
USER spacetime

# Set working directory
WORKDIR /opt/bitcraft

# Run initialization script
ENTRYPOINT ["/opt/bitcraft/init.sh"]
