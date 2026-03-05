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

const RSVP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxF63V1OITf4qAvP-QzDcTFCDkTj-UmQENKOH5wU-g5kxppXC1j0zEQZ-54GND2LqhelQ/exec';

if (form && note) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    try {
      const response = await fetch(RSVP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = (await response.text()).trim().toLowerCase();
      if (result !== 'ok') {
        throw new Error(`Unexpected response: ${result || 'empty'}`);
      }

      note.textContent = 'Thanks! Your RSVP has been submitted.';
      form.reset();
    } catch (err) {
      console.error('RSVP submission failed:', err);
      note.textContent = 'Submission failed. Please check your Apps Script deployment and try again.';
    }
  });
}

const REGISTRY_WEBSITE_LINKS = [
  { label: 'Amazon Registry', url: 'https://www.amazon.com/wedding/guest-view/2TMKQZYJ4WLQJ' },
  { label: 'Wayfair', url: 'https://www.wayfair.com/lists/favorites/2260988781/shah3TGhxw' },
];

// const REGISTRY_ITEMS = [
//   {
//     id: 'gift-espresso-machine',
//     title: 'Espresso Machine',
//     store: 'Amazon',
//     description: 'For cozy morning coffee dates at home.',
//     url: 'https://www.amazon.com/',
//   },
//   {
//     id: 'gift-dinnerware-set',
//     title: 'Dinnerware Set',
//     store: 'Amazon',
//     description: 'A daily-use set we can use when hosting family and friends.',
//     url: 'https://www.amazon.com/',
//   },
//   {
//     id: 'gift-luggage-set',
//     title: 'Luggage Set',
//     store: 'Travel Store',
//     description: 'For honeymoon and future travel adventures.',
//     url: 'https://example.com/luggage',
//   },
//   {
//     id: 'gift-bedding-set',
//     title: 'Premium Bedding Set',
//     store: 'Home Store',
//     description: 'Soft neutral tones to match our bedroom.',
//     url: 'https://example.com/bedding',
//   },
// ];

// Optional shared tracking endpoint.
// Use your own Google Apps Script web app URL here so all guests see the same gift status.
const REGISTRY_API_ENDPOINT = '';
const REGISTRY_REFRESH_MS = 25000;
const REGISTRY_LOCAL_STORAGE_KEY = 'wedding_registry_claims_v1';
const REGISTRY_GUEST_TOKEN_KEY = 'wedding_registry_guest_token_v1';

const registryLinksEl = document.getElementById('registryLinks');
const registryGridEl = document.getElementById('registryGrid');
const registryNoteEl = document.getElementById('registryNote');

const validGiftIds = new Set(REGISTRY_ITEMS.map((item) => item.id));

const registryState = {
  claims: {},
  busyGiftIds: new Set(),
  guestToken: getGuestToken(),
};

function getGuestToken() {
  try {
    const existingToken = localStorage.getItem(REGISTRY_GUEST_TOKEN_KEY);
    if (existingToken) {
      return existingToken;
    }

    const newToken = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(REGISTRY_GUEST_TOKEN_KEY, newToken);
    return newToken;
  } catch (error) {
    console.warn('Guest token persistence is unavailable:', error);
    return `guest-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeClaims(rawClaims) {
  const safeClaims = {};
  if (!rawClaims || typeof rawClaims !== 'object') {
    return safeClaims;
  }

  Object.entries(rawClaims).forEach(([giftId, value]) => {
    if (!validGiftIds.has(giftId)) {
      return;
    }
    if (!value || typeof value !== 'object' || value.claimed !== true) {
      return;
    }

    safeClaims[giftId] = {
      claimed: true,
      claimedBy: typeof value.claimedBy === 'string' ? value.claimedBy : '',
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    };
  });

  return safeClaims;
}

function setRegistryNote(message, isError = false) {
  if (!registryNoteEl) {
    return;
  }
  registryNoteEl.textContent = message;
  registryNoteEl.classList.toggle('registry__note--error', isError);
}

function renderRegistryLinks() {
  if (!registryLinksEl) {
    return;
  }

  registryLinksEl.innerHTML = REGISTRY_WEBSITE_LINKS.map((link) => `
      <a class="btn btn--primary btn--small registry-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(link.label)}
      </a>
    `).join('');
}

function getGiftStatusText(isClaimed, claimedByMe) {
  if (!isClaimed) {
    return 'Available';
  }
  if (claimedByMe) {
    return 'Claimed by you';
  }
  return 'Already picked';
}

function getGiftMessage(isClaimed, claimedByMe) {
  if (!isClaimed) {
    return 'No personal details are shown. Click below to reserve this gift anonymously.';
  }
  if (claimedByMe) {
    return 'Only you can release this claim from this browser.';
  }
  return 'Another guest already reserved this gift.';
}

function renderRegistryCards() {
  if (!registryGridEl) {
    return;
  }

  registryGridEl.innerHTML = REGISTRY_ITEMS.map((item) => {
    const claim = registryState.claims[item.id];
    const isClaimed = Boolean(claim && claim.claimed);
    const claimedByMe = Boolean(isClaimed && claim.claimedBy === registryState.guestToken);
    const isBusy = registryState.busyGiftIds.has(item.id);

    const statusClass = isClaimed ? 'chip--claimed' : 'chip--available';
    const buttonText = claimedByMe ? 'Release my claim' : 'I got this gift';
    const buttonDisabled = isBusy || (isClaimed && !claimedByMe) ? 'disabled' : '';
    const buttonClass = claimedByMe ? 'btn btn--link btn--small' : 'btn btn--primary btn--small';

    return `
      <article class="registry-card">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="registry-card__meta">
          <span class="chip chip--store">${escapeHtml(item.store)}</span>
          <span class="chip ${statusClass}">${escapeHtml(getGiftStatusText(isClaimed, claimedByMe))}</span>
        </div>
        <div class="registry-card__actions">
          <a class="btn btn--link btn--small" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">View gift</a>
          <button class="${buttonClass}" data-gift-id="${escapeHtml(item.id)}" data-registry-action="toggle" ${buttonDisabled}>
            ${isBusy ? 'Saving...' : escapeHtml(buttonText)}
          </button>
        </div>
        <p class="registry-card__message">${escapeHtml(getGiftMessage(isClaimed, claimedByMe))}</p>
      </article>
    `;
  }).join('');
}

function readLocalClaims() {
  try {
    const raw = localStorage.getItem(REGISTRY_LOCAL_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return sanitizeClaims(JSON.parse(raw));
  } catch (error) {
    console.warn('Unable to parse local registry claims:', error);
    return {};
  }
}

function writeLocalClaims(claims) {
  try {
    localStorage.setItem(REGISTRY_LOCAL_STORAGE_KEY, JSON.stringify(claims));
  } catch (error) {
    console.warn('Unable to persist local registry claims:', error);
  }
}

function applyLocalClaimAction(giftId, action) {
  const claims = readLocalClaims();
  const existing = claims[giftId];
  const claimedByMe = existing && existing.claimedBy === registryState.guestToken;

  if (action === 'claim') {
    if (existing && existing.claimed && !claimedByMe) {
      throw new Error('This gift was already picked by another guest.');
    }
    claims[giftId] = {
      claimed: true,
      claimedBy: registryState.guestToken,
      updatedAt: new Date().toISOString(),
    };
  } else if (action === 'release') {
    if (existing && existing.claimed && !claimedByMe) {
      throw new Error('Only the same anonymous browser can release this gift.');
    }
    delete claims[giftId];
  } else {
    throw new Error('Unsupported registry action.');
  }

  writeLocalClaims(claims);
  return claims;
}

async function parseRegistryResponse(response) {
  const text = (await response.text()).trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Registry endpoint must return JSON. Received: ${text.slice(0, 120)}`);
  }
}

