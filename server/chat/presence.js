function createPresenceRegistry() {
  const users = new Map();

  function connect(user, socketId) {
    const id = String(user.id);
    const entry = users.get(id) || { id, username: user.username, sockets: new Set() };
    entry.username = user.username;
    entry.sockets.add(socketId);
    users.set(id, entry);
    return entry.sockets.size === 1;
  }

  function disconnect(userId, socketId) {
    const id = String(userId);
    const entry = users.get(id);
    if (!entry) return false;
    entry.sockets.delete(socketId);
    if (entry.sockets.size) return false;
    users.delete(id);
    return true;
  }

  function isOnline(userId) {
    return users.has(String(userId));
  }

  function list() {
    return [...users.values()]
      .map(({ id, username }) => ({ id, username }))
      .sort((left, right) => left.username.localeCompare(right.username, undefined, { sensitivity: "base" }));
  }

  return { connect, disconnect, isOnline, list };
}

module.exports = { createPresenceRegistry };
