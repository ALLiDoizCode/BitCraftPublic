use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use warp::Filter;

#[derive(Debug, Deserialize)]
struct Config {
    #[allow(dead_code)]
    relay: RelayConfig,
    #[allow(dead_code)]
    bls_proxy: BLSProxyConfig,
}

#[derive(Debug, Deserialize)]
struct RelayConfig {
    #[allow(dead_code)]
    accepted_event_kinds: String,
    #[allow(dead_code)]
    require_auth: bool,
    #[allow(dead_code)]
    max_events: usize,
    #[allow(dead_code)]
    storage_path: String,
}

#[derive(Debug, Deserialize)]
struct BLSProxyConfig {
    #[allow(dead_code)]
    bitcraft_database: String,
    identity_propagation: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct NostrEvent {
    id: String,
    pubkey: String,
    kind: u32,
    content: String,
    #[allow(dead_code)]
    created_at: u64,
    #[allow(dead_code)]
    tags: Vec<Vec<String>>,
    #[allow(dead_code)]
    sig: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ILPPacket {
    reducer: String,
    args: Vec<serde_json::Value>,
    fee: f64,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    relay_mode: String,
}

// In-memory event storage
type EventStore = Arc<RwLock<HashMap<String, NostrEvent>>>;

// Rate limiting: track events per connection
struct RateLimiter {
    events: Vec<Instant>,
    max_events: usize,
    window: Duration,
}

impl RateLimiter {
    fn new(max_events: usize, window_secs: u64) -> Self {
        Self {
            events: Vec::new(),
            max_events,
            window: Duration::from_secs(window_secs),
        }
    }

    fn check_and_record(&mut self) -> bool {
        let now = Instant::now();
        // Remove events outside the window
        self.events.retain(|&t| now.duration_since(t) < self.window);

        if self.events.len() >= self.max_events {
            return false; // Rate limit exceeded
        }

        self.events.push(now);
        true
    }
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    let log_level = env::var("CROSSTOWN_LOG_LEVEL").unwrap_or_else(|_| "info".to_string());
    tracing_subscriber::fmt()
        .with_env_filter(log_level)
        .init();

    tracing::info!("Starting Crosstown node...");

    // Load configuration
    let config_path = std::env::args()
        .skip_while(|arg| arg != "--config")
        .nth(1)
        .unwrap_or_else(|| "/etc/crosstown/config.toml".to_string());

    let config_str = match std::fs::read_to_string(&config_path) {
        Ok(content) => content,
        Err(e) => {
            if std::path::Path::new(&config_path).exists() {
                // Config file exists but can't be read - this is an error
                tracing::error!("Config file exists at {} but cannot be read: {}", config_path, e);
                std::process::exit(1);
            } else {
                // Config file doesn't exist - use defaults
                tracing::warn!("Config file not found at {}, using defaults", config_path);
                String::from(r#"
[relay]
accepted_event_kinds = "all"
require_auth = false
max_events = 10000
storage_path = "/var/lib/crosstown/events"

[bls_proxy]
bitcraft_database = "bitcraft"
identity_propagation = "stub"
            "#)
            }
        }
    };

    let config: Config = toml::from_str(&config_str)
        .unwrap_or_else(|e| {
            tracing::error!("Failed to parse configuration: {}", e);
            tracing::error!("Configuration content:\n{}", config_str);
            std::process::exit(1);
        });

    let identity_mode = config.bls_proxy.identity_propagation.clone();
    tracing::info!("BLS identity propagation mode: {}", identity_mode);

    // Create event store
    let event_store: EventStore = Arc::new(RwLock::new(HashMap::new()));
    let event_store_filter = warp::any().map(move || event_store.clone());

    // HTTP API routes with CORS and security headers
    let cors = warp::cors()
        .allow_origin("http://localhost:3000")
        .allow_methods(vec!["GET", "POST"])
        .allow_headers(vec!["Content-Type"]);

    let health = warp::path("health")
        .and(warp::get())
        .map(|| {
            let response = warp::reply::json(&HealthResponse {
                status: "healthy".to_string(),
                version: "0.1.0".to_string(),
                relay_mode: "stub".to_string(),
            });
            // Add security headers
            let response = warp::reply::with_header(response, "X-Content-Type-Options", "nosniff");
            let response = warp::reply::with_header(response, "X-Frame-Options", "DENY");
            let response = warp::reply::with_header(response, "X-XSS-Protection", "1; mode=block");
            response
        });

    let metrics = warp::path("metrics")
        .and(warp::get())
        .map(|| {
            // Placeholder metrics endpoint
            let response = warp::reply::with_status(
                "# Crosstown metrics (stub)\ncrosstown_events_total 0\n",
                warp::http::StatusCode::OK,
            );
            // Add security headers
            let response = warp::reply::with_header(response, "X-Content-Type-Options", "nosniff");
            let response = warp::reply::with_header(response, "X-Frame-Options", "DENY");
            response
        });

    let http_routes = health.or(metrics).with(cors);

    // Get ports from environment with validation
    let http_port: u16 = env::var("CROSSTOWN_HTTP_PORT")
        .unwrap_or_else(|_| "4041".to_string())
        .parse()
        .unwrap_or_else(|e| {
            tracing::error!("Invalid CROSSTOWN_HTTP_PORT: {}. Using default 4041.", e);
            4041
        });

    let nostr_port: u16 = env::var("CROSSTOWN_NOSTR_PORT")
        .unwrap_or_else(|_| "4040".to_string())
        .parse()
        .unwrap_or_else(|e| {
            tracing::error!("Invalid CROSSTOWN_NOSTR_PORT: {}. Using default 4040.", e);
            4040
        });

    // Validate port ranges (1024-65535 for unprivileged)
    if http_port < 1024 || nostr_port < 1024 {
        tracing::error!("Port numbers must be >= 1024 for unprivileged users");
        std::process::exit(1);
    }

    // Start HTTP server
    tracing::info!("HTTP API listening on port {}", http_port);
    let http_server = warp::serve(http_routes).run(([0, 0, 0, 0], http_port));

    // Start WebSocket server for Nostr relay
    tracing::info!("Nostr relay WebSocket listening on port {}", nostr_port);
    let ws_route = warp::path::end()
        .and(warp::ws())
        .and(event_store_filter)
        .and(warp::any().map(move || identity_mode.clone()))
        .map(|ws: warp::ws::Ws, store: EventStore, mode: String| {
            ws.on_upgrade(move |socket| handle_nostr_connection(socket, store, mode))
        });

    let ws_server = warp::serve(ws_route).run(([0, 0, 0, 0], nostr_port));

    // Run both servers
    tokio::select! {
        _ = http_server => {},
        _ = ws_server => {},
    }
}

async fn handle_nostr_connection(
    ws: warp::ws::WebSocket,
    event_store: EventStore,
    identity_mode: String,
) {
    use futures_util::{SinkExt, StreamExt};

    let (mut tx, mut rx) = ws.split();
    let mut rate_limiter = RateLimiter::new(100, 60); // 100 events per 60 seconds

    tracing::debug!("New Nostr relay connection");

    while let Some(result) = rx.next().await {
        match result {
            Ok(msg) => {
                if let Ok(text) = msg.to_str() {
                    if let Ok(message) = serde_json::from_str::<Vec<serde_json::Value>>(text) {
                        if let Some(msg_type) = message.get(0).and_then(|v| v.as_str()) {
                            match msg_type {
                                "EVENT" => {
                                    // Check rate limit
                                    if !rate_limiter.check_and_record() {
                                        tracing::warn!("Rate limit exceeded for connection");
                                        let error_response = serde_json::json!(["NOTICE", "Rate limit exceeded. Max 100 events per 60 seconds."]);
                                        let _ = tx.send(warp::ws::Message::text(error_response.to_string())).await;
                                        continue;
                                    }

                                    // Handle incoming event
                                    if let Some(event_json) = message.get(1) {
                                        if let Ok(event) = serde_json::from_value::<NostrEvent>(event_json.clone()) {
                                            let event_id = event.id.clone();

                                            // Check if this is a kind 30078 event (BLS game action)
                                            if event.kind == 30078 && identity_mode == "stub" {
                                                handle_bls_stub(&event);
                                            }

                                            // Store event
                                            event_store.write().await.insert(event_id.clone(), event);

                                            // Send OK response
                                            let response = serde_json::json!(["OK", event_id, true, ""]);
                                            let _ = tx.send(warp::ws::Message::text(response.to_string())).await;
                                        }
                                    }
                                }
                                "REQ" => {
                                    // Handle subscription request
                                    if let Some(sub_id) = message.get(1).and_then(|v| v.as_str()) {
                                        // For now, just send EOSE (end of stored events)
                                        let response = serde_json::json!(["EOSE", sub_id]);
                                        let _ = tx.send(warp::ws::Message::text(response.to_string())).await;
                                    }
                                }
                                "CLOSE" => {
                                    // Handle subscription close
                                    tracing::debug!("Client closed subscription");
                                }
                                _ => {
                                    tracing::debug!("Unknown message type: {}", msg_type);
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                tracing::error!("WebSocket error: {}", e);
                break;
            }
        }
    }

    tracing::debug!("Nostr relay connection closed");
}

fn handle_bls_stub(event: &NostrEvent) {
    // Sanitize pubkey (truncate to first 8 chars for logging)
    let sanitized_pubkey = if event.pubkey.len() > 8 {
        format!("{}...", &event.pubkey[..8])
    } else {
        event.pubkey.clone()
    };

    // Parse ILP packet from event content
    match serde_json::from_str::<ILPPacket>(&event.content) {
        Ok(packet) => {
            // Sanitize reducer name (alphanumeric only)
            let sanitized_reducer = packet.reducer
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_')
                .collect::<String>();

            tracing::info!(
                "[BLS STUB] Received kind 30078 from {}: reducer={}, args_count={}, fee={}",
                sanitized_pubkey,
                sanitized_reducer,
                packet.args.len(),
                packet.fee
            );
        }
        Err(e) => {
            tracing::warn!(
                "[BLS STUB] Failed to parse ILP packet from kind 30078 event: {}",
                e
            );
        }
    }
}
