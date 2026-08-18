(() => {
  const authLink = document.querySelector("[data-auth-link]");
  if (!authLink) return;

  fetch("/api/session")
    .then((response) => response.json())
    .then((session) => {
      if (!session.authenticated) return;
      authLink.href = "/account";
      authLink.textContent = session.user.username;
      authLink.setAttribute("aria-label", `Account for ${session.user.username}`);
    })
    .catch(() => {
      // Keep the Login link available if session status cannot be loaded.
    });
})();
