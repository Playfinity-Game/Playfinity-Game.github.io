import http from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";
import { WebSocketServer, WebSocket } from "ws";
import { createAdminAuth } from "./troll-admin-auth.js";

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

const ADMIN_COOKIE = "__Host-playfinity-admin";
let adminAuth = null;
try { adminAuth = createAdminAuth(); }
catch (error) { console.warn(String(error?.message || "Admin auth is not configured.")); }

function adminOriginAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = request.headers.host;
    const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const protocol = forwardedProto || (request.socket.encrypted ? "https" : "http");
    return Boolean(host && parsed.host === host && parsed.protocol === protocol + ":");
  } catch { return false; }
}
function readAdminCookie(request) {
  for (const part of (request.headers.cookie || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator >= 0 && part.slice(0, separator).trim() === ADMIN_COOKIE) return part.slice(separator + 1).trim();
  }
  return "";
}
async function readAdminBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw, "utf8") > 2048) return null;
  }
  try { const body = JSON.parse(raw || "{}"); return body && typeof body === "object" && !Array.isArray(body) ? body : null; }
  catch { return null; }
}
function adminAuthenticated(request) {
  const token = readAdminCookie(request);
  return Boolean(adminAuth && adminAuth.authenticate(token));
}

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
    idleTimer: null,
    viewerCount: null,
    lastEventAt: new Date().toISOString()
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
    connection.on(eventName, (data) => {
      if (name === "roomUser" && Number.isFinite(Number(data?.viewerCount))) {
        session.viewerCount = Number(data.viewerCount);
      }
      session.lastEventAt = new Date().toISOString();
      broadcast(session, eventPayload(name, data));
    });
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


const usageStats = {
  day: new Date().toISOString().slice(0, 10),
  pageViews: 0,
  visitors: new Set(),
  totalPlayMs: 0,
  longestSessionMs: 0,
  sessions: new Map()
};

function resetUsageDayIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (usageStats.day !== today) {
    usageStats.day = today;
    usageStats.pageViews = 0;
    usageStats.visitors.clear();
  }
}

