#!/bin/bash

# Setup Clerk environment variables
CLIENT_DIR="/Users/apple/Documents/pdf-rag-code/client"
ENV_FILE="$CLIENT_DIR/.env.local"

# Read keys from keyless.json
KEYLESS_FILE="$CLIENT_DIR/.clerk/.tmp/keyless.json"

if [ -f "$KEYLESS_FILE" ]; then
  echo "Found Clerk keyless configuration..."
  
  # Extract keys using grep and sed (more portable than jq)
  PUBLISHABLE_KEY=$(grep -o '"publishableKey":"[^"]*"' "$KEYLESS_FILE" | sed 's/"publishableKey":"\([^"]*\)"/\1/')
  SECRET_KEY=$(grep -o '"secretKey":"[^"]*"' "$KEYLESS_FILE" | sed 's/"secretKey":"\([^"]*\)"/\1/')
  
  # Create or update .env.local
  echo "Setting up $ENV_FILE..."
  cat > "$ENV_FILE" << EOF
# Clerk Authentication Keys (from keyless mode)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$PUBLISHABLE_KEY
CLERK_SECRET_KEY=$SECRET_KEY
EOF
  
  echo "✅ Clerk environment variables configured!"
  echo "✅ You can now restart your Next.js dev server"
else
  echo "❌ Keyless configuration not found at $KEYLESS_FILE"
  echo "Please get your Clerk keys from: https://dashboard.clerk.com/"
  exit 1
fi
