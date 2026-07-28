#!/bin/sh
set -e

# The entrypoint starts as root so it can fix ownership of bind-mounted data
# directories (created root-owned by Docker on first run, and 777/root-owned
# on deployments that predate the non-root image), then drops to the
# unprivileged node user before starting the app.
echo "Ensuring data directories are owned by the runtime user..."
chown -R node:node /app/server/uploads /app/server/db/data

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

echo "Configuration complete. Starting application as node..."

# Drop root privileges and execute the main command
exec setpriv --reuid node --regid node --init-groups "$@"
