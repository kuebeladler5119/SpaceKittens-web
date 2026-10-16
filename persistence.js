// Save-game persistence with recovery. Loaded before game.js.
// - Primary save:   nebula-harvest-save
// - Session backup: nebula-harvest-save-backup  (last successfully loaded save, written once per boot)
// - Quarantine:     nebula-harvest-save-corrupt (raw text of an unreadable save; never auto-deleted by the game)
// - Held copy:      nebula-harvest-save-held (a readable save the game could not use as-is: newer schema or a
//                   structural field of the wrong type; the first held copy is never overwritten by the game)
// Writes never throw into game code; failures are reported via NebulaSave.lastError.
(function () {
  'use strict';
  const PRIMARY = 'nebula-harvest-save';
  const BACKUP = 'nebula-harvest-save-backup';
  const CORRUPT = 'nebula-harvest-save-corrupt';
  const HELD = 'nebula-harvest-save-held';

  function storage() {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function parse(raw) {
    if (typeof raw !== 'string' || !raw) return null;
    try {
      const value = JSON.parse(raw);
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  }

  const api = {
    PRIMARY,
    BACKUP,
    CORRUPT,
    HELD,
    lastError: null,
    lastWriteAt: 0,
    loadInfo: { source: 'fresh', recovered: false, quarantined: false },

    /** Returns the raw saved object (unnormalized) or null for a fresh start. */
    load() {
      const store = storage();
      if (!store) {
        api.loadInfo = { source: 'fresh', recovered: false, quarantined: false, unavailable: true };
        return null;
      }
      const primaryRaw = store.getItem(PRIMARY);
      const primary = parse(primaryRaw);
      if (primary) {
        try {
          store.setItem(BACKUP, primaryRaw);
        } catch {}
        api.loadInfo = { source: 'primary', recovered: false, quarantined: false };
        return primary;
      }
      let quarantined = false;
      if (primaryRaw) {
        // Unreadable save: keep the raw text so it can be inspected/recovered manually.
        try {
          store.setItem(CORRUPT, primaryRaw);
          quarantined = true;
        } catch {}
      }
      const backup = parse(store.getItem(BACKUP));
      if (backup) {
        api.loadInfo = { source: 'backup', recovered: true, quarantined };
        return backup;
      }
      api.loadInfo = { source: 'fresh', recovered: false, quarantined };
      return null;
    },

    /** Keep an untouched copy of a readable save before the game normalizes it away (E-03). Returns true when a
     * copy exists afterwards; an earlier held copy is kept (it is the older, more valuable one). */
    hold(raw, reason) {
      const store = storage();
      if (!store || !raw) return false;
      try {
        if (store.getItem(HELD)) return true;
        store.setItem(HELD, JSON.stringify({ reason, heldAt: Date.now(), save: raw }));
        return true;
      } catch (error) {
        api.lastError = error;
        return false;
      }
    },

    /** Serialize and write the save. Returns true on success. */
    write(state) {
      const store = storage();
      if (!store) return false;
      let json;
      try {
        json = JSON.stringify(state);
        if (!parse(json)) throw new Error('Serialized save is not an object');
      } catch (error) {
        api.lastError = error;
        return false;
      }
      try {
        store.setItem(PRIMARY, json);
        api.lastError = null;
        api.lastWriteAt = Date.now();
        return true;
      } catch (error) {
        // Quota exceeded or storage disabled: drop the quarantine copy and retry once.
        api.lastError = error;
        try {
          store.removeItem(CORRUPT);
          store.setItem(PRIMARY, json);
          api.lastError = null;
          api.lastWriteAt = Date.now();
          return true;
        } catch (retryError) {
          api.lastError = retryError;
          return false;
        }
      }
    },

    /** Portable save code for manual backup / device transfer. */
    exportCode(state) {
      const json = JSON.stringify(state);
      return 'NH1.' + btoa(unescape(encodeURIComponent(json)));
    },

    /** Decode a save code; returns the raw object or throws. */
    importCode(code) {
      const trimmed = String(code || '').trim();
      if (!trimmed.startsWith('NH1.')) throw new Error('Unbekanntes Format');
      const json = decodeURIComponent(escape(atob(trimmed.slice(4))));
      const value = parse(json);
      if (!value) throw new Error('Spielstand ist beschädigt');
      return value;
    }
  };
  window.NebulaSave = api;
})();
