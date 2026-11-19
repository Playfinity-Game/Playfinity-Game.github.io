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

const activePlayers = new Map();
const PLAYER_GAMES = new Set(["menu","wordle","wordfinity","sizeitup","hangmann","priceisright"]);
const PLAYER_TROLL_ACTIONS = new Set(["shake","confetti","glitch","fog","invert","pixel","spin","ice","static","googly","frog","skeleton","ghost","rocket"]);
const STREAMER_TROLL_ACTIONS = new Set(["shake","confetti","glitch","fog","invert","pixel","spin","ice","static","googly"]);
function playerSnapshot() {
  const now = Date.now();
  for (const [id, player] of activePlayers) {
    if (player.socket.readyState !== WebSocket.OPEN || now - player.lastSeenAt > 10 * 60_000) activePlayers.delete(id);
    else if (now - player.lastSeenAt > 60_000) player.active = false;
  }
  return [...activePlayers.values()].filter(p => p.active && p.game !== 'menu').map(p => ({
    playerId:p.id, name:p.name, streamerUsername:p.streamerUsername || null, game:p.game, connectedAt:p.connectedAt, lastSeenAt:p.lastSeenAt, solution:p.solution || ''
  }));
}

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
  let delivered = 0;
  for (const client of session.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      delivered += 1;
    }
  }
  return delivered;
}

function attachTikTokListeners(session, connection) {
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
      const eventAt = new Date().toISOString();
      session.lastEventAt = eventAt;
      session.lastEventType = name;
      session.eventCounts[name] = (session.eventCounts[name] || 0) + 1;
      if (name === "chat") {
        session.chatEventsReceived += 1;
        session.lastChatAt = eventAt;
      }
      const delivered = broadcast(session, eventPayload(name, data));
      if (name === "chat" && delivered > 0) {
        session.chatEventsForwarded += 1;
        session.chatClientDeliveries += delivered;
        session.lastChatForwardedAt = eventAt;
      }
    });
  }

  connection.on("error", (error) => {
    session.lastConnectorError = String(error?.message || "TikTok-Verbindung fehlgeschlagen").slice(0, 300);
    session.lastConnectorErrorAt = new Date().toISOString();
    broadcast(session, {
      type: "connector_error",
      message: session.lastConnectorError
    });
  });
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
    lastEventAt: null,
    lastEventType: null,
    eventCounts: {},
    chatEventsReceived: 0,
    chatEventsForwarded: 0,
    chatClientDeliveries: 0,
    lastChatAt: null,
    lastChatForwardedAt: null,
    lastConnectorError: null,
    lastConnectorErrorAt: null
  };

  attachTikTokListeners(session, connection);

  await connection.connect();
  sessions.set(token, session);
  sessionsByUsername.set(username, token);
  return session;
}


const usageStats = {
  day: new Date().toISOString().slice(0, 10),
  pageViews: 0, visitors: new Set(), totalPlayMs: 0, longestSessionMs: 0,
  sessions: new Map(), daily: new Map()
};
function getDailyUsage(day = new Date().toISOString().slice(0, 10)) {
  if (!usageStats.daily.has(day)) usageStats.daily.set(day, { pageViews: 0, visitors: new Set(), playMs: 0, longestSessionMs: 0 });
  return usageStats.daily.get(day);
}
function resetUsageDayIfNeeded() {
  usageStats.day = new Date().toISOString().slice(0, 10);
  getDailyUsage(usageStats.day);
}

