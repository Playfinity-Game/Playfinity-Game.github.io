import test from "node:test";
import assert from "node:assert/strict";
import { createTrollAdminState, TROLL_ADMIN_ACTIONS } from "../tiktok-connector/troll-admin-state.js";

test("starts with emergency stop active", () => {
  const state = createTrollAdminState();
  assert.equal(state.isStopped(), true);
  assert.deepEqual(state.simulateAction("shake"), { ok: false, reason: "emergency_stop_active" });
});

test("only allows simulated allowlisted actions after explicit re-enable", () => {
  const state = createTrollAdminState();
  state.reEnable();
  for (const action of TROLL_ADMIN_ACTIONS) {
    assert.equal(state.simulateAction(action).simulated, true);
  }
  assert.deepEqual(state.simulateAction("shell"), { ok: false, reason: "unknown_action" });
});

test("emergency stop takes precedence again after re-enable", () => {
  const state = createTrollAdminState();
  state.reEnable();
  assert.equal(state.simulateAction("confetti").ok, true);
  const result = state.activateEmergencyStop();
  assert.equal(result.emergencyStop, true);
  assert.deepEqual(state.simulateAction("confetti"), { ok: false, reason: "emergency_stop_active" });
});