async function fetchRemoteClaims() {
  const query = new URLSearchParams({ action: 'list', t: String(Date.now()) }).toString();
  const response = await fetch(`${REGISTRY_API_ENDPOINT}?${query}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Registry fetch failed (HTTP ${response.status})`);
  }

  const payload = await parseRegistryResponse(response);
  if (payload.error) {
    throw new Error(payload.error);
  }

  if (payload.claims) {
    return sanitizeClaims(payload.claims);
  }
  return sanitizeClaims(payload);
}

async function saveRemoteClaim(giftId, action) {
  const response = await fetch(REGISTRY_API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action,
      giftId,
      guestToken: registryState.guestToken,
      updatedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Registry update failed (HTTP ${response.status})`);
  }

  const payload = await parseRegistryResponse(response);
  if (payload.error) {
    throw new Error(payload.error);
  }

  if (payload.claims) {
    return sanitizeClaims(payload.claims);
  }
  return fetchRemoteClaims();
}

async function loadRegistryClaims() {
  if (REGISTRY_API_ENDPOINT) {
    return fetchRemoteClaims();
  }
  return readLocalClaims();
}

async function saveRegistryClaim(giftId, action) {
  if (!validGiftIds.has(giftId)) {
    throw new Error('Invalid gift id.');
  }
  if (REGISTRY_API_ENDPOINT) {
    return saveRemoteClaim(giftId, action);
  }
  return applyLocalClaimAction(giftId, action);
}

async function handleRegistryAction(giftId) {
  const currentClaim = registryState.claims[giftId];
  const claimedByMe = currentClaim && currentClaim.claimedBy === registryState.guestToken;
  const action = claimedByMe ? 'release' : 'claim';

  registryState.busyGiftIds.add(giftId);
  renderRegistryCards();

  try {
    registryState.claims = await saveRegistryClaim(giftId, action);
    setRegistryNote(
      action === 'claim'
        ? 'Thank you. Your gift selection is saved anonymously.'
        : 'Your anonymous claim was removed.',
      false
    );
  } catch (error) {
    console.error('Registry save failed:', error);
    setRegistryNote(error.message || 'Unable to save registry status right now.', true);
  } finally {
    registryState.busyGiftIds.delete(giftId);
    renderRegistryCards();
  }
}

async function initRegistry() {
  if (!registryGridEl || !registryLinksEl || !registryNoteEl) {
    return;
  }

  renderRegistryLinks();
  renderRegistryCards();

  try {
    registryState.claims = await loadRegistryClaims();
    if (REGISTRY_API_ENDPOINT) {
      setRegistryNote('Live anonymous gift tracking is active.');
      window.setInterval(async () => {
        try {
          registryState.claims = await fetchRemoteClaims();
          renderRegistryCards();
        } catch (error) {
          console.error('Registry refresh failed:', error);
        }
      }, REGISTRY_REFRESH_MS);
    } else {
      setRegistryNote('Registry is in local preview mode. Add REGISTRY_API_ENDPOINT in script.js for shared tracking.');
    }
  } catch (error) {
    console.error('Registry initialization failed:', error);
    setRegistryNote('Could not load registry status. Please refresh and try again.', true);
  }

  renderRegistryCards();
}

if (registryGridEl) {
  registryGridEl.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest('[data-registry-action="toggle"]');
    if (!button || !(button instanceof HTMLButtonElement)) {
      return;
    }

    const giftId = button.dataset.giftId;
    if (!giftId || button.disabled) {
      return;
    }

    await handleRegistryAction(giftId);
  });
}

initRegistry();
