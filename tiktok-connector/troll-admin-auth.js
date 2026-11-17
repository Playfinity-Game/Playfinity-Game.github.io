import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_BYTES = 64;
const SALT_BYTES = 32;
const SESSION_BYTES = 32;
const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;

function isHex(value, length) {
  return typeof value === "string" && value.length === length * 2 && /^[a-f0-9]+$/i.test(value);
}

export function derivePasswordHash(password, saltHex) {
  if (typeof password !== "string" || password.length < 1 || password.length > 1024) {
    throw new TypeError("Password must be a non-empty string of at most 1024 characters.");
  }
  if (!isHex(saltHex, SALT_BYTES)) {
    throw new TypeError("Password salt must be 32 bytes encoded as hex.");
  }
  return scryptSync(password, Buffer.from(saltHex, "hex"), HASH_BYTES).toString("hex");
}

export function createAdminAuth({
  passwordHash = process.env.TROLL_ADMIN_PASSWORD_HASH,
  passwordSalt = process.env.TROLL_ADMIN_PASSWORD_SALT,
  sessionTtlMs = DEFAULT_SESSION_TTL_MS,
  now = Date.now
} = {}) {
  if (!isHex(passwordHash, HASH_BYTES) || !isHex(passwordSalt, SALT_BYTES)) {
    throw new Error("Troll Admin auth is disabled: configure TROLL_ADMIN_PASSWORD_HASH and TROLL_ADMIN_PASSWORD_SALT.");
  }
  if (!Number.isSafeInteger(sessionTtlMs) || sessionTtlMs < 60_000) {
    throw new TypeError("Session TTL must be an integer of at least 60 seconds.");
  }

  const expectedHash = Buffer.from(passwordHash, "hex");
  const salt = Buffer.from(passwordSalt, "hex");
  const sessions = new Map();

  function login(password) {
    if (typeof password !== "string" || password.length < 1 || password.length > 1024) return null;
    const actualHash = scryptSync(password, salt, HASH_BYTES);
    if (!timingSafeEqual(actualHash, expectedHash)) return null;

    const token = randomBytes(SESSION_BYTES).toString("hex");
    sessions.set(token, { expiresAt: now() + sessionTtlMs });
    return token;
  }

  function authenticate(token) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) return false;
    const session = sessions.get(token);
    if (!session) return false;
    if (session.expiresAt <= now()) {
      sessions.delete(token);
      return false;
    }
    return true;
  }

  function logout(token) {
    if (typeof token === "string") sessions.delete(token);
  }

  return Object.freeze({ login, authenticate, logout });
}
