// manages connected SSE browser clients and broadcasts state to all of them

const clients = new Set();
export let latestState = null; // exposed for /status endpoint

export function registerClient(req, res) {
  res.set({
    "Content-Type":                "text/event-stream",
    "Cache-Control":               "no-cache, no-transform",
    "Connection":                  "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering":           "no",
  });
  res.flushHeaders();

  // Immediate connection confirmation comment
  res.write(": connected\n\n");

  clients.add(res);

  // Always send latest state to newly connected clients
  if (latestState !== null) {
    res.write(`data: ${JSON.stringify(latestState)}\n\n`);
  }

  // Heartbeat every 15s to prevent proxy/browser timeout
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
      clients.delete(res);
    }
  }, 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

export function broadcastState(state) {
  latestState = state;
  const message = `data: ${JSON.stringify(state)}\n\n`;

  for (const res of clients) {
    try {
      res.write(message);
    } catch {
      clients.delete(res);
    }
  }
}
