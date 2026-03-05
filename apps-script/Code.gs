const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID_HERE';
const RSVP_SHEET_NAME = 'RSVP';
const REGISTRY_SHEET_NAME = 'RegistryClaims';
const RSVP_HEADERS = ['Name', 'Email', 'Attendance', 'Song', 'Notes', 'SubmittedAt'];
const REGISTRY_HEADERS = ['GiftId', 'Action', 'GuestToken', 'UpdatedAt'];

function doGet(e) {
  try {
    const action = asString_(e && e.parameter && e.parameter.action).toLowerCase();
    if (action === 'list') {
      const sheet = ensureSheet_(REGISTRY_SHEET_NAME, REGISTRY_HEADERS);
      return jsonResponse_({ claims: getRegistryClaims_(sheet) });
    }
    return jsonResponse_({ ok: true, message: 'Registry API ready' });
  } catch (error) {
    return jsonResponse_({ error: safeError_(error) });
  }
}

function doPost(e) {
  try {
    const payload = parseBody_(e);
    const action = asString_(payload.action).toLowerCase();

    if (action === 'claim' || action === 'release') {
      return handleRegistryMutation_(action, payload);
    }

    if (isRsvpPayload_(payload)) {
      appendRsvp_(payload);
      return textResponse_('ok');
    }

    return jsonResponse_({ error: 'Unsupported request.' });
  } catch (error) {
    return jsonResponse_({ error: safeError_(error) });
  }
}

function handleRegistryMutation_(action, payload) {
  const giftId = asString_(payload.giftId);
  const guestToken = asString_(payload.guestToken);
  const updatedAt = asString_(payload.updatedAt) || new Date().toISOString();

  if (!giftId || !guestToken) {
    return jsonResponse_({ error: 'giftId and guestToken are required.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheet = ensureSheet_(REGISTRY_SHEET_NAME, REGISTRY_HEADERS);
    const claims = getRegistryClaims_(sheet);
    const currentClaim = claims[giftId];
    const claimedByOther = currentClaim && currentClaim.claimedBy !== guestToken;

    if (action === 'claim' && claimedByOther) {
      return jsonResponse_({ error: 'This gift was already picked by another guest.' });
    }

    if (action === 'release') {
      if (!currentClaim) {
        return jsonResponse_({ claims: claims });
      }
      if (claimedByOther) {
        return jsonResponse_({ error: 'Only the same anonymous browser can release this gift.' });
      }
    }

    sheet.appendRow([giftId, action, guestToken, updatedAt]);

    if (action === 'claim') {
      claims[giftId] = { claimed: true, claimedBy: guestToken, updatedAt: updatedAt };
    } else {
      delete claims[giftId];
    }

    return jsonResponse_({ claims: claims });
  } finally {
    lock.releaseLock();
  }
}

function getRegistryClaims_(sheet) {
  const rows = getDataRows_(sheet, REGISTRY_HEADERS.length);
  const claims = {};

  for (let i = 0; i < rows.length; i += 1) {
    const giftId = asString_(rows[i][0]);
    const action = asString_(rows[i][1]).toLowerCase();
    const guestToken = asString_(rows[i][2]);
    const updatedAt = asString_(rows[i][3]);

    if (!giftId || !guestToken) {
      continue;
    }

    if (action === 'claim') {
      claims[giftId] = { claimed: true, claimedBy: guestToken, updatedAt: updatedAt };
    } else if (action === 'release') {
      if (claims[giftId] && claims[giftId].claimedBy === guestToken) {
        delete claims[giftId];
      }
    }
  }

  return claims;
}

function appendRsvp_(payload) {
  const sheet = ensureSheet_(RSVP_SHEET_NAME, RSVP_HEADERS);
  sheet.appendRow([
    asString_(payload.name),
    asString_(payload.email),
    asString_(payload.attendance),
    asString_(payload.song),
    asString_(payload.notes),
    new Date().toISOString(),
  ]);
}

function isRsvpPayload_(payload) {
  return Boolean(
    asString_(payload.name) ||
    asString_(payload.email) ||
    asString_(payload.attendance) ||
    asString_(payload.song) ||
    asString_(payload.notes)
  );
}

function parseBody_(e) {
  const body = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    return {};
  }
}

function ensureSheet_(sheetName, headers) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return sheet;
  }

  const existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeaderFix = headers.some(function (header, index) {
    return asString_(existingHeaders[index]) !== header;
  });

  if (needsHeaderFix) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function getDataRows_(sheet, width) {
  const rowCount = sheet.getLastRow();
  if (rowCount < 2) {
    return [];
  }
  return sheet.getRange(2, 1, rowCount - 1, width).getValues();
}

function getSpreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PASTE_YOUR_SPREADSHEET_ID_HERE') {
    throw new Error('Set SPREADSHEET_ID in apps-script/Code.gs before deploying.');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function asString_(value) {
  return String(value == null ? '' : value).trim();
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function textResponse_(message) {
  return ContentService
    .createTextOutput(String(message))
    .setMimeType(ContentService.MimeType.TEXT);
}

function safeError_(error) {
  if (error && error.message) {
    return String(error.message);
  }
  return 'Unexpected server error.';
}
