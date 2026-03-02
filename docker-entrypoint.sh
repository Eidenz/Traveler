#!/bin/sh
set -e

# Inject environment variables into built client files at runtime
# This allows the Docker image to be generic and configured via environment variables

echo "Configuring client with environment variables..."

# Replace placeholders in ALL built JS files (Vite code-splits into multiple chunks)
JS_FILES=$(find /app/client/dist/assets -name '*.js' -type f 2>/dev/null)

if [ -n "$JS_FILES" ]; then
  if [ -n "$VITE_MAPBOX_TOKEN" ]; then
    echo "Injecting VITE_MAPBOX_TOKEN into built assets..."
    sed -i "s|MAPBOX_TOKEN_PLACEHOLDER|$VITE_MAPBOX_TOKEN|g" $JS_FILES
    echo "Token injection complete"
  else
    echo "Warning: VITE_MAPBOX_TOKEN not set. Map features will be disabled."
    sed -i "s|MAPBOX_TOKEN_PLACEHOLDER||g" $JS_FILES
  fi
else
  echo "Warning: Could not find built JS files. Skipping token injection."
fi

echo "Configuration complete. Starting application..."

# Execute the main command
exec "$@"
