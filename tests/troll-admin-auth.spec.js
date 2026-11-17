import test from "node:test";
import assert from "node:assert/strict";
import { createAdminAuth, derivePasswordHash } from "../tiktok-connector/troll-admin-auth.js";

const salt = "11".repeat(32);
const password = "local-test-password";
const passwordHash = derivePasswordHash(password, salt);

test("refuses to start when password hash or salt is missing or malformed", () => {
  assert.throws(() => createAdminAuth({ passwordHash: undefined, passwordSalt: salt }), /disabled/);
  assert.throws(() => createAdminAuth({ passwordHash, passwordSalt: "bad" }), /disabled/);
});

test("accepts the configured password and issues an opaque session token", () => {
  const auth = createAdminAuth({ passwordHash, passwordSalt: salt });
  const token = auth.login(password);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(auth.authenticate(token), true);
  assert.equal(auth.login("wrong-password"), null);
});

test("rejects unknown tokens and revokes logged-out sessions", () => {
  const auth = createAdminAuth({ passwordHash, passwordSalt: salt });
  const token = auth.login(password);
  assert.equal(auth.authenticate("a".repeat(64)), false);
  auth.logout(token);
  assert.equal(auth.authenticate(token), false);
});

test("expires sessions and fails closed", () => {
  let clock = 1000;
  const auth = createAdminAuth({ passwordHash, passwordSalt: salt, sessionTtlMs: 60_000, now: () => clock });
  const token = auth.login(password);
  assert.equal(auth.authenticate(token), true);
  clock += 60_001;
  assert.equal(auth.authenticate(token), false);
});

test("validates password input and session lifetime", () => {
  assert.throws(() => derivePasswordHash("", salt), /Password/);
  assert.throws(() => createAdminAuth({ passwordHash, passwordSalt: salt, sessionTtlMs: 1000 }), /TTL/);
});
