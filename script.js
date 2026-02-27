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

const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbzgbSfpIMZaz3fcKd1oUm_WMupHDm5SfqG08yE9nuPx7GTDhu8nTlDDo51YU0lBQdNVSQ/exec";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));

  try {
    await fetch(RSVP_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    });

    note.textContent = "Thanks! Your RSVP has been submitted.";
    form.reset();
  } catch (err) {
    note.textContent = "Submission failed. Please try again.";
  }
});

