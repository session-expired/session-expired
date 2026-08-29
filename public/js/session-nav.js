(() => {
  const authLink = document.querySelector("[data-auth-link]");
  if (!authLink) return;

  function addBackToGameLink(activeGame) {
    if (!activeGame || document.querySelector("[data-back-to-game]")) return;
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = activeGame.url;
    link.textContent = "BACK TO GAME";
    link.className = "back-to-game-link";
    link.dataset.backToGame = "";
    link.setAttribute("aria-label", "Back to your current game");
    item.appendChild(link);
    authLink.closest("li")?.before(item);
  }

  function addAdminLink(role) {
    if (role !== "admin" || document.querySelector("[data-admin-link]")) return;
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "/admin";
    link.textContent = "ADMIN";
    link.dataset.adminLink = "";
    item.appendChild(link);
    authLink.closest("li")?.before(item);
  }

  fetch("/api/session")
    .then((response) => {
      if (!response.ok) throw new Error("Unable to load session.");
      return response.json();
    })
    .then((session) => {
      if (!session.authenticated) return;
      authLink.href = "/account";
      authLink.textContent = session.user.username;
      authLink.setAttribute("aria-label", `Account for ${session.user.username}`);
      addBackToGameLink(session.activeGame);
      addAdminLink(session.user.role);
    })
    .catch(() => {
      // Keep the Login link available if session status cannot be loaded.
    });
})();
