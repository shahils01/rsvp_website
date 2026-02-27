const scrollButtons = document.querySelectorAll('[data-scroll]');

scrollButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const target = document.querySelector(button.dataset.scroll);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

const form = document.getElementById('rsvpForm');
const note = document.getElementById('rsvpNote');

const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbx3I1mA-JrcPKcoz8KFNiR68wJQhuHry_4kYTqi42kb/dev";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));

  try {
    const response = await fetch(RSVP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = (await response.text()).trim().toLowerCase();
    if (result !== "ok") {
      throw new Error(`Unexpected response: ${result || "empty"}`);
    }

    note.textContent = "Thanks! Your RSVP has been submitted.";
    form.reset();
  } catch (err) {
    console.error("RSVP submission failed:", err);
    note.textContent = "Submission failed. Please check your Apps Script deployment and try again.";
  }
});
