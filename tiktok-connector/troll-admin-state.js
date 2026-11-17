const ACTIONS = new Set(["shake", "flip", "confetti", "freeze", "message"]);

export function createTrollAdminState() {
  let emergencyStop = true;
  let revision = 0;

  return Object.freeze({
    isStopped() {
      return emergencyStop;
    },
    activateEmergencyStop() {
      emergencyStop = true;
      revision += 1;
      return { emergencyStop, revision };
    },
    reEnable() {
      emergencyStop = false;
      revision += 1;
      return { emergencyStop, revision };
    },
    simulateAction(action) {
      if (emergencyStop) return { ok: false, reason: "emergency_stop_active" };
      if (!ACTIONS.has(action)) return { ok: false, reason: "unknown_action" };
      return { ok: true, simulated: true, action, revision };
    }
  });
}

export const TROLL_ADMIN_ACTIONS = Object.freeze([...ACTIONS]);
