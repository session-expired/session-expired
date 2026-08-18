document.addEventListener("DOMContentLoaded", () =>{
    const form = document.querySelector(".contact-card form");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');

        const formData = {
            fullName: document.getElementById("fullName").value.trim(),
            email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      subject: document.getElementById("subject").value,
      message: document.getElementById("message").value.trim(),
    };
 
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
 
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
 
      if (!res.ok) throw new Error("Server error");
 
      alert("Message sent! We'll get back to you soon.");
      form.reset();
    } catch (err) {
      alert("Something went wrong. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Message";
    }
  });
});