// O Store for phones: a signed catalogue of downloadable Pets OS phone apps.
// catalog.json is signed (catalog.sig, ECDSA P-256 / SHA-256, DER) with the Pets OS store key;
// each package is a .js file that calls Apps.register() for exactly "store:<id>", checked by SHA-256
// when it is installed and again every time Pets OS starts. Installed packages live in IndexedDB.
'use strict';

const PetStore = {
  URL: 'https://downloads.shouldbe.media/petsos/mobile/v1/',
  // Public half of the Pets OS store key (keys/petsos-store-public.pem in the desktop repo).
  KEY: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEyLfJb3YHyy/eKxvw9jXpzUwsKkNI9VVrc5cogB+Li49kFEeP7mddZ6HP09XUCjMu+KGrtpVSumKBdTKl7pfNXg==',
  catalog: null,     // verified catalogue, or null
  problem: null,     // why there is no catalogue, in plain words
  installed: {},     // id -> record { id, version, build, sha256, size, code, icon, name, installedAt }
  busy: {},          // id -> progress 0..1 while downloading
  expect: null,      // the package id allowed to register while its code runs

  // A development catalogue can be set by tests (Store.setApp('store.url', ...)); the UI says so.
  url() { return Store.app('store.url', null) || this.URL; },
  isDev() { return this.url() !== this.URL; },

  // ---- crypto
  b64(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
  hex(buf) { return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join(''); },
  async sha256(bytes) { return this.hex(await crypto.subtle.digest('SHA-256', bytes)); },
  // WebCrypto wants r||s (64 bytes); openssl writes DER SEQUENCE { INTEGER r, INTEGER s }.
  derToRaw(der) {
    const d = new Uint8Array(der);
    if (d[0] !== 0x30) throw new Error('signature');
    let i = d[1] & 0x80 ? 2 + (d[1] & 0x7f) : 2;
    const out = new Uint8Array(64);
    for (let k = 0; k < 2; k++) {
      if (d[i++] !== 0x02) throw new Error('signature');
      let len = d[i++], v = d.slice(i, i + len); i += len;
      while (v.length > 32 && v[0] === 0) v = v.slice(1);
      if (v.length > 32) throw new Error('signature');
      out.set(v, k * 32 + 32 - v.length);
    }
    return out;
  },
  async verify(bytes, sig) {
    if (!(window.crypto && crypto.subtle)) throw new Error('This browser can\'t check signatures');
    const key = await crypto.subtle.importKey('spki', this.b64(this.KEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, this.derToRaw(sig), bytes);
  },

  // ---- versions and compatibility
  cmp(a, b) {
    const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
  },
  // Returns null when the app can run here, otherwise the reason it can't.
  incompatible(e) {
    if (e.platforms && e.platforms.indexOf(PLATFORM) < 0) return 'Not available ' + (isWeb ? 'on iPhone' : 'on this phone');
    if (e.minPets && this.cmp(PETS_VERSION, e.minPets) < 0) return 'Needs Pets OS ' + e.minPets + ' or later';
    return null;
  },

  // ---- catalogue
  async refresh() {
    this.problem = null;
    const base = this.url();
    let body, sig;
    try {
      const [r1, r2] = await Promise.all([fetch(base + 'catalog.json', { cache: 'no-store' }), fetch(base + 'catalog.sig', { cache: 'no-store' })]);
      if (r1.status === 404 || r2.status === 404) { this.catalog = null; this.problem = 'O Store\'s app list wasn\'t found on the server (error 404). Try again later.'; return null; }
      if (!r1.ok || !r2.ok) { this.catalog = null; this.problem = 'O Store\'s server had a problem (error ' + (r1.ok ? r2.status : r1.status) + '). Try again in a moment.'; return null; }
      body = new Uint8Array(await r1.arrayBuffer()); sig = await r2.arrayBuffer();
    } catch (e) {
      this.catalog = null;
      this.problem = navigator.onLine === false ? 'You\'re offline. Connect to the internet to see apps you can download.' : 'O Store can\'t be reached right now. Try again in a moment.';
      return null;
    }
    let ok = false;
    try { ok = await this.verify(body, sig); } catch (e) { ok = false; }
    if (!ok) { this.catalog = null; this.problem = 'The app list failed its security check, so it was not used.'; return null; }
    const cat = json(new TextDecoder().decode(body), null);
    if (!cat || !Array.isArray(cat.apps)) { this.catalog = null; this.problem = 'The app list is damaged.'; return null; }
    if (cat.expires && Date.parse(cat.expires) < Date.now()) { this.catalog = null; this.problem = 'The app list has expired. Pets OS won\'t install from an old list.'; return null; }
    const floor = Store.app('store.serial', 0);
    if (!(cat.serial >= floor)) { this.catalog = null; this.problem = 'The app list is older than one this phone already saw, so it was refused.'; return null; }
    Store.setApp('store.serial', cat.serial);
    cat.apps = cat.apps.filter(e => /^[a-z0-9][a-z0-9.-]{0,63}$/.test(e.id || '') && e.file && /^[0-9a-f]{64}$/.test(e.sha256 || ''));
    this.catalog = cat;
    return cat;
  },
  entry(id) { return this.catalog && this.catalog.apps.find(e => e.id === id); },
  // 'get' | 'update' | 'open' | 'incompatible'
  state(e) {
    const have = this.installed[e.id];
    if (!have) return this.incompatible(e) ? 'incompatible' : 'get';
    if ((e.build || 0) > (have.build || 0) || this.cmp(e.version, have.version) > 0) return this.incompatible(e) ? 'open' : 'update';
    return 'open';
  },

  // ---- running package code
  // Runs the package; it must register exactly "store:<id>" and nothing else.
  run(rec) {
    const id = 'store:' + rec.id;
    this.expect = rec.id;
    try { new Function(rec.code)(); } finally { this.expect = null; }
    const app = Apps.builtin[id];
    if (!app || typeof app.open !== 'function') { delete Apps.builtin[id]; throw new Error('The app didn\'t start'); }
    app.store = true; app.version = rec.version;
    if (!app.img && rec.icon) app.img = rec.icon;
    if (!app.cat) app.cat = 'O Store';
    return app;
  },

  // ---- storage (IndexedDB)
  db() {
    if (this._db) return this._db;
    this._db = new Promise((ok, bad) => {
      const r = indexedDB.open('petsos-store', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('pkgs', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => bad(r.error);
    });
    return this._db;
  },
  async tx(mode, fn) {
    const db = await this.db();
    return new Promise((ok, bad) => {
      const t = db.transaction('pkgs', mode), s = t.objectStore('pkgs');
      const req = fn(s);
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => bad(t.error);
      t.onabort = () => bad(t.error || new Error('Storage is full'));
    });
  },

  // At start: load installed packages, re-checking each one's SHA-256 first.
  async boot() {
    let recs = [];
    try { recs = await this.tx('readonly', s => s.getAll()) || []; } catch (e) { return; }
    const bad = [];
    for (const rec of recs) {
      try {
        if (await this.sha256(new TextEncoder().encode(rec.code)) !== rec.sha256) throw new Error('changed');
        this.run(rec);
        this.installed[rec.id] = rec;
      } catch (e) { bad.push(rec.name || rec.id); }
    }
    if (bad.length) Shell.notify('O Store', bad.join(', ') + ' didn\'t pass its check and was not opened. Reinstall it from O Store.');
    // Milo downloaded on Pets OS 1.0.6 was added beside the old built-in Milo icon: keep just one.
    if (S.home) for (const sid in this.REPLACES) {
      const old = this.REPLACES[sid];
      if (!Apps.builtin[sid]) continue;
      const has = id => S.home.some(p => p.indexOf(id) >= 0) || S.dock.indexOf(id) >= 0;
      if (has(sid) && has(old)) { S.home = S.home.map(p => p.filter(x => x !== old)); S.dock = S.dock.filter(x => x !== old); Store.save(); }
    }
    if (S.home && $('#pages')) Shell.buildHome(); // before Shell.start, start builds it
  },

  // ---- install / update
  async download(url, size, progress) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('The download failed (server answered ' + r.status + ').');
    const total = size || +r.headers.get('content-length') || 0;
    if (!r.body || !r.body.getReader) { const b = new Uint8Array(await r.arrayBuffer()); progress(1); return b; }
    const reader = r.body.getReader(), parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); got += value.length;
      if (size && got > size) throw new Error('The download is bigger than O Store said, so it was stopped.');
      if (total) progress(Math.min(1, got / total));
    }
    const out = new Uint8Array(got); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  },
  async install(id, onProgress) {
    const e = this.entry(id);
    if (!e) throw new Error('This app isn\'t in O Store any more.');
    const why = this.incompatible(e);
    if (why) throw new Error(why + '.');
    if (this.busy[id] != null) throw new Error(e.name + ' is already downloading.');
    const tell = p => { this.busy[id] = p; if (onProgress) onProgress(p); };
    tell(0);
    try {
      let bytes;
      try { bytes = await this.download(new URL(e.file, this.url()).href, e.size, tell); }
      catch (err) {
        if (err instanceof TypeError) throw new Error(navigator.onLine === false ? 'The phone is offline. Connect to the internet and try again.' : e.name + ' couldn\'t be downloaded: O Store can\'t be reached right now. Check the connection and try again.');
        throw err;
      }
      if (e.size && bytes.length !== e.size) throw new Error('The download was incomplete. Try again.');
      if (await this.sha256(bytes) !== e.sha256) throw new Error('The download didn\'t match O Store\'s fingerprint, so it was not installed.');
      const rec = { id, name: e.name, version: e.version, build: e.build || 0, sha256: e.sha256, size: bytes.length,
        code: new TextDecoder().decode(bytes), icon: /^data:image\/(png|jpeg|webp);base64,/.test(e.icon || '') ? e.icon : null, installedAt: Date.now() };
      // Swap in the new code; if it doesn't start, put the old version back.
      const sid = 'store:' + id, old = Apps.builtin[sid];
      delete Apps.builtin[sid];
      try { this.run(rec); } catch (err) { if (old) Apps.builtin[sid] = old; throw new Error(e.name + ' couldn\'t start, so it was not installed.'); }
      try { await this.tx('readwrite', s => s.put(rec)); } catch (err) {
        if (old) Apps.builtin[sid] = old; else delete Apps.builtin[sid];
        throw new Error('There isn\'t enough space on the phone to install ' + e.name + '.');
      }
      const updating = !!this.installed[id];
      this.installed[id] = rec;
      const w = Shell.windows.find(x => x.id === sid);
      if (w) Shell.quit(w); // reopen with the new version
      if (!updating) this.addToHome(sid);
      Shell.buildHome();
      return updating ? 'updated' : 'installed';
    } finally { delete this.busy[id]; }
  },
  // Downloaded apps that take over an older built-in icon (Milo) go where that icon was.
  REPLACES: { 'store:milo': 'pets:milo' },
  addToHome(sid) {
    if (S.home.some(p => p.indexOf(sid) >= 0) || S.dock.indexOf(sid) >= 0) return;
    const old = this.REPLACES[sid];
    if (old && (S.home.some(p => p.indexOf(old) >= 0) || S.dock.indexOf(old) >= 0)) {
      S.home = S.home.map(p => p.map(x => x === old ? sid : x));
      S.dock = S.dock.map(x => x === old ? sid : x);
      Store.save(); return;
    }
    let last = S.home[S.home.length - 1];
    if (!last || last.length >= 24) { last = []; S.home.push(last); }
    last.push(sid); Store.save();
  },

  // ---- uninstall
  async uninstall(id, removeData) {
    const sid = 'store:' + id;
    await this.tx('readwrite', s => s.delete(id));
    const w = Shell.windows.find(x => x.id === sid);
    if (w) Shell.quit(w);
    delete Apps.builtin[sid];
    delete this.installed[id];
    S.home = S.home.map(p => p.filter(x => x !== sid)).filter((p, i) => p.length || i === 0);
    S.dock = S.dock.filter(x => x !== sid);
    S.recentApps = S.recentApps.filter(x => x !== sid);
    S.notifOff = (S.notifOff || []).filter(x => x !== sid);
    Store.save();
    if (removeData) {
      const pre = 'petsos.app.' + sid;
      for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k === pre || k.startsWith(pre + '.')) localStorage.removeItem(k); }
    }
    Shell.buildHome();
  },
  // Asks first, and says what happens to the app's data.
  askUninstall(id, done) {
    const rec = this.installed[id];
    if (!rec) return;
    Dialog.menu('Uninstall ' + rec.name + '?', 'The app is removed from this phone. You can keep its data in case you install it again, or delete it now.', [
      { label: 'Uninstall, keep its data', fn: async () => { await this.uninstall(id, false); Shell.toast(rec.name + ' uninstalled. Its data was kept.'); if (done) done(); } },
      { label: 'Uninstall and delete its data', danger: true, fn: async () => { await this.uninstall(id, true); Shell.toast(rec.name + ' and its data were removed'); if (done) done(); } }
    ]);
  }
};

// Packages may only register their own "store:<id>" app, and never replace one that exists.
(() => {
  const reg = Apps.register;
  Apps.register = function (def) {
    if (PetStore.expect) {
      if (!def || def.id !== 'store:' + PetStore.expect || this.builtin[def.id]) throw new Error('package registered the wrong app');
    } else if (def && String(def.id).startsWith('store:')) throw new Error('store apps only come from O Store');
    return reg.call(this, def);
  };
})();
PetStore.boot();
window.PetStore = PetStore;
