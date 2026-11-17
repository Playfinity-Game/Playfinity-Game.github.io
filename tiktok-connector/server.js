import http from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";
import { WebSocketServer, WebSocket } from "ws";
import { createAdminAuth } from "./troll-admin-auth.js";
import { createTrollAdminState } from "./troll-admin-state.js";

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
const adminState = createTrollAdminState();
const ADMIN_COOKIE = "__Host-playfinity-admin";
const TROLL_ADMIN_TEST_ORIGIN = String(process.env.TROLL_ADMIN_TEST_ORIGIN || "").trim();
const ADMIN_GAME_EVENTS_ENABLED = process.env.TROLL_ADMIN_GAME_EVENTS_ENABLED === "true"
  && Boolean(TROLL_ADMIN_TEST_ORIGIN)
  && allowedOrigins.has(TROLL_ADMIN_TEST_ORIGIN)
  && TROLL_ADMIN_TEST_ORIGIN !== "https://playfinity-game.github.io";
let adminAuth = null;
try {
  adminAuth = createAdminAuth();
} catch (error) {
  console.warn(String(error?.message || "Troll Admin auth is not configured."));
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

function adminOriginAllowed(request) {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = request.headers.host;
    const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const protocol = forwardedProto || (request.socket.encrypted ? "https" : "http");
    return Boolean(host && parsed.host === host && parsed.protocol === protocol + ":");
  } catch {
    return false;
  }
}

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return "";
}

async function readJsonBody(request, maxBytes = 2048) {
  let rawBody = "";
  for await (const chunk of request) {
    rawBody += chunk;
    if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
      const error = new Error("body_too_large");
      error.statusCode = 413;
      throw error;
    }
  }
  try {
    const body = JSON.parse(rawBody || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid_object");
    return body;
  } catch {
    const error = new Error("invalid_json");
    error.statusCode = 400;
    throw error;
  }
}

