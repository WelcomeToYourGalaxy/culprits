# culprits-proxy

Bounding-box proxy for the sources that need credentials: Global Forest Watch,
Global Fishing Watch, and EPA. Keeps the keys server-side and supplies the CORS
headers the upstream APIs don't send.

Free tier: 100,000 requests/day.

## Deploy

    npm install -g wrangler
    wrangler login
    cd worker
    wrangler deploy
    wrangler secret put GFW_API_KEY
    wrangler secret put GFW_FISHING_TOKEN

`wrangler deploy` prints the URL. Put it in `WORKER` at the top of
`map/app.js`, and put your Pages domain in `ALLOWED_ORIGINS` in `index.js`.

## Tests

    node test.mjs

29 tests, no network. Covers bbox validation, CORS, edge caching, upstream
error passthrough, and the shapers that convert each upstream into the atlas
feature schema.

## Expect one round of corrections

The upstream URL patterns and response shapes are inferred — these APIs need
keys and were unreachable when the Worker was written. When a shape is wrong
the Worker returns a 502 naming `shape()` rather than an empty layer, so the
browser console will tell you which one to fix.
