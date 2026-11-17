import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../tiktok-connector/admin.html", import.meta.url), "utf8");

test("admin dashboard contains login, emergency stop and all allowlisted actions", () => {
  for (const value of [
    'id="loginForm"',
    "'/admin/login'",
    "'/admin/status'",
    "'/admin/logout'",
    "'/admin/emergency-stop'",
    "'/admin/re-enable'",
    "'/admin/action'",
    'data-action="shake"',
    'data-action="flip"',
    'data-action="confetti"',
    'data-action="freeze"',
    'data-action="message"'
  ]) assert.ok(html.includes(value), `Missing dashboard element or endpoint: ${value}`);
});

test("dashboard clearly labels actions as simulations and does not embed credentials", () => {
  assert.match(html, /ausschließlich Simulationen/i);
  assert.match(html, /keine echte Spielwirkung/i);
  assert.doesNotMatch(html, /TROLL_ADMIN_PASSWORD_(?:HASH|SALT)\s*[:=]/);
  assert.doesNotMatch(html, /password\s*[:=]\s*["'][^"']+["']/i);
});

test("dashboard exposes live-connection status as not yet connected", () => {
  assert.match(html, /Noch nicht verbunden/);
  assert.match(html, /noch keine Live-Spieler oder Zuschauer/i);
});
