// composes the express app from sse.js (live updates) and dashboard.html.js (UI).

import { createServer }   from "http";
import { createRequire }  from "module";
import { join }           from "path";
import { registerClient, broadcastState as ssebroadcast, latestState } from "./web/sse.js";
import { DASHBOARD_HTML } from "./web/dashboard.html.js";

const require = createRequire(import.meta.url);
const express = require("express");

const app = express();

// Serve user avatar PNGs (and any other static files) from ./assets/
const ASSETS_DIR = join(process.cwd(), "assets");
app.use("/assets", express.static(ASSETS_DIR));

// SSE live-update stream
app.get("/events", registerClient);

// Polling fallback — browser hits this if SSE is broken
app.get("/api/state", (_req, res) => {
  res.json({ ok: true, state: latestState });
});

// Main dashboard — inject AVATAR_FILE into a <meta> tag so the client JS can load it
app.get("/", (_req, res) => {
  const avatarFile = process.env.AVATAR_FILE || "";
  const html = avatarFile
    ? DASHBOARD_HTML.replace(
        '<meta name="viewport"',
        `<meta name="avatar-file" content="${avatarFile}">\n<meta name="viewport"`,
      )
    : DASHBOARD_HTML;
  res.send(html);
});

export { ssebroadcast as broadcastState };

export function startWebServer(port = 3000) {
  const server = createServer(app);
  server.listen(port, () => {});
  return `http://localhost:${port}`;
}
