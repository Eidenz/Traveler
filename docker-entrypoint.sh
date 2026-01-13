#!/bin/sh
set -e

# Inject environment variables into built client files at runtime
# This allows the Docker image to be generic and configured via environment variables

echo "Configuring client with environment variables..."

# Find the main built JS file (usually in assets folder)
MAIN_JS=$(find /app/client/dist/assets -name 'index-*.js' -type f 2>/dev/null | head -n 1)

if [ -n "$MAIN_JS" ]; then
  echo "Found main JS file: $MAIN_JS"
  
  # Replace placeholder with actual Mapbox token if provided
  if [ -n "$VITE_MAPBOX_TOKEN" ]; then
    echo "Injecting VITE_MAPBOX_TOKEN..."
    sed -i "s|MAPBOX_TOKEN_PLACEHOLDER|$VITE_MAPBOX_TOKEN|g" "$MAIN_JS"
    echo "Token injection complete"
  else
    echo "Warning: VITE_MAPBOX_TOKEN not set. Map features will be disabled."
    # Replace with empty string to avoid errors
    sed -i "s|MAPBOX_TOKEN_PLACEHOLDER||g" "$MAIN_JS"
  fi
else
  echo "Warning: Could not find built JS file. Skipping token injection."
fi

echo "Configuration complete. Starting application..."

# Execute the main command
exec "$@"
