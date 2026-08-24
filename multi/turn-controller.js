(function exposeTurnController(root, factory) {
  const controller = factory();
  if (typeof module === "object" && module.exports) module.exports = controller;
  else root.MultiTurnController = controller;
})(globalThis, () => {
  const actionablePhases = new Set(["awaiting_roll", "moving", "awaiting_end"]);

  function controlledPlayerId(state, playerIds) {
    const playerId = state?.turn?.playerId;
    if (!actionablePhases.has(state?.turn?.phase) || !playerIds.includes(playerId)) return null;
    return playerId;
  }

  return { controlledPlayerId };
});
