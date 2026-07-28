// client/src/config/env.js
// Single source of truth for the Mapbox token. Consumers must not read
// import.meta.env.VITE_MAPBOX_TOKEN directly: "are map features enabled"
// should be decided in exactly one place, and in the Docker image the token
// value is injected into the built assets at container start (a sed over the
// bundle — which is also why this file must not compare against the literal
// placeholder string: it would be rewritten too).

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
export const hasMapbox = !!MAPBOX_TOKEN;
