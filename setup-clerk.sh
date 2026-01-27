#!/bin/bash
# Clerk env setup (keyless / .env.local). If you use server/.env and next.config loading, skip this.
# Add CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to server/.env instead.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/client" 2>/dev/null || echo "$SCRIPT_DIR")"
ENV_FILE="$CLIENT_DIR/.env.local"
KEYLESS_FILE="$CLIENT_DIR/.clerk/.tmp/keyless.json"

if [ -f "$KEYLESS_FILE" ]; then
  echo "Found Clerk keyless configuration..."
  PUBLISHABLE_KEY=$(grep -o '"publishableKey":"[^"]*"' "$KEYLESS_FILE" | sed 's/"publishableKey":"\([^"]*\)"/\1/')
  SECRET_KEY=$(grep -o '"secretKey":"[^"]*"' "$KEYLESS_FILE" | sed 's/"secretKey":"\([^"]*\)"/\1/')
  echo "Setting up $ENV_FILE..."
  cat > "$ENV_FILE" << EOF
# Clerk (from keyless)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$PUBLISHABLE_KEY
CLERK_SECRET_KEY=$SECRET_KEY
EOF
  echo "✅ Clerk env written to .env.local"
else
  echo "❌ Keyless not found at $KEYLESS_FILE"
  echo "Use server/.env with CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (loaded by client/next.config.ts)"
  exit 1
fi
