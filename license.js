// Licence state for Local Clipper.
//
// Why this exists: the paid gate used to be a bare boolean in chrome.storage.local,
// so anyone could open the service worker console and run
//
//     chrome.storage.local.set({ isPro: true })
//
// and unlock every Pro feature. Now the source of truth is a licence *record*
// (key + Lemon Squeezy instance + last successful validation). `isPro` is only
// ever a derived cache, and background.js re-derives it from the record every time
// the service worker starts — which MV3 does constantly, since the worker is torn
// down after ~30s idle and restarted on the next event. A hand-set isPro therefore
// flips back on its own.
//
// This is not DRM. A client-side extension cannot be made tamper-proof, and anyone
// willing to edit the source can bypass it. The goal is that the one-line bypass
// stops working, which is the difference between a locked door and an open one.
(function (root) {
  "use strict";

  const LICENSE_KEY = "license";
  const ACTIVATE_URL = "https://api.lemonsqueezy.com/v1/licenses/activate";
  const VALIDATE_URL = "https://api.lemonsqueezy.com/v1/licenses/validate";
  const DEACTIVATE_URL = "https://api.lemonsqueezy.com/v1/licenses/deactivate";
  const REVALIDATE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // re-check weekly

  function readRecord() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [LICENSE_KEY]: null }, (data) => {
        void chrome.runtime.lastError;
        resolve((data && data[LICENSE_KEY]) || null);
      });
    });
  }

  function writeRecord(record) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [LICENSE_KEY]: record }, resolve);
    });
  }

  function clearRecord() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(LICENSE_KEY, resolve);
    });
  }

  // Usable = there is a key and the last check said it was good.
  function isRecordUsable(record) {
    return !!(record && record.key && record.status === "active");
  }

  function isStale(record) {
    if (!record || !record.validatedAt) return true;
    return Date.now() - record.validatedAt > REVALIDATE_AFTER_MS;
  }

  function post(url, params) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params)
    }).then((res) => res.json());
  }

  // First activation: the key has never been seen on this machine.
  //
  // This uses Lemon Squeezy's documented first-use endpoint. Note that /activate
  // registers an *instance* on every call, so the product's "activation limit"
  // setting caps how many times a customer can ever (re)activate — across
  // reinstalls and devices. Keep that limit generous in the Lemon Squeezy
  // dashboard (or unlimited); 5 will eventually lock someone out of something
  // they paid for.
  function activate(key) {
    return post(ACTIVATE_URL, { license_key: key, instance_name: "Local Clipper" })
      .then((json) => {
        if (!json || !json.activated) {
          const reason = (json && json.error) || "That licence key was not accepted.";
          return { ok: false, error: reason };
        }
        const record = {
          key: key,
          instanceId: (json.instance && json.instance.id) || "",
          status: "active",
          validatedAt: Date.now()
        };
        return writeRecord(record).then(() => ({ ok: true, record }));
      })
      .catch(() => ({ ok: false, error: "Could not reach the licence server. Check your connection." }));
  }

  // Periodic re-check. Offline is treated as "keep working" — locking a paying
  // customer out because their wifi dropped would be worse than the piracy risk.
  function revalidate() {
    return readRecord().then((record) => {
      if (!isRecordUsable(record)) return { ok: false, record: null };

      const params = { license_key: record.key };
      if (record.instanceId) params.instance_id = record.instanceId;

      return post(VALIDATE_URL, params)
        .then((json) => {
          if (json && json.valid) {
            record.status = "active";
            record.validatedAt = Date.now();
            return writeRecord(record).then(() => ({ ok: true, record }));
          }
          record.status = "invalid";
          return writeRecord(record).then(() => ({ ok: false, record }));
        })
        .catch(() => ({ ok: true, record, offline: true }));
    });
  }

  function deactivate() {
    return readRecord().then((record) => {
      const finish = () => clearRecord().then(() => ({ ok: true }));
      if (!record || !record.key || !record.instanceId) return finish();
      return post(DEACTIVATE_URL, { license_key: record.key, instance_id: record.instanceId })
        .then(finish)
        .catch(finish);
    });
  }

  const api = {
    LICENSE_KEY,
    REVALIDATE_AFTER_MS,
    readRecord,
    writeRecord,
    clearRecord,
    isRecordUsable,
    isStale,
    activate,
    revalidate,
    deactivate
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ClipperLicense = api;
  }
})(typeof self !== "undefined" ? self : this);