function adminSession(request) {
  const token = readCookie(request, ADMIN_COOKIE);
  return adminAuth && adminAuth.authenticate(token) ? token : null;
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
      return { type, user, likeCount: data.likeCount ?? 1, totalLikeCount: data.totalLikeCount ?? null };
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

function sessionKey(origin, username) { return `${origin}::${username}`; }

function stopSession(session) {
  if (!session || session.stopped) return;
  session.stopped = true;
  clearTimeout(session.idleTimer);
  sessions.delete(session.token);
  if (sessionsByUsername.get(sessionKey(session.origin, session.username)) === session.token) {
    sessionsByUsername.delete(sessionKey(session.origin, session.username));
  }
  for (const client of session.clients) {
    if (client.readyState === WebSocket.OPEN) client.close(1000, "Session ended");
  }
  session.connection.disconnect().catch(() => {});
}

async function startSession(username, origin) {
  const key = sessionKey(origin, username);
  const existingToken = sessionsByUsername.get(key);
  const existing = existingToken && sessions.get(existingToken);
  if (existing && !existing.stopped) return existing;

  const token = randomBytes(32).toString("hex");
  const connection = new TikTokLiveConnection(username, {
    processInitialData: false,
    fetchRoomInfoOnConnect: true
  });

  const session = { token, username, origin, connection, clients: new Set(), stopped: false, idleTimer: null, viewerCount: null, lastEventAt: new Date().toISOString() };
  const eventNames = [
    ["chat", WebcastEvent.CHAT], ["gift", WebcastEvent.GIFT], ["like", WebcastEvent.LIKE],
    ["follow", WebcastEvent.FOLLOW], ["share", WebcastEvent.SHARE], ["member", WebcastEvent.MEMBER],
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
    broadcast(session, { type: "connector_error", message: String(error?.message || "TikTok-Verbindung fehlgeschlagen") });
  });

  await connection.connect();
  sessions.set(token, session);
  sessionsByUsername.set(key, token);
  return session;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");

  if (request.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) {
    try {
      const html = await readFile(new URL("./admin.html", import.meta.url));
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer"
      });
      return response.end(html);
    } catch {
      return sendJson(response, 500, { error: "Admin-Oberfläche konnte nicht geladen werden." });
    }
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, {
      ok: true,
      service: "playfinity-tiktok-connector",
      activeStreams: sessions.size
    });
  }

  if (url.pathname.startsWith("/admin/")) {
    if (!adminAuth) return sendJson(response, 503, { error: "Admin ist noch nicht konfiguriert." });
    if (request.method === "POST" && !adminOriginAllowed(request)) {
      return sendJson(response, 403, { error: "Origin nicht erlaubt." });
    }
    if (request.method === "POST" && !allowRequest(request)) {
      return sendJson(response, 429, { error: "Zu viele Admin-Anfragen." });
    }

    if (request.method === "POST" && url.pathname === "/admin/login") {
      let body;
      try { body = await readJsonBody(request, 2048); }
      catch (error) { return sendJson(response, error.statusCode || 400, { error: "Ungültige Anfrage." }); }
      const token = adminAuth.login(body.password);
      if (!token) return sendJson(response, 401, { error: "Anmeldung fehlgeschlagen." });
      return sendJson(response, 200, { ok: true }, {
        "set-cookie": `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800`
      });
    }

    if (request.method === "POST" && url.pathname === "/admin/logout") {
      const token = readCookie(request, ADMIN_COOKIE);
      if (token) adminAuth.logout(token);
      return sendJson(response, 200, { ok: true }, {
        "set-cookie": `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
      });
    }

    if (!adminSession(request)) return sendJson(response, 401, { error: "Anmeldung erforderlich." });

    if (request.method === "GET" && url.pathname === "/admin/status") {
      return sendJson(response, 200, { authenticated: true, emergencyStop: adminState.isStopped() });
    }

    if (request.method === "GET" && url.pathname === "/admin/live-connections") {
      const bridgeToken = process.env.ADMIN_DATA_BRIDGE_TOKEN;
      if (!bridgeToken) return sendJson(response, 503, { error: "Produktionsdaten sind noch nicht verbunden." });
      try {
        const upstream = await fetch("https://playfinity-game-github-io.onrender.com/internal/admin-snapshot", {
          headers: { authorization: `Bearer ${bridgeToken}` },
          signal: AbortSignal.timeout(8000),
          cache: "no-store"
        });
        if (!upstream.ok) return sendJson(response, 502, { error: "Produktions-Live-Daten sind gerade nicht erreichbar." });
        const snapshot = await upstream.json();
        return sendJson(response, 200, { connections: Array.isArray(snapshot.connections) ? snapshot.connections : [] });
      } catch {
        return sendJson(response, 502, { error: "Verbindung zum Produktionsserver fehlgeschlagen." });
      }
    }

    if (request.method === "POST" && url.pathname === "/admin/nudge") {
      let body;
      try { body = await readJsonBody(request, 256); }
      catch (error) { return sendJson(response, error.statusCode || 400, { error: "Ungültige Anfrage." }); }
      const username = normalizeUsername(body.username);
      if (!username) return sendJson(response, 400, { error: "Ungültiger Streamer-Name." });
      const targets = [...sessions.values()].filter((session) =>
        !session.stopped && session.username.toLowerCase() === username.toLowerCase()
      );
      let delivered = 0;
      for (const session of targets) {
        const message = JSON.stringify({ type: "admin_nudge", issuedAt: new Date().toISOString() });
        for (const client of session.clients) {
          if (client.readyState === WebSocket.OPEN) { client.send(message); delivered += 1; }
        }
      }
      return sendJson(response, 200, { ok: true, delivered });
    }

    if (request.method === "POST" && url.pathname === "/admin/emergency-stop") {
      const state = adminState.activateEmergencyStop();
      return sendJson(response, 200, { ok: true, ...state });
    }

    if (request.method === "POST" && url.pathname === "/admin/re-enable") {
      const state = adminState.reEnable();
      return sendJson(response, 200, { ok: true, ...state });
    }

    if (request.method === "POST" && url.pathname === "/admin/action") {
      let body;
      try { body = await readJsonBody(request, 1024); }
      catch (error) { return sendJson(response, error.statusCode || 400, { error: "Ungültige Anfrage." }); }
      const result = adminState.simulateAction(body.action);
      if (!result.ok) {
        const status = result.reason === "emergency_stop_active" ? 423 : 400;
        return sendJson(response, status, { error: result.reason });
      }
      let delivered = 0;
      if (ADMIN_GAME_EVENTS_ENABLED) {
        const message = JSON.stringify({ type: "admin_action", action: result.action, issuedAt: new Date().toISOString() });
        for (const session of sessions.values()) {
          if (session.origin !== TROLL_ADMIN_TEST_ORIGIN || session.stopped) continue;
          for (const client of session.clients) {
            if (client.readyState === WebSocket.OPEN) { client.send(message); delivered += 1; }
          }
        }
      }
      return sendJson(response, 200, { ...result, delivered, gameEventsEnabled: ADMIN_GAME_EVENTS_ENABLED });
    }

    return sendJson(response, 404, { error: "Admin-Endpunkt nicht gefunden." });
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
    let body;
    try { body = await readJsonBody(request, 2048); }
    catch (error) { return sendJson(response, error.statusCode || 400, { error: "Ungültige Anfrage." }); }
    const username = normalizeUsername(body.username);
    if (!username) return sendJson(response, 400, { error: "Bitte einen gültigen TikTok-@Namen eingeben." });
    try {
      const session = await startSession(username, request.headers.origin);
      return sendJson(response, 200, {
        ok: true, username: session.username, websocketPath: `/ws/${session.token}`, message: "TikTok LIVE verbunden."
      }, { "access-control-allow-origin": request.headers.origin, "vary": "Origin" });
    } catch (error) {
      return sendJson(response, 502, {
        error: "TikTok-LIVE konnte nicht erreicht werden. Ist der Account gerade live?",
        detail: String(error?.message || "Unbekannter Verbindungsfehler")
      }, { "access-control-allow-origin": request.headers.origin, "vary": "Origin" });
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
  if (!origin || !allowedOrigins.has(origin) || !session || session.stopped || origin !== session.origin) {
    socket.write("HTTP/1.1 403 Forbidden\\r\\n\\r\\n");
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
  websocket.send(JSON.stringify({ type: "connected", streamer: session.username, receivedAt: new Date().toISOString() }));
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
