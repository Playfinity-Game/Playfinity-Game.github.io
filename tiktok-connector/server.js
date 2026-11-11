import http from "node:http";
import { randomBytes } from "node:crypto";
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT || 3000);
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "https://playfinity-game.github.io")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const sessions = new Map();
const sessionsByUsername = new Map();
const requestBuckets = new Map();

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
}

function originAllowed(request) {
  const origin = request.headers.origin;
  return Boolean(origin && allowedOrigins.has(origin));
}

function normalizeUsername(value) {
  if (typeof value !== "string") return null;
  const username = value.trim().replace(/^@/, "").replace(/\/$/, "");
  if (!/^[A-Za-z0-9._]{2,24}$/.test(username)) return null;
  return username;
}

function allowRequest(request) {
  const key = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = requestBuckets.get(key) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt > 60_000) {
    bucket.startedAt = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  requestBuckets.set(key, bucket);
  return bucket.count <= 12;
}

function userSummary(user = {}) {
  return {
    username: user.uniqueId || user.displayId || user.userId || user.id || null,
    nickname: user.nickname || user.displayName || null
  };
}

function eventPayload(type, data = {}) {
  const user = userSummary(data.user);
  switch (type) {
    case "chat": {
      // Current TikTokLiveConnection payloads expose chat text as "content".
      // Keep "comment" as a compatibility fallback for older payload shapes.
      const comment = data.content ?? data.comment ?? data.data?.content ?? data.data?.comment ?? "";
      return { type, user, comment: String(comment).trim() };
    }
    case "gift":
      return {
        type,
        user,
        giftId: data.giftId ?? null,
        giftName: data.extendedGiftInfo?.name || data.giftDetails?.giftName || null,
        diamondCount: data.extendedGiftInfo?.diamond_count ?? data.diamondCount ?? null,
        repeatCount: data.repeatCount ?? 1,
        repeatEnd: data.repeatEnd ?? true
      };
    case "like":
      return {
        type,
        user,
        likeCount: data.likeCount ?? 1,
        totalLikeCount: data.totalLikeCount ?? null
      };
    case "follow":
    case "share":
    case "member":
      return { type, user };
    case "roomUser":
      return { type, viewerCount: data.viewerCount ?? null };
    default:
      return { type };
  }
}

function broadcast(session, payload) {
  const message = JSON.stringify({
    ...payload,
    streamer: session.username,
    receivedAt: new Date().toISOString()
  });
  for (const client of session.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

function stopSession(session) {
  if (!session || session.stopped) return;
  session.stopped = true;
  clearTimeout(session.idleTimer);
  sessions.delete(session.token);
  if (sessionsByUsername.get(session.username) === session.token) {
    sessionsByUsername.delete(session.username);
  }
  for (const client of session.clients) {
    if (client.readyState === WebSocket.OPEN) client.close(1000, "Session ended");
  }
  session.connection.disconnect().catch(() => {});
}

async function startSession(username) {
  const existingToken = sessionsByUsername.get(username);
  const existing = existingToken && sessions.get(existingToken);
  if (existing && !existing.stopped) return existing;

  const token = randomBytes(32).toString("hex");
  const connection = new TikTokLiveConnection(username, {
    processInitialData: false,
    fetchRoomInfoOnConnect: true
  });

  const session = {
    token,
    username,
    connection,
    clients: new Set(),
    stopped: false,
    idleTimer: null
  };

  const eventNames = [
    ["chat", WebcastEvent.CHAT],
    ["gift", WebcastEvent.GIFT],
    ["like", WebcastEvent.LIKE],
    ["follow", WebcastEvent.FOLLOW],
    ["share", WebcastEvent.SHARE],
    ["member", WebcastEvent.MEMBER],
    ["roomUser", WebcastEvent.ROOM_USER]
  ];

  for (const [name, eventName] of eventNames) {
    connection.on(eventName, (data) => broadcast(session, eventPayload(name, data)));
  }

  connection.on("error", (error) => {
    broadcast(session, {
      type: "connector_error",
      message: String(error?.message || "TikTok-Verbindung fehlgeschlagen")
    });
  });

  await connection.connect();
  sessions.set(token, session);
  sessionsByUsername.set(username, token);
  return session;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, {
      ok: true,
      service: "playfinity-tiktok-connector",
      activeStreams: sessions.size
    });
  }

  if (request.method === "OPTIONS" && url.pathname === "/api/connect") {
    if (!originAllowed(request)) return sendJson(response, 403, { error: "Origin not allowed" });
    response.writeHead(204, {
      "access-control-allow-origin": request.headers.origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "600",
      "vary": "Origin"
    });
    return response.end();
  }

  if (request.method === "POST" && url.pathname === "/api/connect") {
    if (!originAllowed(request)) return sendJson(response, 403, { error: "Diese Herkunft ist nicht freigegeben." });
    if (!allowRequest(request)) return sendJson(response, 429, { error: "Zu viele Verbindungsversuche. Bitte kurz warten." });

    let rawBody = "";
    for await (const chunk of request) {
      rawBody += chunk;
      if (rawBody.length > 2048) return sendJson(response, 413, { error: "Anfrage zu groß." });
    }

    let body;
    try {
      body = JSON.parse(rawBody || "{}");
    } catch {
      return sendJson(response, 400, { error: "Ungültige Anfrage." });
    }

    const username = normalizeUsername(body.username);
    if (!username) return sendJson(response, 400, { error: "Bitte einen gültigen TikTok-@Namen eingeben." });

    try {
      const session = await startSession(username);
      return sendJson(response, 200, {
        ok: true,
        username: session.username,
        websocketPath: `/ws/${session.token}`,
        message: "TikTok LIVE verbunden."
      }, {
        "access-control-allow-origin": request.headers.origin,
        "vary": "Origin"
      });
    } catch (error) {
      return sendJson(response, 502, {
        error: "TikTok-LIVE konnte nicht erreicht werden. Ist der Account gerade live?",
        detail: String(error?.message || "Unbekannter Verbindungsfehler")
      }, {
        "access-control-allow-origin": request.headers.origin,
        "vary": "Origin"
      });
    }
  }

  return sendJson(response, 404, { error: "Nicht gefunden." });
});

const websocketServer = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const origin = request.headers.origin;
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  const token = pathname.startsWith("/ws/") ? pathname.slice(4) : "";
  const session = sessions.get(token);

  if (!origin || !allowedOrigins.has(origin) || !session || session.stopped) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  websocketServer.handleUpgrade(request, socket, head, (websocket) => {
    websocketServer.emit("connection", websocket, request, session);
  });
});

websocketServer.on("connection", (websocket, _request, session) => {
  clearTimeout(session.idleTimer);
  session.clients.add(websocket);
  websocket.send(JSON.stringify({
    type: "connected",
    streamer: session.username,
    receivedAt: new Date().toISOString()
  }));

  websocket.on("close", () => {
    session.clients.delete(websocket);
    if (session.clients.size === 0) {
      session.idleTimer = setTimeout(() => stopSession(session), 30_000);
      session.idleTimer.unref?.();
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`PLAYFINITY TikTok Connector listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  for (const session of sessions.values()) stopSession(session);
  server.close(() => process.exit(0));
});
