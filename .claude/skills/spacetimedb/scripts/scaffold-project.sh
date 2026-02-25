#!/usr/bin/env bash
# Scaffold a full-stack SpacetimeDB project with server module and client
#
# Usage:
#   scaffold-project.sh <project-name> <server-lang> [client-lang]
#
# Arguments:
#   project-name    Name of the project (used as directory name and database name)
#   server-lang     Server module language: rust, csharp, or typescript
#   client-lang     Client SDK language: typescript, csharp, or rust (default: typescript)
#
# Examples:
#   scaffold-project.sh my-app rust typescript
#   scaffold-project.sh my-game csharp csharp

set -euo pipefail

PROJECT_NAME="${1:?Usage: scaffold-project.sh <project-name> <server-lang> [client-lang]}"
SERVER_LANG="${2:?Usage: scaffold-project.sh <project-name> <server-lang> [client-lang]}"
CLIENT_LANG="${3:-typescript}"

if [[ ! "$SERVER_LANG" =~ ^(rust|csharp|typescript)$ ]]; then
    echo "Error: server-lang must be rust, csharp, or typescript"
    exit 1
fi

if [[ ! "$CLIENT_LANG" =~ ^(typescript|csharp|rust)$ ]]; then
    echo "Error: client-lang must be typescript, csharp, or rust"
    exit 1
fi

echo "Creating SpacetimeDB project: $PROJECT_NAME"
echo "  Server: $SERVER_LANG"
echo "  Client: $CLIENT_LANG"
echo ""

# Create project directory
mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

# Initialize server module
echo "Initializing server module..."
spacetime init --lang "$SERVER_LANG" --project-path server "$PROJECT_NAME"

# Create client directory structure based on language
echo "Setting up client..."
case "$CLIENT_LANG" in
    typescript)
        mkdir -p client/src/module_bindings
        cd client
        npm init -y > /dev/null 2>&1
        npm install @clockworklabs/spacetimedb-sdk > /dev/null 2>&1
        cd ..
        echo "  TypeScript client initialized. Generate bindings with:"
        echo "  spacetime generate --lang typescript --out-dir client/src/module_bindings --project-path server"
        ;;
    csharp)
        mkdir -p client/module_bindings
        cd client
        dotnet new console > /dev/null 2>&1
        dotnet add package SpacetimeDB.ClientSDK > /dev/null 2>&1
        cd ..
        echo "  C# client initialized. Generate bindings with:"
        echo "  spacetime generate --lang csharp --out-dir client/module_bindings --project-path server"
        ;;
    rust)
        mkdir -p client/src/module_bindings
        cd client
        cargo init > /dev/null 2>&1
        # Add spacetimedb-sdk dependency
        if command -v cargo-add &> /dev/null || cargo add --help &> /dev/null 2>&1; then
            cargo add spacetimedb-sdk > /dev/null 2>&1
        else
            echo 'spacetimedb-sdk = "1.0"' >> Cargo.toml
        fi
        cd ..
        echo "  Rust client initialized. Generate bindings with:"
        echo "  spacetime generate --lang rust --out-dir client/src/module_bindings --project-path server"
        ;;
esac

echo ""
echo "Project '$PROJECT_NAME' created successfully!"
echo ""
echo "Next steps:"
echo "  1. cd $PROJECT_NAME"
echo "  2. Edit server module code"
echo "  3. spacetime start                    # Start local server"
echo "  4. spacetime publish $PROJECT_NAME    # Publish module"
echo "  5. Generate client bindings (see command above)"
echo "  6. Build and run client"
