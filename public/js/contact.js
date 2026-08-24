document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".contact-card form");

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const formData = {
            fullName: document.getElementById("fullName").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            subject: document.getElementById("subject").value,
            message: document.getElementById("message").value.trim(),
        };

        const emailBody = [
            `Name: ${formData.fullName}`,
            `Email: ${formData.email}`,
            `Phone: ${formData.phone || "Not provided"}`,
            "",
            formData.message,
        ].join("\n");

        window.location.href =
            "mailto:sessionexpiredhelpdesk@gmail.com" +
            `?subject=${encodeURIComponent(formData.subject)}` +
            `&body=${encodeURIComponent(emailBody)}`;
    });
});
