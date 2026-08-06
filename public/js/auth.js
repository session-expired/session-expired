(() => {
  const form = document.querySelector("#register-form, #login-form");

  function showErrors(errors = {}) {
    document.querySelectorAll(".error").forEach((element) => { element.textContent = ""; });
    Object.entries(errors).forEach(([field, message]) => {
      const target = document.getElementById(`${field}-error`);
      if (target) target.textContent = message;
    });
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      if (button.disabled) return;
      button.disabled = true;
      showErrors();

      const data = Object.fromEntries(new FormData(form));
      const endpoint = form.id === "register-form" ? "/api/register" : "/api/login";
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (!response.ok) return showErrors(result.errors);
        window.location.assign(result.redirect);
      } catch (error) {
        showErrors({ form: "Unable to reach the server. Please try again." });
      } finally {
        button.disabled = false;
      }
    });
  }

  const notice = document.getElementById("registered-notice");
  if (notice && new URLSearchParams(window.location.search).get("registered") === "1") notice.hidden = false;

  const username = document.getElementById("account-username");
  if (username) {
    fetch("/api/session")
      .then((response) => response.json())
      .then((data) => {
        if (!data.authenticated) return window.location.replace("/login");
        username.textContent = data.user.username;
        document.getElementById("account-email").textContent = data.user.email;
      })
      .catch(() => { username.textContent = "Unable to load account."; });
  }
})();