function handleUsageMetrics(request, response) {
  if (request.method === "GET") {
    const now = Date.now();
    for (const [id, session] of usageStats.sessions) {
      if (now - session.lastSeenAt > 90000) usageStats.sessions.delete(id);
    }
    const activeSessions = [...usageStats.sessions.values()].filter(session => session.active).length;
    return sendJson(response, 200, {
      day: usageStats.day,
      pageViews: usageStats.pageViews,
      uniqueVisitors: usageStats.visitors.size,
      totalPlayMinutes: Math.round(usageStats.totalPlayMs / 60000 * 10) / 10,
      averagePlayMinutesPerVisit: usageStats.pageViews ? Math.round(usageStats.totalPlayMs / usageStats.pageViews / 60000 * 10) / 10 : 0,
      activeSessions,
      longestSessionMinutes: Math.round(usageStats.longestSessionMs / 60000 * 10) / 10,
      storage: "memory_only"
    }, { "access-control-allow-origin": "*", "cache-control": "no-store" });
  }
  if (!originAllowed(request)) return sendJson(response, 403, { error: "Origin not allowed" });
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": request.headers.origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "600",
      "vary": "Origin"
    });
    return response.end();
  }
  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed" });
  let rawBody = "";
  request.on("data", chunk => {
    rawBody += chunk;
    if (rawBody.length > 2048) request.destroy();
  });
  request.on("end", () => {
    let body;
    try { body = JSON.parse(rawBody || "{}"); } catch { return sendJson(response, 400, { error: "Invalid JSON" }); }
    const { event, visitorId, sessionId, elapsedMs } = body;
    if (!["start", "heartbeat", "pause", "end"].includes(event) ||
        typeof visitorId !== "string" || visitorId.length > 100 ||
        typeof sessionId !== "string" || sessionId.length > 100) {
      return sendJson(response, 400, { error: "Invalid metrics event" });
    }
    resetUsageDayIfNeeded();
    const now = Date.now();
    const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, Math.min(45000, elapsedMs)) : 0;
    if (event === "start") {
      usageStats.pageViews += 1;
      usageStats.visitors.add(visitorId);
      usageStats.sessions.set(sessionId, { visitorId, startedAt: now, lastSeenAt: now, active: true, playMs: 0 });
    } else {
      const session = usageStats.sessions.get(sessionId);
      if (session) {
        if (event === "heartbeat" && body.visible === true) {
          session.playMs += elapsed;
          usageStats.totalPlayMs += elapsed;
          session.active = true;
        } else if (event === "pause" || event === "end") {
          session.playMs += elapsed;
          usageStats.totalPlayMs += elapsed;
          session.active = false;
          if (event === "end") usageStats.longestSessionMs = Math.max(usageStats.longestSessionMs, session.playMs);
        }
        session.lastSeenAt = now;
      }
    }
    for (const [id, session] of usageStats.sessions) {
      if (now - session.lastSeenAt > 90000) usageStats.sessions.delete(id);
    }
    return sendJson(response, 200, { ok: true }, {
      "access-control-allow-origin": request.headers.origin,
      "vary": "Origin"
    });
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");

  if (url.pathname === "/api/metrics") return handleUsageMetrics(request, response);

  if (request.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) {
    try {
      const html = await readFile(new URL("./admin.html", import.meta.url));
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" });
      return response.end(html);
    } catch { return sendJson(response, 500, { error: "Admin-Oberfläche konnte nicht geladen werden." }); }
  }

  if (url.pathname.startsWith("/admin/")) {
    if (!adminAuth) return sendJson(response, 503, { error: "Admin ist noch nicht konfiguriert. Bitte Passwort-Hash und Salt in Render setzen." });
    if (request.method === "POST" && !adminOriginAllowed(request)) return sendJson(response, 403, { error: "Origin nicht erlaubt." });
    if (request.method === "POST" && !allowRequest(request)) return sendJson(response, 429, { error: "Zu viele Admin-Anfragen." });
    if (request.method === "POST" && url.pathname === "/admin/login") {
      const body = await readAdminBody(request);
      if (!body) return sendJson(response, 400, { error: "Ungültige Anfrage." });
      const token = adminAuth.login(body.password);
      if (!token) return sendJson(response, 401, { error: "Anmeldung fehlgeschlagen." });
      return sendJson(response, 200, { ok: true }, { "set-cookie": `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800` });
    }
    if (request.method === "POST" && url.pathname === "/admin/logout") {
      const token = readAdminCookie(request); if (token) adminAuth.logout(token);
      return sendJson(response, 200, { ok: true }, { "set-cookie": `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
    }
    if (!adminAuthenticated(request)) return sendJson(response, 401, { error: "Anmeldung erforderlich." });
    if (request.method === "GET" && url.pathname === "/admin/status") return sendJson(response, 200, { authenticated: true });
    if (request.method === "GET" && url.pathname === "/admin/live-connections") {
      const connections = [...sessions.values()].filter(session => !session.stopped).map(session => ({
        username: session.username, viewerCount: session.viewerCount ?? null,
        connectedPlayers: session.clients.size, lastEventAt: session.lastEventAt ?? null
      }));
      return sendJson(response, 200, { connections });
    }
    if (request.method === "GET" && url.pathname === "/admin/metrics") {
      const now = Date.now();
      for (const [id, session] of usageStats.sessions) if (now - session.lastSeenAt > 90000) usageStats.sessions.delete(id);
      const activeSessions = [...usageStats.sessions.values()].filter(session => session.active).length;
      return sendJson(response, 200, {
        day: usageStats.day, pageViews: usageStats.pageViews, uniqueVisitors: usageStats.visitors.size,
        totalPlayMinutes: Math.round(usageStats.totalPlayMs / 60000 * 10) / 10,
        averagePlayMinutesPerVisit: usageStats.pageViews ? Math.round(usageStats.totalPlayMs / usageStats.pageViews / 60000 * 10) / 10 : 0,
        activeSessions, longestSessionMinutes: Math.round(usageStats.longestSessionMs / 60000 * 10) / 10,
        storage: "memory_only"
      });
    }
    return sendJson(response, 404, { error: "Admin-Endpunkt nicht gefunden." });
  }

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
