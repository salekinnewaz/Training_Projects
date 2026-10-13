/**
 * Custom Swagger UI HTTP handler — Vercel-friendly replacement for
 * `swagger-ui-express`'s `serve` + `setup` pair.
 *
 * **Why this exists.** `swagger-ui-express` serves the four static
 * assets the UI needs (swagger-ui.css, swagger-ui-bundle.js,
 * swagger-ui-standalone-preset.js, swagger-ui-init.js) via
 * `express.static(absolutePath)`, which reads from the file system
 * at request time. On Vercel Functions the `node_modules` tree is
 * bundled into the deployment payload but the absolute path
 * `getAbsoluteSwaggerFsPath()` returns is not always readable at
 * runtime — the Function cold-start sees the assets as not-found,
 * `express.static` calls `next()`, and the request falls through
 * to `swaggerUi.setup()` which renders the HTML page as a
 * fallback. Result: every asset URL returns the HTML page (3113
 * bytes with the `customSiteTitle` substituted), the browser tries
 * to execute HTML as JavaScript, and the UI never mounts. The
 * `swagger-ui-init.js` asset works because `swagger-ui-express`
 * reads that file ONCE at module load and serves it from memory.
 *
 * **What this does.** At module load we read the four critical
 * assets from `node_modules/swagger-ui-dist/` into in-memory
 * buffers, pre-render the HTML page once with the OpenAPI spec
 * serialized into it, and serve everything from memory via plain
 * Express handlers. No file system access at request time, no
 * `express.static`, no `swagger-ui-express` machinery.
 *
 * The handler is split into three pieces:
 *   - `swaggerUIPageHandler` — serves the HTML page (GET /)
 *   - `swaggerUIAssetHandler` — serves the 4 assets (GET /<name>)
 *   - `mountSwaggerUI(router, getSpec)` — wires both into an
 *     Express router and replaces the `swaggerUi.serve/setup`
 *     pair that previously lived in `server.ts`.
 *
 * Trade-offs vs the upstream library:
 *   - Loses `swagger-ui-express`'s `customJs` / `customCss` /
 *     `swaggerOptions` injection — we don't use any of them.
 *   - Loses the "index.html" redirect that turns `/api/docs` into
 *     `/api/docs/`. `server.ts` now mounts the router at both
 *     paths to preserve the URL.
 *   - Hardcodes the four asset filenames. The current
 *     `swagger-ui-dist` release ships exactly these four; if a
 *     future release renames one, this file must be updated.
 *   - Still uses `swagger-ui-express`'s HTML template verbatim
 *     (copied locally) so the visual layout matches the upstream
 *     package exactly. Any change to the template belongs here.
 *
 * The asset list, mime types, and `customSiteTitle` are the only
 * knobs — everything else is taken from the OpenAPI spec.
 */