function handleUsageMetrics(request, response) {
  if (request.method === "GET") {
    const now = Date.now();
    for (const [id, session] of usageStats.sessions) {
      if (now - session.lastSeenAt > 90000) usageStats.sessions.delete(id);
    }
    const active = [...usageStats.sessions.values()].filter(session => session.active);
    const livePlayMs = active.reduce((sum, session) => sum + Math.max(0, Math.min(45000, now - session.lastSeenAt)), 0);
    const liveLongestMs = active.reduce((longest, session) =>
      Math.max(longest, session.playMs + Math.max(0, Math.min(45000, now - session.lastSeenAt))), usageStats.longestSessionMs);
    const today = getDailyUsage();
    const todayLivePlayMs = active.reduce((sum, session) => sum + Math.max(0, Math.min(45000, now - session.lastSeenAt)), 0);
    const todayLiveLongestMs = active.reduce((longest, session) => Math.max(longest, session.playMs + Math.max(0, Math.min(45000, now - session.lastSeenAt))), today.longestSessionMs);
    const totalPlayMs = usageStats.totalPlayMs + livePlayMs;
    const todayPlayMs = today.playMs + todayLivePlayMs;
    return sendJson(response, 200, {
      day: usageStats.day, pageViews: usageStats.pageViews, uniqueVisitors: usageStats.visitors.size,
      totalPlayMinutes: Math.round(totalPlayMs / 60000 * 10) / 10,
      averagePlayMinutesPerVisit: usageStats.pageViews ? Math.round(totalPlayMs / usageStats.pageViews / 60000 * 10) / 10 : 0,
      activeSessions: active.length, longestSessionMinutes: Math.round(liveLongestMs / 60000 * 10) / 10,
      todayPageViews: today.pageViews, todayUniqueVisitors: today.visitors.size,
      todayPlayMinutes: Math.round(todayPlayMs / 60000 * 10) / 10,
      todayAveragePlayMinutesPerVisit: today.pageViews ? Math.round(todayPlayMs / today.pageViews / 60000 * 10) / 10 : 0,
      todayLongestSessionMinutes: Math.round(todayLiveLongestMs / 60000 * 10) / 10,
      storage: "memory_only", period: "since_server_start"
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
    const daily = getDailyUsage();
    if (event === "start") {
      usageStats.pageViews += 1;
      usageStats.visitors.add(visitorId);
      daily.pageViews += 1;
      daily.visitors.add(visitorId);
      usageStats.sessions.set(sessionId, { visitorId, startedAt: now, lastSeenAt: now, active: true, playMs: 0 });
    } else {
      const session = usageStats.sessions.get(sessionId);
      if (session) {
        if (event === "heartbeat" && body.visible === true) {
          session.playMs += elapsed;
          usageStats.totalPlayMs += elapsed;
          daily.playMs += elapsed;
          session.active = true;
        } else if (event === "pause" || event === "end") {
          session.playMs += elapsed;
          usageStats.totalPlayMs += elapsed;
          daily.playMs += elapsed;
          session.active = false;
          usageStats.longestSessionMs = Math.max(usageStats.longestSessionMs, session.playMs);
          daily.longestSessionMs = Math.max(daily.longestSessionMs, session.playMs);
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

  if (url.pathname === "/internal/admin-snapshot" && request.method === "GET") {
    const expected = process.env.ADMIN_DATA_BRIDGE_TOKEN;
    if (!expected || request.headers.authorization !== `Bearer ${expected}`) return sendJson(response, 401, { error: "Nicht autorisiert." });
    const connections = [...sessions.values()].filter(session => !session.stopped).map(session => ({
      username: session.username,
      viewerCount: session.viewerCount ?? null,
      connectedPlayers: session.clients.size,
      lastEventAt: session.lastEventAt ?? null,
      lastEventType: session.lastEventType ?? null,
      eventCounts: session.eventCounts ?? {},
      chatEventsReceived: session.chatEventsReceived ?? 0,
      chatEventsForwarded: session.chatEventsForwarded ?? 0,
      chatClientDeliveries: session.chatClientDeliveries ?? 0,
      lastChatAt: session.lastChatAt ?? null,
      lastChatForwardedAt: session.lastChatForwardedAt ?? null,
      lastConnectorError: session.lastConnectorError ?? null,
      lastConnectorErrorAt: session.lastConnectorErrorAt ?? null
    }));
    return sendJson(response, 200, { connections, players: playerSnapshot() });
  }

  if (url.pathname === "/internal/admin-troll" && request.method === "POST") {
    const expected = process.env.ADMIN_DATA_BRIDGE_TOKEN;
    if (!expected || request.headers.authorization !== `Bearer ${expected}`) return sendJson(response, 401, { error: "Nicht autorisiert." });
    let raw = "";
    for await (const chunk of request) { raw += chunk; if (Buffer.byteLength(raw,"utf8") > 1024) return sendJson(response,413,{error:"Anfrage zu groß."}); }
    let body; try { body = JSON.parse(raw || "{}"); } catch { return sendJson(response,400,{error:"Ungültige Anfrage."}); }
    const player = activePlayers.get(String(body.playerId || ""));
    if (!player || player.socket.readyState !== WebSocket.OPEN || !player.active) return sendJson(response,404,{error:"Spieler ist nicht mehr verbunden."});
    if (!PLAYER_TROLL_ACTIONS.has(body.action)) return sendJson(response,400,{error:"Unbekannte Troll-Aktion."});
    player.socket.send(JSON.stringify({type:"admin_troll",action:body.action}));
    return sendJson(response,200,{ok:true,playerId:player.id,action:body.action});
  }


  if (request.method === "GET" && (url.pathname === "/admin" || url.pathname === "/admin/")) {
    try {
      const html = await readFile(new URL("./admin.html", import.meta.url));
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" });
      return response.end(html);
    } catch { return sendJson(response, 500, { error: "Admin-Oberfläche konnte nicht geladen werden." }); }
  }

  if (request.method === "GET" && url.pathname === "/internal/admin-snapshot") {
    const expected = process.env.ADMIN_DATA_BRIDGE_TOKEN;
    if (!expected || request.headers.authorization !== `Bearer ${expected}`) {
      return sendJson(response, 401, { error: "Nicht autorisiert." });
    }
    const connections = [...sessions.values()].filter(session => !session.stopped).map(session => ({
      username: session.username,
      viewerCount: session.viewerCount ?? null,
      connectedPlayers: session.clients.size,
      lastEventAt: session.lastEventAt ?? null
    }));
    return sendJson(response, 200, { connections });
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
        connectedPlayers: session.clients.size,
        lastEventAt: session.lastEventAt,
        lastEventType: session.lastEventType,
        eventCounts: session.eventCounts,
        chatEventsReceived: session.chatEventsReceived,
        chatEventsForwarded: session.chatEventsForwarded,
        chatClientDeliveries: session.chatClientDeliveries,
        lastChatAt: session.lastChatAt,
        lastChatForwardedAt: session.lastChatForwardedAt,
        lastConnectorError: session.lastConnectorError,
        lastConnectorErrorAt: session.lastConnectorErrorAt,
        players: [...activePlayers.values()]
          .filter(player => player.active && player.socket.readyState === WebSocket.OPEN &&
            player.streamerUsername && player.streamerUsername.toLowerCase() === session.username.toLowerCase())
          .map(player => ({ name: player.name, game: player.game })),
        lastEventAt: session.lastEventAt ?? null
      }));
      const solutions = [...activePlayers.values()]
        .filter(player => player.active && player.socket.readyState === WebSocket.OPEN && player.streamerUsername && player.solution)
        .map(player => ({ streamerUsername: player.streamerUsername, game: player.game, solution: player.solution, updatedAt: player.lastSeenAt }));
      return sendJson(response, 200, { connections, solutions });
    }

    if (request.method === "POST" && url.pathname === "/admin/streamer-action") {
      const body = await readAdminBody(request);
      if (!body) return sendJson(response, 400, { error: "Ungültige Anfrage." });
      const username = typeof body.username === "string" ? body.username.trim().replace(/^@/, "") : "";
      const action = typeof body.action === "string" ? body.action : "";
      if (!/^[A-Za-z0-9._]{2,24}$/.test(username) || !STREAMER_TROLL_ACTIONS.has(action)) {
        return sendJson(response, 400, { error: "Ungültiger Streamer oder Troll-Effekt." });
      }
      const targets = [...sessions.values()].filter(session =>
        !session.stopped && session.username.toLowerCase() === username.toLowerCase()
      );
      let delivered = 0;
      const message = JSON.stringify({ type: "admin_action", action, issuedAt: new Date().toISOString() });
      for (const session of targets) {
        for (const client of session.clients) {
          if (client.readyState === WebSocket.OPEN) { client.send(message); delivered += 1; }
        }
      }
      return sendJson(response, delivered ? 200 : 409, {
        ok: delivered > 0, username, action, delivered,
        error: delivered ? undefined : "Für diesen Streamer ist gerade kein Playfinity-Fenster verbunden."
      });
    }
    if (request.method === "GET" && url.pathname === "/admin/metrics") {
      const now = Date.now();
      for (const [id, session] of usageStats.sessions) if (now - session.lastSeenAt > 90000) usageStats.sessions.delete(id);
      const activeSessions = [...usageStats.sessions.values()].filter(session => session.active).length;
      const today = getDailyUsage();
      return sendJson(response, 200, {
        day: usageStats.day, pageViews: usageStats.pageViews, uniqueVisitors: usageStats.visitors.size,
        totalPlayMinutes: Math.round(usageStats.totalPlayMs / 60000 * 10) / 10,
        averagePlayMinutesPerVisit: usageStats.pageViews ? Math.round(usageStats.totalPlayMs / usageStats.pageViews / 60000 * 10) / 10 : 0,
        activeSessions, longestSessionMinutes: Math.round(usageStats.longestSessionMs / 60000 * 10) / 10,
        todayPageViews: today.pageViews, todayUniqueVisitors: today.visitors.size,
        todayPlayMinutes: Math.round(today.playMs / 60000 * 10) / 10,
        todayAveragePlayMinutesPerVisit: today.pageViews ? Math.round(today.playMs / today.pageViews / 60000 * 10) / 10 : 0,
        todayLongestSessionMinutes: Math.round(today.longestSessionMs / 60000 * 10) / 10,
        storage: "memory_only", period: "since_server_start"
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

  if (request.method === "OPTIONS" && ["/api/connect", "/api/reconnect"].includes(url.pathname)) {
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

  if (request.method === "POST" && url.pathname === "/api/reconnect") {
    if (!originAllowed(request)) return sendJson(response, 403, { error: "Diese Herkunft ist nicht freigegeben." });
    if (!allowRequest(request)) return sendJson(response, 429, { error: "Zu viele Verbindungsversuche. Bitte kurz warten." });
    let rawBody = "";
    for await (const chunk of request) { rawBody += chunk; if (rawBody.length > 2048) return sendJson(response, 413, { error: "Anfrage zu groß." }); }
    let body; try { body = JSON.parse(rawBody || "{}"); } catch { return sendJson(response, 400, { error: "Ungültige Anfrage." }); }
    const username = normalizeUsername(body.username);
    if (!username) return sendJson(response, 400, { error: "Bitte einen gültigen TikTok-@Namen eingeben." });
    try {
      let session = sessions.get(sessionsByUsername.get(username));
      if (!session || session.stopped) session = await startSession(username);
      else {
        if (!session.reconnecting) {
          session.reconnecting = (async () => {
            const nextConnection = new TikTokLiveConnection(username, { processInitialData: false, fetchRoomInfoOnConnect: true });
            attachTikTokListeners(session, nextConnection);
            try {
              await nextConnection.connect();
              const previousConnection = session.connection;
              session.connection = nextConnection;
              session.lastConnectorError = null;
              session.lastConnectorErrorAt = null;
              broadcast(session, { type: "connector_reconnected", message: "TikTok LIVE wurde neu verbunden." });
              if (previousConnection && previousConnection !== nextConnection) await previousConnection.disconnect().catch(() => {});
            } catch (error) {
              await nextConnection.disconnect().catch(() => {});
              throw error;
            }
          })().finally(() => { session.reconnecting = null; });
        }
        await session.reconnecting;
      }
      return sendJson(response, 200, { ok: true, username: session.username, websocketPath: `/ws/${session.token}`, message: "TikTok LIVE neu verbunden." }, { "access-control-allow-origin": request.headers.origin, "vary": "Origin" });
    } catch (error) {
      console.error("[TikTok] Reconnect fehlgeschlagen:", error?.stack || error?.message || error);
      return sendJson(response, 502, { error: "TikTok-LIVE konnte nicht neu verbunden werden. Ist der Account gerade live?", detail: String(error?.message || "Unbekannter Verbindungsfehler").slice(0, 300) }, { "access-control-allow-origin": request.headers.origin, "vary": "Origin" });
    }
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
      console.error("[TikTok] Verbindung fehlgeschlagen:", error?.stack || error?.message || error);
      return sendJson(response, 502, {
        error: "TikTok-LIVE konnte nicht erreicht werden. Ist der Account gerade live?",
        detail: String(error?.message || "Unbekannter Verbindungsfehler").slice(0, 300)
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
  if (pathname === "/players") {
    if (!origin || !allowedOrigins.has(origin)) { socket.write("HTTP/1.1 403 Forbidden\\r\\n\\r\\n"); socket.destroy(); return; }
    websocketServer.handleUpgrade(request, socket, head, websocket => websocketServer.emit("player-connection", websocket, request));
    return;
  }
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

websocketServer.on("player-connection", (websocket) => {
  const id = randomBytes(8).toString("hex");
  const fallbackName = "Spieler-" + id.slice(0,4).toUpperCase();
  const player = { id, name:fallbackName, fallbackName, streamerUsername:null, game:"menu", solution:"", active:true, connectedAt:new Date().toISOString(), lastSeenAt:Date.now(), socket:websocket };
  activePlayers.set(id, player);
  websocket.send(JSON.stringify({type:"registered",playerId:id,name:player.name}));
  websocket.on("message", raw => {
    if (Buffer.byteLength(raw) > 512) return;
    let message; try { message = JSON.parse(String(raw)); } catch { return; }
    if (message.type !== "presence") return;
    player.game = PLAYER_GAMES.has(message.game) ? message.game : "menu";
    const streamerUsername = typeof message.streamerUsername === "string" ? normalizeUsername(message.streamerUsername) : null;
    player.streamerUsername = streamerUsername;
    player.name = streamerUsername ? "@" + streamerUsername : player.fallbackName;
    player.active = message.active === true;
    const solution = typeof message.solution === "string" ? message.solution.trim() : "";
    player.solution = player.active && player.game !== "menu" && /^[A-Za-zÄÖÜäöüßẞ -]{1,80}$/.test(solution) ? solution : "";
    player.lastSeenAt = Date.now();
    activePlayers.set(id, player);
  });
  websocket.on("close", () => activePlayers.delete(id));
  websocket.on("error", () => activePlayers.delete(id));
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