import express, { Request, Response, Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
// Typed via the ambient declaration in
// `backend/src/types/swagger-ui-dist.d.ts`.
import getAbsoluteSwaggerFsPath from 'swagger-ui-dist/absolute-path';

/**
 * The four assets Swagger UI loads. Order doesn't matter; we look
 * them up by filename in `ASSETS_BY_NAME`. Mime types must match
 * what the browser expects or modern browsers will refuse to
 * execute the script / apply the stylesheet.
 */
interface StaticAsset {
  filename: string;
  contentType: string;
  body: Buffer;
}

/**
 * The HTML template — copied verbatim from `swagger-ui-express`
 * (MIT, upstream copyright SmartBear Software) with two
 * substitutions so the result is a complete, self-contained page
 * (no relative asset paths, no <% %> placeholders):
 *
 *   - `<title><% title %></title>` → `<title>HelpDesk Lite API</title>`
 *   - `<% customCss %>` block       → empty (we don't customize CSS)
 *   - `<script src="./swagger-ui-init.js">` → `<script src="/api/docs/swagger-ui-init.js">`
 *   - `<script src="./swagger-ui-bundle.js">` → absolute path
 *   - `<script src="./swagger-ui-standalone-preset.js">` → absolute path
 *   - `<link rel="stylesheet" type="text/css" href="./swagger-ui.css">` → absolute path
 *   - `<link rel="icon" ...>` favicon links removed (we don't ship them)
 *
 * The remaining <% %> placeholders for `customJs` / `customJsStr`
 * / `customCssUrl` are pre-substituted with empty strings by the
 * `renderPage` function below.
 *
 * Why a string constant and not a file read: the template is
 * small (~80 lines) and never changes between deploys. Inlining
 * it means one fewer file the deployment payload must contain,
 * and one fewer failure mode if `swagger-ui-express`'s file
 * resolution breaks in another environment.
 */
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HelpDesk Lite API</title>
  <link rel="stylesheet" type="text/css" href="/api/docs/swagger-ui.css">
  <style>
    html
    {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *,
    *:before,
    *:after
    {
      box-sizing: inherit;
    }

    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>

<body>

<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="position:absolute;width:0;height:0">
  <defs>
    <symbol viewBox="0 0 20 20" id="unlocked">
      <path d="M15.8 8H14V5.6C14 2.703 12.665 1 10 1 7.334 1 6 2.703 6 5.6V6h2v-.801C8 3.754 8.797 3 10 3c1.203 0 2 .754 2 2.199V8H4c-.553 0-1 .646-1 1.199V17c0 .549.428 1.139.951 1.307l1.197.387C5.672 18.861 6.55 19 7.1 19h5.8c.549 0 1.428-.139 1.951-.307l1.196-.387c.524-.167.953-.757.953-1.306V9.199C17 8.646 16.352 8 15.8 8z"></path>
    </symbol>

    <symbol viewBox="0 0 20 20" id="locked">
      <path d="M15.8 8H14V5.6C14 2.703 12.665 1 10 1 7.334 1 6 2.703 6 5.6V8H4c-.553 0-1 .646-1 1.199V17c0 .549.428 1.139.951 1.307l1.197.387C5.672 18.861 6.55 19 7.1 19h5.8c.549 0 1.428-.139 1.951-.307l1.196-.387c.524-.167.953-.757.953-1.306V9.199C17 8.646 16.352 8 15.8 8zM12 8H8V5.199C8 3.754 8.797 3 10 3c1.203 0 2 .754 2 2.199V8z"/>
    </symbol>

    <symbol viewBox="0 0 20 20" id="close">
      <path d="M14.348 14.849c-.469.469-1.229.469-1.697 0L10 11.819l-2.651 3.029c-.469.469-1.229.469-1.697 0-.469-.469-.469-1.229 0-1.697l2.758-3.15-2.759-3.152c-.469-.469-.469-1.228 0-1.697.469-.469 1.228-.469 1.697 0L10 8.183l2.651-3.031c.268-.27.701-.27.969 0l7.83 7.908c.268.271.268.709 0 .979l-7.83 7.908c-.268.271-.701.27-.969 0-.268-.269-.268-.707 0-.979L13.25 10z"/>
    </symbol>

    <symbol viewBox="0 0 20 20" id="large-arrow">
      <path d="M13.25 10L6.109 2.58c-.268-.27-.268-.707 0-.979.268-.27.701-.27.969 0l7.83 7.908c.268.271.268.709 0 .979l-7.83 7.908c-.268.271-.701.27-.969 0-.268-.269-.268-.707 0-.979L13.25 10z"/>
    </symbol>

    <symbol viewBox="0 0 20 20" id="large-arrow-down">
      <path d="M17.418 6.109c.272-.268.709-.268.979 0s.271.701 0 .969l-7.908 7.83c-.27.268-.707.268-.979 0L2.502 7.908c-.27-.268-.27-.701 0-.969.271-.268.709-.268.979 0L10 13.25l7.418-7.141z"/>
    </symbol>


    <symbol viewBox="0 0 24 24" id="jump-to">
      <path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/>
    </symbol>

    <symbol viewBox="0 0 24 24" id="expand">
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
    </symbol>

  </defs>
</svg>

<div id="swagger-ui"></div>

<script src="/api/docs/swagger-ui-bundle.js"> </script>
<script src="/api/docs/swagger-ui-standalone-preset.js"> </script>
<script src="/api/docs/swagger-ui-init.js"> </script>
</body>

</html>
`;

/**
 * The init.js template — copied from `swagger-ui-express` with
 * one substitution: the OpenAPI spec object is inlined as a JS
 * literal so the browser never has to fetch it. The upstream
 * library fetches the spec from a URL by default; embedding it
 * removes a network round-trip AND eliminates a class of CORS
 * issues that would otherwise surface when the API and the page
 * are on different origins.
 *
 * `__SPEC__` is a sentinel; the `renderPage` function replaces it
 * with a JSON.stringify of the spec before sending the response.
 */
const INIT_JS_TEMPLATE = `
window.onload = function() {
  // Build a system
  const ui = SwaggerUIBundle({
    url: "/api/docs.json",
    dom_id: "#swagger-ui",
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout",
    spec: __SPEC__
  });
  window.ui = ui;
}
`;

/**
 * Load the four critical assets from `swagger-ui-dist` into
 * memory at module load. Vercel Functions run on a read-only
 * file system at request time, so reading once at boot is the
 * only safe pattern. If a future deployment to a non-bundling
 * host wants to re-enable live reads, this is the function to
 * swap — nothing downstream changes.
 */
function loadAssets(): Map<string, StaticAsset> {
  const baseDir = getAbsoluteSwaggerFsPath();
  const assets: StaticAsset[] = [
    {
      filename: 'swagger-ui.css',
      contentType: 'text/css',
      body: fs.readFileSync(path.join(baseDir, 'swagger-ui.css')),
    },
    {
      filename: 'swagger-ui-bundle.js',
      contentType: 'application/javascript',
      body: fs.readFileSync(path.join(baseDir, 'swagger-ui-bundle.js')),
    },
    {
      filename: 'swagger-ui-standalone-preset.js',
      contentType: 'application/javascript',
      body: fs.readFileSync(
        path.join(baseDir, 'swagger-ui-standalone-preset.js'),
      ),
    },
    // `swagger-ui-init.js` is generated from INIT_JS_TEMPLATE
    // (with the spec inlined) and stored as a special entry.
  ];

  const map = new Map<string, StaticAsset>();
  for (const asset of assets) {
    map.set(asset.filename, asset);
  }
  return map;
}

/**
 * Render the init.js payload with the OpenAPI spec inlined. The
 * spec is serialized with `JSON.stringify` and dropped into the
 * `__SPEC__` placeholder. The browser receives a self-contained
 * script that boots Swagger UI without any further fetches.
 *
 * `JSON.stringify(undefined)` is `undefined`, which would produce
 * the literal `undefined` in the source. We guard against that
 * by always passing a non-null object.
 */
function renderInitJs(spec: object): Buffer {
  const safeSpec = spec ?? {};
  const rendered = INIT_JS_TEMPLATE.replace('__SPEC__', JSON.stringify(safeSpec));
  return Buffer.from(rendered, 'utf8');
}

/**
 * `GET /` — serve the pre-rendered HTML page. The spec is NOT
 * inlined here; the init.js asset fetches it from `/api/docs.json`
 * so the page itself stays small and the spec is served with the
 * correct content-type for OpenAPI tools (curl, Postman, codegen).
 *
 * If we ever want to inline the spec into the HTML too, it's a
 * one-liner: `res.send(HTML_TEMPLATE.replace('__SPEC__', …))`. We
 * don't do that today because the split lets the spec endpoint
 * be hit directly by tooling without going through the UI shell.
 */
function swaggerUIPageHandler(_req: Request, res: Response): void {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(HTML_TEMPLATE);
}

/**
 * `GET /<assetName>` — serve one of the 4 pre-loaded assets. The
 * `init.js` asset is generated on demand from the current spec
 * (the spec can change at runtime if any controller's JSDoc
 * changes; the page is rebuilt per request to keep it in sync).
 *
 * The 404 path is important: if a browser asks for an unknown
 * asset (e.g. the favicon), we must NOT fall through to the
 * Express catch-all which would return the SPA's `index.html`
 * and confuse the browser into thinking Swagger UI's favicon is
 * a 2 KB Angular chunk.
 */
function swaggerUIAssetHandler(
  assets: Map<string, StaticAsset>,
  getSpec: () => object,
) {
  return (req: Request, res: Response): void => {
    const name = req.params['assetName'];

    if (name === 'swagger-ui-init.js') {
      res.set('Content-Type', 'application/javascript; charset=utf-8');
      res.send(renderInitJs(getSpec()));
      return;
    }

    const asset = assets.get(name);
    if (!asset) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    res.set('Content-Type', asset.contentType);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(asset.body);
  };
}

/**
 * Mount the Swagger UI router. Call this in place of
 * `app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(...))`.
 *
 * The router handles:
 *   - GET /              → HTML page
 *   - GET /<assetName>   → one of the 4 preloaded assets
 *
 * Two routes for the page (`/` and the bare prefix) so that
 * `https://host/api/docs` and `https://host/api/docs/` both
 * resolve to the same handler — `swagger-ui-express` does the
 * same with a 301 redirect, and downstream tooling (Swagger UI
 * self-fetch, OpenAPI codegen) expects both forms to work.
 */
export function mountSwaggerUI(
  app: express.Application,
  basePath: string,
  getSpec: () => object,
): void {
  const assets = loadAssets();

  const router = Router();
  router.get('/', swaggerUIPageHandler);
  router.get('/:assetName', swaggerUIAssetHandler(assets, getSpec));

  app.use(basePath, router);
  // Also mount under the bare prefix so the no-trailing-slash
  // URL serves the same page directly (no redirect).
  app.use(basePath.replace(/\/$/, ''), router);
}
