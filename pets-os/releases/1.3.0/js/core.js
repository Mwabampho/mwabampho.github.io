// Pets OS Mobile system shell: settings store, phone bridge, status bar, lock
// screen, home screen, Rest, Control Centre, notifications, app windows.
'use strict';

// append() that skips null/false, so optional parts can be passed inline.
const _append = Element.prototype.append;
Element.prototype.append = function (...kids) { return _append.apply(this, kids.filter(k => k != null && k !== false)); };
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------------------------------------------------------------- phone bridge
// On the phone, MainActivity provides window.PetsAndroid. In a desktop browser
// (for design work and tests) a stand-in answers instead.
const onPhone = typeof window.PetsAndroid !== 'undefined';
// 'android' = the Pets OS launcher app; 'web' = iPhone/iPad (or any browser), added to the Home Screen.
const PLATFORM = onPhone ? 'android' : 'web';
const isWeb = PLATFORM === 'web';
// Google Play edition (zsh build.sh play): no self-updater, no direct texting, no all-files access (Play policies).
const PLAY = window.PETS_STORE === 'play';
const PETS_VERSION = '1.3.0';
document.documentElement.classList.add('platform-' + PLATFORM);
// On the phone, a Proxy so tests can stand in for single methods (the Java object can't be changed).
const Phone = onPhone ? new Proxy({}, {
  get: (stubs, k) => k in stubs ? stubs[k] : (typeof window.PetsAndroid[k] === 'function' ? window.PetsAndroid[k].bind(window.PetsAndroid) : window.PetsAndroid[k]),
  set: (stubs, k, v) => { if (v === undefined) delete stubs[k]; else stubs[k] = v; return true; }
}) : webPhone();

// iPhone (and any browser): Pets OS runs as a web app added to the Home Screen.
// Apple doesn't let it see other apps, set alarms, use the torch or replace iOS screens,
// so those answers say "not here" and the interface hides what doesn't apply.
function webPhone() {
  const go = url => { try { location.href = url; return true; } catch (e) { return false; } };
  let camInput = null;
  return {
    apps: () => '[]', launch: () => false, appInfo: () => false, uninstall: () => false,
    dial: n => go('tel:' + (n || '')), sms: n => go('sms:' + (n || '')),
    // Camera: take a photo with the iPhone camera and keep it in Moments.
    camera: () => {
      if (!camInput) {
        camInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
        camInput.onchange = async () => {
          const f = camInput.files && camInput.files[0];
          if (!f) return;
          const s = await Moments.shrink(f, 2048);
          if (s) { await Moments.put({ id: uid(), blob: s.blob, w: s.w, h: s.h, added: Date.now(), name: f.name, fav: false }); Shell.toast('Saved to Moments'); }
          camInput.value = '';
          const w = Shell.front(); if (w && w.id === 'pets:moments') w.refresh();
        };
        document.body.append(camInput);
      }
      camInput.click();
      return true;
    },
    contacts: () => false, music: () => go('music://'), store: () => go('itms-apps://apps.apple.com'),
    setAlarm: () => false, setTimer: () => false, settings: () => false, askToBeHome: () => false,
    storageAllowed: () => false, askStorage: () => {}, storageInfo: () => '{}', listFiles: () => 'null',
    openFile: () => false, shareFile: () => false, deleteFile: () => false, makeFolder: () => false, renameFile: () => false,
    sound: () => '{}', setVolume: () => false, setRingerMode: () => false,
    startOnBoot: () => false, setStartOnBoot: () => {}, autoLaunchSettings: () => false,
    checkUpdate: () => setTimeout(() => PetsOS.updateInfo(JSON.stringify({ error: 'web' })), 0),
    openExternal: u => { window.open(u, '_blank'); return true; },
    openUrl: u => { window.open(u || 'https://search.brave.com', '_blank'); },
    vibrate: ms => { if (navigator.vibrate) navigator.vibrate(ms || 20); },
    battery: () => '{}',
    network: () => navigator.onLine ? 'online' : 'none',
    device: () => JSON.stringify({ manufacturer: 'Apple', model: /iPad/.test(navigator.userAgent) ? 'iPad' : 'iPhone', defaultHome: false, notifAccess: false, torch: false, version: PETS_VERSION, web: true }),
    torch: () => false, brightness: () => {}, systemBrightness: () => 0.5,
    notifications: () => '[]', openNotification: () => false, dismissNotification: () => {}, clearNotifications: () => {},
    sha256: s => sha256Hex(s),
    log: s => console.log(s), ready: () => {}
  };
}

// SHA-256 (synchronous, for the passcode hash where crypto.subtle's promise doesn't fit).
function sha256Hex(str) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const bytes = new TextEncoder().encode(str);
  const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total); m.set(bytes); m[len] = 0x80;
  const bits = len * 8; for (let i = 0; i < 4; i++) m[total - 1 - i] = (bits >>> (8 * i)) & 0xff;
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const W = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = (m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) W[i] = (r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3)) + W[i - 16] + (r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10)) + W[i - 7];
    let [a, b, c, d, e, f, g, hh] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
const json = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };

// ---------------------------------------------------------------- settings store
const Store = {
  key: 'petsos.mobile.v1',
  data: null,
  defaults() {
    return {
      setupDone: false, name: '', pin: null, salt: null, theme: 'dark', wallpaper: 'alpine-dusk',
      home: null, dock: ['pets:rest', 'sys:phone', 'sys:messages', 'sys:camera'],
      hidden: [], dnd: false, brightness: -1, use24h: !/(AM|PM)/.test(new Date(2020, 0, 1, 13).toLocaleTimeString()),
      recentApps: [], autoAddAndroid: true, hideHuawei: null
    };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.key)); } catch (e) { d = null; }
    this.data = Object.assign(this.defaults(), d || {});
    return this.data;
  },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { console.warn('save failed', e); } },
  // Per-app data lives under its own key so one app can't break another.
  app(id, def) { const v = json(localStorage.getItem('petsos.app.' + id), null); return v == null ? def : v; },
  setApp(id, v) { try { localStorage.setItem('petsos.app.' + id, JSON.stringify(v)); } catch (e) { Shell.toast('Storage is full'); } }
};
const S = Store.load();

// ---------------------------------------------------------------- app registry
// Pets OS apps register themselves in apps.js. Android apps appear as "android:<package>".
const Apps = {
  builtin: {},
  android: [],
  register(def) { this.builtin[def.id] = def; },
  get(id) {
    if (this.builtin[id]) return this.builtin[id];
    if (id && id.startsWith('android:')) {
      const pkg = id.slice(8);
      const a = this.android.find(x => x.pkg === pkg);
      if (a) return { id, name: a.label, android: true, pkg, cat: 'Android' };
    }
    return null;
  },
  // Huawei's own apps. Camera and Gallery stay because Pets OS has no replacement for them.
  HUAWEI: /^(com\.huawei\.|com\.hihonor\.|com\.hicloud\.|com\.vmall\.|com\.huawei$)/,
  KEEP: ['com.huawei.camera', 'com.huawei.photos'],
  isHuawei(pkg) { return this.HUAWEI.test(pkg) && this.KEEP.indexOf(pkg) < 0; },
  hidden(pkg) { return !!S.hideHuawei && this.isHuawei(pkg); },
  refreshAndroid() {
    this.android = json(Phone.apps(), []).sort((a, b) => a.label.localeCompare(b.label));
    return this.android;
  },
  all() {
    const pets = Object.values(this.builtin).filter(a => !a.hiddenFromRest);
    const droid = this.android.filter(a => !this.hidden(a.pkg)).map(a => this.get('android:' + a.pkg));
    return pets.concat(droid);
  },
  tile(app, big) {
    const t = h('div', { class: 'tile' + (app.android ? ' android' : '') });
    if (app.android) {
      const img = h('img', { src: '/appicon/' + app.pkg, alt: '', loading: 'lazy' });
      img.onerror = () => { t.classList.remove('android'); t.style.background = letterColour(app.name); t.textContent = app.name.slice(0, 1).toUpperCase(); t.style.fontSize = '26px'; t.style.fontWeight = '600'; img.remove(); };
      if (!onPhone) img.onerror();
      else t.append(img);
    } else if (app.img) {
      t.style.backgroundImage = 'url(' + app.img + ')';
    } else {
      t.style.background = app.bg || 'linear-gradient(145deg,#5b8cff,#8c7bff)';
      t.innerHTML = icon(app.glyph || 'app-window');
    }
    return t;
  }
};
function letterColour(s) {
  let x = 0; for (const c of s) x = (x * 33 + c.charCodeAt(0)) % 360;
  return 'linear-gradient(145deg,hsl(' + x + ',62%,55%),hsl(' + ((x + 40) % 360) + ',62%,42%))';
}

// ---------------------------------------------------------------- touch helpers
// press(): tap and long-press on one element, cancelled if the finger moves.
function press(el, onTap, onHold, holdMs) {
  let timer = null, sx = 0, sy = 0, held = false, down = false;
  el.addEventListener('pointerdown', e => {
    // A button inside the row (Get, Open, a switch) handles its own tap; the row must not also act.
    const inner = e.target.closest && e.target.closest('button, input, select, textarea, a');
    if (inner && inner !== el && el.contains(inner)) { down = false; return; }
    down = true; held = false; sx = e.clientX; sy = e.clientY;
    if (onHold) timer = setTimeout(() => { held = true; Phone.vibrate(18); onHold(e); }, holdMs || 500);
    el.classList.add('pressing');
  });
  const cancel = () => { clearTimeout(timer); timer = null; down = false; el.classList.remove('pressing'); };
  el.addEventListener('pointermove', e => { if (down && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', () => { if (down && !held) cancel(); });
  el.addEventListener('pointerup', e => {
    const wasDown = down; cancel();
    if (wasDown && !held && onTap) { swallowClick(e); onTap(e); }
  });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
// press() acts when the finger lifts, but the browser sends a click just after. If the tap opened a
// new screen, that click would land on whatever is now under the finger (a wallpaper, a Get button,
// a Back button). swallowClick() drops that one click; a later, real tap is never affected.
let ghost = null;
function swallowClick(e) { ghost = { x: e.clientX, y: e.clientY, until: Date.now() + 450 }; }
document.addEventListener('click', e => {
  if (!ghost) return;
  const g = ghost; ghost = null;
  if (Date.now() < g.until && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 24 && e.isTrusted) { e.preventDefault(); e.stopPropagation(); }
}, true);
// swipe(): reports a vertical/horizontal flick on an element.
function swipe(el, cb, opts) {
  let sx = 0, sy = 0, st = 0, on = false;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); on = true; if (opts && opts.start) opts.start(sx, sy); }, { passive: true });
  el.addEventListener('touchmove', e => { if (on && opts && opts.move) { const t = e.touches[0]; opts.move(t.clientX - sx, t.clientY - sy, sx, sy); } }, { passive: true });
  el.addEventListener('touchend', e => {
    if (!on) return; on = false;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
    const min = (opts && opts.min) || 50;
    let dir = null;
    if (Math.abs(dy) > Math.abs(dx) * 1.3 && Math.abs(dy) > min) dir = dy < 0 ? 'up' : 'down';
    else if (Math.abs(dx) > Math.abs(dy) * 1.3 && Math.abs(dx) > min) dir = dx < 0 ? 'left' : 'right';
    cb(dir, { dx, dy, dt, sx, sy });
  });
  // Mouse drag for desktop previews.
  let mdown = false;
  el.addEventListener('mousedown', e => { mdown = true; sx = e.clientX; sy = e.clientY; st = Date.now(); if (opts && opts.start) opts.start(sx, sy); });
  window.addEventListener('mouseup', e => {
    if (!mdown) return; mdown = false;
    const dx = e.clientX - sx, dy = e.clientY - sy, min = (opts && opts.min) || 50;
    let dir = null;
    if (Math.abs(dy) > Math.abs(dx) * 1.3 && Math.abs(dy) > min) dir = dy < 0 ? 'up' : 'down';
    else if (Math.abs(dx) > Math.abs(dy) * 1.3 && Math.abs(dx) > min) dir = dx < 0 ? 'left' : 'right';
    if (dir) cb(dir, { dx, dy, dt: Date.now() - st, sx, sy });
  });
}

// ---------------------------------------------------------------- time formatting
const Fmt = {
  time(d) {
    d = d || new Date();
    if (S.use24h) return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    return ((d.getHours() % 12) || 12) + ':' + pad2(d.getMinutes());
  },
  ampm(d) { return S.use24h ? '' : (d.getHours() < 12 ? 'AM' : 'PM'); },
  date(d) { return (d || new Date()).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); },
  ago(t) {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  },
  dur(ms) {
    const s = Math.max(0, Math.round(ms / 1000)), hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60;
    return (hh ? hh + ':' + pad2(mm) : mm) + ':' + pad2(ss);
  }
};

// ---------------------------------------------------------------- wallpapers
const Wallpapers = {
  list: [
    { id: 'alpine-dusk', name: 'Alpine Dusk', css: 'url(img/alpine-dusk.jpg)' },
    { id: 'avatar-peak', name: 'Avatar Peak', css: 'url(img/avatar-peak.jpg)' },
    { id: 'night', name: 'Night', css: 'linear-gradient(160deg,#1b1f3a 0%,#0d1020 55%,#2a1840 100%)' },
    { id: 'aurora', name: 'Aurora', css: 'linear-gradient(165deg,#0f2b3d 0%,#1c5a6b 35%,#5b8cff 70%,#8c7bff 100%)' },
    { id: 'sunrise', name: 'Sunrise', css: 'linear-gradient(170deg,#ff9a6b 0%,#ff6b8b 40%,#8c5bff 100%)' },
    { id: 'meadow', name: 'Meadow', css: 'linear-gradient(165deg,#c8f0d8 0%,#3dd6a0 45%,#1e6b6b 100%)' },
    { id: 'paper', name: 'Paper', css: 'linear-gradient(170deg,#f6f2ea,#e6e0d4)' }
  ],
  apply() {
    const w = this.list.find(x => x.id === S.wallpaper);
    const custom = S.wallpaper === 'custom' && Store.app('wallpaper.custom', null);
    $('#wall').style.background = (custom ? 'url(' + custom + ')' : (w || this.list[0]).css) + ' center/cover no-repeat';
  }
};

// ---------------------------------------------------------------- the shell
const Shell = {
  notes: [],         // Pets OS's own notifications
  droidNotes: [],    // the phone's notifications (needs Notification access)
  windows: [],       // open app windows, most recent last
  locked: false,
  editing: false,

  start() {
    document.documentElement.classList.toggle('light', S.theme === 'light');
    document.documentElement.classList.toggle('reduce-motion', !!S.reduceMotion);
    Wallpapers.apply();
    if (S.brightness >= 0) Phone.brightness(S.brightness);
    Apps.refreshAndroid();
    if (S.hideHuawei == null) { S.hideHuawei = /huawei|honor/i.test(json(Phone.device(), {}).manufacturer || ''); Store.save(); }
    this.ensureHome();
    this.buildStatus();
    this.buildHome();
    this.buildLock();
    this.buildPin();
    this.tick();
    setInterval(() => this.tick(), 1000);
    setInterval(() => this.pollPhone(), 15000);
    if (onPhone) setTimeout(() => Updates.daily(), 8000);
    if (isWeb) {
      // No screen-off signal on iPhone: lock after Pets OS was in the background for 30 s.
      let hiddenAt = 0;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) hiddenAt = Date.now();
        else if (S.pin && hiddenAt && S.autoLockMs !== 0 && Date.now() - hiddenAt > (S.autoLockMs || 30000)) this.lock();
      });
      if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    this.pollPhone();
    this.gestures();
    if (window.Activities) Activities.restore();
    Phone.ready();
    const booted = () => {
      $('#boot').classList.add('gone');
      if (!S.setupDone) Setup.show();
      else if (S.pin) this.lock();
    };
    setTimeout(booted, new URLSearchParams(location.search).has('selftest') ? 50 : 1300);
  },

  // First run puts the Pets OS apps on page 1 and Android apps on page 2.
  ensureHome() {
    // 1.0.2 added Files: put it on existing Home Screens once.
    if (S.home && !S.addedFiles && !isWeb && !PLAY) {
      S.addedFiles = true;
      if (!S.home.some(p => p.indexOf('pets:files') >= 0)) { const p = S.home[0].length < 24 ? S.home[0] : S.home[S.home.length - 1]; p.splice(Math.max(0, p.indexOf('pets:ostore')), 0, 'pets:files'); }
      Store.save();
    }
    if (S.home) return;
    S.addedFiles = true;
    const page1 = ['widget:today', 'pets:clarice', 'pets:pen', 'pets:moments', 'pets:weather', 'pets:calendar', 'pets:clock', 'pets:calculator', 'pets:activities', 'pets:files', 'pets:ostore', 'pets:settings'];
    const prefer = ['com.android.chrome', 'com.google.android.youtube', 'com.whatsapp', 'com.google.android.gm', 'com.google.android.apps.maps', 'com.spotify.music', 'com.huawei.appmarket', 'com.android.vending'];
    const droid = Apps.android.filter(a => !Apps.hidden(a.pkg)).map(a => 'android:' + a.pkg);
    droid.sort((a, b) => { const ia = prefer.indexOf(a.slice(8)), ib = prefer.indexOf(b.slice(8)); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
    if (isWeb || PLAY) page1.splice(page1.indexOf('pets:files'), 1);
    // Every app gets a Home Screen spot, 24 to a page, so nothing is only reachable through Rest.
    const droidPages = [];
    for (let i = 0; i < droid.length; i += 24) droidPages.push(droid.slice(i, i + 24));
    S.home = [page1].concat(droidPages).filter(p => p.length);
    S.knownAndroid = Apps.android.map(a => a.pkg);
    Store.save();
  },

  // New Android installs land on the last home page, like a phone launcher should.
  syncAndroid() {
    const before = S.knownAndroid || [];
    Apps.refreshAndroid();
    const now = Apps.android.map(a => a.pkg);
    const added = now.filter(p => before.indexOf(p) < 0);
    const ids = new Set(now.map(p => 'android:' + p));
    let changed = false;
    S.home = S.home.map(p => p.filter(id => { const keep = !id.startsWith('android:') || ids.has(id); if (!keep) changed = true; return keep; }));
    S.dock = S.dock.filter(id => !id.startsWith('android:') || ids.has(id));
    if (S.autoAddAndroid && added.length && before.length) {
      for (const p of added.filter(x => !Apps.hidden(x))) {
        let last = S.home[S.home.length - 1];
        if (!last || last.length >= 24) { last = []; S.home.push(last); }
        last.push('android:' + p);
      }
      changed = true;
    }
    S.home = S.home.filter((p, i) => p.length || i === 0);
    S.knownAndroid = now;
    Store.save();
    if (changed || added.length) this.buildHome();
  },

  // Hide or show Huawei's apps everywhere in Pets OS.
  setHideHuawei(on) {
    S.hideHuawei = on;
    if (on) {
      const gone = id => !(id.startsWith('android:') && Apps.isHuawei(id.slice(8)));
      S.home = S.home.map(p => p.filter(gone));
      S.dock = S.dock.filter(gone);
    }
    Store.save();
    this.buildHome();
  },

  // ---- status bar
  buildStatus() {
    press($('#status .r'), () => this.openSheet('cc'));
    press($('#status .l'), () => this.openSheet('nc'));
  },
  tick() {
    const d = new Date();
    $('#status .time').textContent = Fmt.time(d);
    if (!$('#lock').classList.contains('gone')) {
      $('#lock .clock').textContent = Fmt.time(d);
      $('#lock .date').textContent = Fmt.date(d);
    }
    if (d.getMinutes() !== this.lastMinute) { this.lastMinute = d.getMinutes(); const w = $('.widget-today'); if (w) Widgets.today(w); }
    if (window.Clock) Clock.tick();
    if (window.Activities) Activities.tick();
  },
  battery() {
    const b = json(Phone.battery(), {});
    const lvl = b.level == null ? -1 : b.level;
    $('#status .pct').textContent = lvl >= 0 ? lvl + '%' : '';
    const cell = $('#status .cell');
    cell.classList.toggle('low', lvl >= 0 && lvl <= 20 && !b.charging);
    cell.classList.toggle('chg', !!b.charging);
    $('i', cell).style.width = Math.max(4, lvl) + '%';
    const net = Phone.network();
    $('#status .net').innerHTML = net === 'wifi' ? icon('wifi') : net === 'cell' ? icon('signal') : icon('wifi-off');
    return b;
  },
  pollPhone() {
    this.battery();
    const access = json(Phone.device(), {}).notifAccess;
    this.droidNotes = access ? json(Phone.notifications(), []) : [];
    this.renderLockNotes();
    if ($('#nc').classList.contains('open')) this.renderNC();
  },

  // ---- home screen
  buildHome() {
    const pages = $('#pages'), dots = $('#dots'), dock = $('#dock');
    const keepScroll = pages.scrollLeft;
    pages.innerHTML = ''; dots.innerHTML = ''; dock.innerHTML = '';
    S.home.forEach((ids, pi) => {
      const page = h('div', { class: 'page', 'data-page': pi });
      ids.forEach((id, i) => {
        const el = id.startsWith('widget:') ? Widgets.make(id) : this.appIcon(id, { page: pi, index: i });
        if (el) { el.setAttribute('data-idx', i); page.append(el); }
      });
      pages.append(page);
      dots.append(h('i'));
    });
    if (this.spill()) { Store.save(); return this.buildHome(); }
    S.dock.forEach((id, i) => { const el = this.appIcon(id, { dock: true, index: i }); if (el) dock.append(el); });
    pages.scrollLeft = keepScroll;
    const onScroll = () => { const i = Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth)); $$('#dots i').forEach((d, k) => d.classList.toggle('on', k === i)); };
    pages.onscroll = onScroll; onScroll();
    $('#home').classList.toggle('edit', this.editing);
  },
  // Pages never scroll up or down: icons that don't fit this screen move to a new page after it.
  spill() {
    const pages = $$('#pages .page');
    for (let pi = 0; pi < pages.length; pi++) {
      const box = pages[pi].getBoundingClientRect();
      if (!box.height) return false; // Home isn't laid out yet
      const over = Array.from(pages[pi].children).find(k => k.getBoundingClientRect().bottom > box.bottom + 1);
      const idx = over ? +over.getAttribute('data-idx') : -1;
      if (idx > 0) { S.home.splice(pi + 1, 0, S.home[pi].splice(idx)); return true; }
    }
    return false;
  },
  appIcon(id, where) {
    const app = Apps.get(id);
    if (!app) return null;
    const el = h('div', { class: 'app' + (id === 'pets:rest' ? ' rest' : ''), 'data-id': id },
      Apps.tile(app), h('div', { class: 'name', text: app.short || app.name }));
    const badge = app.badge && app.badge();
    if (badge) el.append(h('div', { class: 'badge', text: badge }));
    if (id === 'pets:rest') {
      // Rest: tap opens the drawer; press glows; a 550 ms hold opens music / globe / heart.
      el.addEventListener('pointerdown', () => el.classList.add('glow'));
      const unglow = () => setTimeout(() => el.classList.remove('glow'), 150);
      el.addEventListener('pointerup', unglow); el.addEventListener('pointercancel', unglow); el.addEventListener('pointerleave', unglow);
      press(el, () => this.openSheet('rest'), () => this.restMenu(el), 550);
      return el;
    }
    if (this.editing) this.dragIcon(el, id, where);
    else press(el, () => this.open(id, el), () => this.iconMenu(id, where, el));
    return el;
  },
  iconMenu(id, where, el) {
    const app = Apps.get(id);
    const opts = [];
    if (where.dock) opts.push({ label: 'Remove from Dock', fn: () => { S.dock.splice(where.index, 1); Store.save(); this.buildHome(); } });
    else {
      if (S.dock.length < 4 && S.dock.indexOf(id) < 0) opts.push({ label: 'Add to Dock', fn: () => { S.dock.push(id); Store.save(); this.buildHome(); } });
      opts.push({ label: 'Remove from Home Screen', fn: () => { S.home[where.page].splice(where.index, 1); Store.save(); this.buildHome(); this.toast(app.name + ' is still in Rest'); } });
    }
    opts.push({ label: 'Edit Home Screen', fn: () => this.setEditing(true) });
    if (app.android) {
      opts.push({ label: 'App Info', fn: () => Phone.appInfo(app.pkg) });
      opts.push({ label: 'Uninstall', danger: true, fn: () => Phone.uninstall(app.pkg) });
    }
    Dialog.menu(app.name, null, opts);
  },
  setEditing(on) {
    this.editing = on;
    this.buildHome();
    if (on) this.toast('Drag icons to move them. Press Home or Back when done.');
  },
  // Edit mode: drag an icon onto another to swap them (across pages too, and the dock).
  dragIcon(el, id, where) {
    let ghost = null;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      ghost = el.cloneNode(true);
      Object.assign(ghost.style, { position: 'fixed', zIndex: 99, pointerEvents: 'none', left: (e.clientX - 40) + 'px', top: (e.clientY - 45) + 'px', width: '80px', opacity: .9 });
      document.body.append(ghost);
      el.style.opacity = .3;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => { if (ghost) { ghost.style.left = (e.clientX - 40) + 'px'; ghost.style.top = (e.clientY - 45) + 'px'; } });
    el.addEventListener('pointercancel', () => { if (ghost) { ghost.remove(); ghost = null; el.style.opacity = ''; } });
    el.addEventListener('pointerup', e => {
      if (!ghost) return;
      ghost.remove(); ghost = null; el.style.opacity = '';
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const target = under && under.closest('.app');
      const page = under && under.closest('.page');
      const listOf = w => w.dock ? S.dock : S.home[w.page];
      if (target && target !== el) {
        const tid = target.getAttribute('data-id');
        const inDock = !!target.closest('#dock');
        const tWhere = inDock ? { dock: true, index: S.dock.indexOf(tid) } : { page: +target.closest('.page').getAttribute('data-page'), index: S.home[+target.closest('.page').getAttribute('data-page')].indexOf(tid) };
        if (tid === 'pets:rest' || id === 'pets:rest') { this.toast('Rest stays first in the Dock'); return; }
        listOf(where)[where.index] = tid;
        listOf(tWhere)[tWhere.index] = id;
      } else if (page && !target) {
        const pi = +page.getAttribute('data-page');
        if (where.dock) { if (id === 'pets:rest') return; S.dock.splice(where.index, 1); }
        else S.home[where.page].splice(where.index, 1);
        S.home[pi].push(id);
      } else if (!target && under && under.closest('#dock') && !where.dock && S.dock.length < 4) {
        S.home[where.page].splice(where.index, 1);
        S.dock.push(id);
      } else return;
      Store.save();
      this.buildHome();
    });
  },

  restMenu(anchor) {
    $('#restmenu') && $('#restmenu').remove();
    const r = anchor.getBoundingClientRect();
    const m = h('div', { id: 'restmenu', style: { left: Math.max(8, r.left) + 'px', bottom: (window.innerHeight - r.top + 10) + 'px' } },
      h('button', { class: 'music', html: icon('music'), 'aria-label': 'Music' }),
      h('button', { class: 'globe', html: icon('globe'), 'aria-label': 'Milo' }),
      h('button', { class: 'heart', html: icon('heart'), 'aria-label': 'Activities' }));
    const close = () => { m.remove(); document.removeEventListener('pointerdown', outside, true); };
    const outside = e => { if (!m.contains(e.target)) close(); };
    $('.music', m).onclick = () => { close(); Phone.music() || this.toast('No music app found'); };
    $('.globe', m).onclick = () => { close(); this.open(Apps.builtin['store:milo'] ? 'store:milo' : 'pets:milo'); };
    $('.heart', m).onclick = () => { close(); this.open('pets:activities'); };
    $('#phone').append(m);
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  },

  // ---- opening apps
  open(id, fromEl) {
    const app = Apps.get(id);
    if (!app) return;
    this.closeSheets();
    S.recentApps = [id].concat(S.recentApps.filter(x => x !== id)).slice(0, 12);
    Store.save();
    if (app.android) { if (!Phone.launch(app.pkg)) this.toast(app.name + " can't be opened"); return; }
    if (app.launch) { app.launch(); return; }
    let w = this.windows.find(x => x.id === id);
    if (w) {
      this.windows = this.windows.filter(x => x !== w).concat([w]);
      clearTimeout(w.hideTimer);
      w.el.classList.remove('hidden', 'closing');
      w.el.style.animation = 'none'; void w.el.offsetWidth; w.el.style.animation = '';
    } else {
      w = new AppWindow(app);
      this.windows.push(w);
      app.open(w);
    }
    $('#apps').append(w.el);
    if (fromEl) { const r = fromEl.getBoundingClientRect(); w.el.style.transformOrigin = (r.left + r.width / 2) + 'px ' + (r.top + r.height / 2) + 'px'; }
    $('#home').classList.add('away');
    this.statusTone();
    if (w.onShow) w.onShow();
  },
  front() { const v = this.windows.filter(w => !w.el.classList.contains('hidden') && w.el.isConnected); return v[v.length - 1]; },
  goHome(instant) {
    this.closeSheets();
    $('#recents').classList.add('hidden');
    const w = this.front();
    if (w) {
      w.el.classList.add('closing');
      clearTimeout(w.hideTimer);
      w.hideTimer = setTimeout(() => {
        if (!w.el.classList.contains('closing')) return; // reopened meanwhile
        w.el.classList.add('hidden'); w.el.classList.remove('closing'); if (w.onHide) w.onHide();
      }, instant ? 0 : 200);
    }
    $('#home').classList.remove('away');
    $('#wall').classList.remove('dim');
    if (this.editing) this.setEditing(false);
    this.statusTone(true);
  },
  quit(w) {
    if (w.onQuit) w.onQuit();
    w.el.remove();
    this.windows = this.windows.filter(x => x !== w);
  },
  statusTone(home) {
    const w = home ? null : this.front();
    $('#status').classList.toggle('dark', !!w && S.theme === 'light');
  },
  recents() {
    this.closeSheets();
    const box = $('#recents');
    box.innerHTML = '';
    const ws = this.windows.slice().reverse();
    if (!ws.length) box.append(h('div', { class: 'none', text: 'No recent Pets OS apps' }));
    ws.forEach(w => {
      const card = h('div', { class: 'rc' }, h('div', { class: 'preview' }, Apps.tile(w.app)));
      const wrap = h('div', { class: 'rc-wrap' }, h('div', { class: 'cap', style: { position: 'absolute', top: '-34px', left: '6px', display: 'flex', gap: '8px', color: '#fff', fontWeight: 600 } }, w.app.name), card);
      card.addEventListener('click', () => { box.classList.add('hidden'); this.open(w.id); });
      swipe(card, dir => { if (dir === 'up') { wrap.style.transition = '.2s'; wrap.style.transform = 'translateY(-120%)'; wrap.style.opacity = 0; setTimeout(() => { this.quit(w); wrap.remove(); if (!this.windows.length) this.recents(); }, 200); } });
      box.append(wrap);
    });
    box.classList.remove('hidden');
    $$('.win').forEach(e => e.classList.add('hidden'));
    $('#home').classList.add('away');
    box.onclick = e => { if (e.target === box) { box.classList.add('hidden'); this.goHome(); } };
  },

  // ---- sheets
  openSheet(which) {
    if (this.locked && which !== 'cc') return;
    this.closeSheets();
    if (which === 'cc') CC.render();
    if (which === 'nc') this.renderNC();
    if (which === 'rest') Rest.render();
    $('#' + which).classList.add('open');
    this.sheetAt = Date.now();
  },
  closeSheets() {
    $$('.sheet.open').forEach(s => s.classList.remove('open'));
    const m = $('#restmenu'); if (m) m.remove();
    const f = $('#rest input'); if (f) f.blur();
  },
  sheetOpen() { return $('.sheet.open'); },

  // ---- notifications
  notify(title, text, opts) {
    const n = Object.assign({ id: uid(), title, text, time: Date.now(), app: null }, opts || {});
    if (n.app && (S.notifOff || []).indexOf(n.app) >= 0) return n; // turned off in Settings > Notifications
    this.notes.unshift(n);
    this.notes = this.notes.slice(0, 50);
    if (!S.dnd) { this.toast(title + (text ? ': ' + text : '')); Phone.vibrate(60); }
    this.renderLockNotes();
    if ($('#nc').classList.contains('open')) this.renderNC();
    return n;
  },
  noteCard(n, android) {
    const app = android ? Apps.get('android:' + n.pkg) : (n.app && Apps.get(n.app));
    const ico = android ? h('img', { src: '/appicon/' + n.pkg, alt: '' }) : h('div', { class: 'ico', html: icon(n.glyph || 'bell') });
    if (app && !android && app.img) { ico.style.background = 'url(' + app.img + ') center/cover'; ico.innerHTML = ''; }
    const card = h('div', { class: 'note-card' }, ico,
      h('div', { class: 'body' }, h('div', { class: 't' }, h('b', { text: n.title || (app ? app.name : '') }), h('span', { text: Fmt.ago(n.time) })),
        n.text ? h('div', { class: 'x', text: n.text }) : null));
    card.addEventListener('click', () => {
      if (this.locked) { this.unlock(); return; }
      this.closeSheets();
      if (android) { Phone.openNotification(n.key); this.droidNotes = this.droidNotes.filter(x => x.key !== n.key); }
      else { this.notes = this.notes.filter(x => x !== n); if (n.app) this.open(n.app); }
      this.renderLockNotes();
    });
    swipe(card, dir => {
      if (dir !== 'left' && dir !== 'right') return;
      card.style.transition = '.2s'; card.style.transform = 'translateX(' + (dir === 'left' ? '-' : '') + '110%)';
      setTimeout(() => {
        if (android) { Phone.dismissNotification(n.key); this.droidNotes = this.droidNotes.filter(x => x.key !== n.key); }
        else this.notes = this.notes.filter(x => x !== n);
        card.remove(); this.renderLockNotes();
      }, 200);
    });
    return card;
  },
  renderNC() {
    const inner = $('#nc .inner');
    inner.innerHTML = '';
    const clear = h('button', { text: 'Clear all' });
    clear.onclick = () => { this.notes = []; Phone.clearNotifications(); this.droidNotes = this.droidNotes.filter(n => !n.clearable); this.renderNC(); this.renderLockNotes(); };
    inner.append(h('h2', null, 'Notifications', clear));
    const list = h('div', { class: 'list' });
    this.notes.forEach(n => list.append(this.noteCard(n, false)));
    this.droidNotes.forEach(n => list.append(this.noteCard(n, true)));
    if (!list.children.length) {
      const dev = json(Phone.device(), {});
      const e = h('div', { class: 'empty', html: 'No notifications' + (onPhone && !dev.notifAccess ? '<br><br>To see your phone\'s notifications here, turn on Notification access for Pets OS.' : '') });
      if (onPhone && !dev.notifAccess) { const b = h('button', { class: 'btn', text: 'Turn on access', style: { marginTop: '14px' } }); b.onclick = () => Phone.settings('notifications'); e.append(h('br'), b); }
      list.append(e);
    }
    inner.append(list);
  },
  renderLockNotes() {
    const box = $('#lock .notes');
    if (!box) return;
    box.innerHTML = '';
    this.notes.slice(0, 4).forEach(n => box.append(this.noteCard(n, false)));
    this.droidNotes.slice(0, Math.max(0, 5 - box.children.length)).forEach(n => box.append(this.noteCard(n, true)));
  },

  // ---- lock + passcode
  buildLock() {
    const lock = $('#lock');
    const q = $$('#lock .quick button');
    q[0].innerHTML = icon('flashlight'); q[1].innerHTML = icon('camera');
    if (isWeb) q[0].style.visibility = 'hidden';
    press(q[0], null, () => { CC.torch(!CC.torchOn); q[0].classList.toggle('on', CC.torchOn); }, 350);
    press(q[1], null, () => Phone.camera(), 350);
    swipe(lock, dir => { if (dir === 'up') this.unlock(); else if (dir === 'down') this.openSheet('cc'); }, {
      move: (dx, dy) => { if (dy < 0) { lock.style.transition = 'none'; lock.style.transform = 'translateY(' + dy * .6 + 'px)'; lock.style.opacity = 1 + dy / 900; } },
      min: 70
    });
    lock.addEventListener('touchend', () => { lock.style.transition = ''; if (!lock.classList.contains('gone')) { lock.style.transform = ''; lock.style.opacity = ''; } });
    lock.addEventListener('dblclick', () => this.unlock());
  },
  lock() {
    if (!S.setupDone) return;
    this.locked = true;
    $('#phone').classList.add('locked');
    Dialog.cancelAll();
    if ($('#restmenu')) $('#restmenu').remove();
    this.closeSheets();
    const lock = $('#lock');
    lock.style.transform = ''; lock.style.opacity = '';
    lock.classList.remove('gone');
    $('#pin').classList.add('hidden');
    this.tick();
    this.renderLockNotes();
    $$('#lock .quick button')[0].classList.toggle('on', CC.torchOn);
  },
  unlock() {
    if (S.pin) { this.showPin(); return; }
    this.finishUnlock();
  },
  finishUnlock() {
    this.locked = false;
    $('#phone').classList.remove('locked');
    const lock = $('#lock');
    lock.style.transform = ''; lock.style.opacity = '';
    lock.classList.add('gone');
    $('#pin').classList.add('hidden');
  },
  buildPin() {
    const keys = $('#pin .keys');
    const letters = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
    for (let i = 1; i <= 9; i++) keys.append(h('button', { 'data-k': i, html: i + '<small>' + letters[i - 1] + '</small>' }));
    keys.append(h('button', { class: 'plain', 'data-k': 'cancel', text: 'Cancel' }), h('button', { 'data-k': 0, text: '0' }), h('button', { class: 'plain', 'data-k': 'del', text: 'Delete' }));
    keys.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const k = b.getAttribute('data-k');
      if (k === 'cancel') { $('#pin').classList.add('hidden'); this.pinEntry = ''; return; }
      if (k === 'del') this.pinEntry = this.pinEntry.slice(0, -1);
      else if (this.pinEntry.length < 6) this.pinEntry += k;
      this.pinDots();
      if (this.pinEntry.length === S.pinLength) this.checkPin();
    });
    this.pinEntry = '';
    this.pinFails = 0;
  },
  showPin() {
    this.pinEntry = '';
    $('#pin .who span').textContent = S.name ? 'Hello ' + S.name : 'Enter passcode';
    $('#pin .msg').textContent = '';
    this.pinDots();
    $('#pin').classList.remove('hidden');
  },
  pinDots() {
    const d = $('#pin .dots'); d.innerHTML = '';
    for (let i = 0; i < (S.pinLength || 4); i++) d.append(h('i', { class: i < this.pinEntry.length ? 'on' : '' }));
  },
  hashPin(p, salt) { return Phone.sha256(salt + ':' + p); },
  checkPin() {
    const until = S.pinLockUntil || 0;
    if (Date.now() < until) { $('#pin .msg').textContent = 'Try again in ' + Math.ceil((until - Date.now()) / 1000) + ' s'; this.pinEntry = ''; this.pinDots(); return; }
    if (this.hashPin(this.pinEntry, S.salt) === S.pin) {
      this.pinFails = 0; S.pinLockUntil = 0; Store.save();
      this.finishUnlock();
    } else {
      this.pinFails++;
      Phone.vibrate(120);
      const dots = $('#pin .dots'); dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
      if (this.pinFails >= 5) { S.pinLockUntil = Date.now() + 30000; Store.save(); this.pinFails = 0; $('#pin .msg').textContent = 'Too many tries. Wait 30 seconds.'; }
      else $('#pin .msg').textContent = 'Wrong passcode';
    }
    this.pinEntry = '';
    setTimeout(() => this.pinDots(), 400);
  },
  setPin(p) {
    if (!p) { S.pin = null; S.salt = null; S.pinLength = 0; Store.save(); return; }
    S.salt = uid() + uid();
    S.pin = this.hashPin(p, S.salt);
    S.pinLength = p.length;
    Store.save();
  },

  // ---- global gestures and the Android back/home buttons
  gestures() {
    const home = $('#home');
    // The Home Screen moves sideways only: no swipe-up drawer. Rest opens from its Dock icon.
    swipe(home, (dir, d) => {
      if (this.editing) return;
      const W = window.innerWidth;
      if (dir === 'down') this.openSheet(d.sx > W * 0.6 && d.sy < 140 ? 'cc' : 'nc');
    }, { min: 60 });
    swipe($('#rest'), dir => { if (dir === 'down' && !$('#rest .all').scrollTop) this.closeSheets(); });
    swipe($('#cc'), dir => { if (dir === 'up') this.closeSheets(); });
    swipe($('#nc'), dir => { if (dir === 'up') this.closeSheets(); });
    // Ignore the click that follows the tap which opened the sheet.
    const bgClose = id => $('#' + id).addEventListener('click', e => { if (Date.now() - this.sheetAt > 450 && (e.target.id === id || e.target.classList.contains('inner'))) this.closeSheets(); });
    bgClose('cc'); bgClose('nc');
    // Status-bar pulls from anywhere (also over apps).
    swipe($('#status'), (dir, d) => { if (dir === 'down') this.openSheet(d.sx > window.innerWidth * 0.5 ? 'cc' : 'nc'); }, { min: 30 });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.back();
      if (e.key === 'Home') this.home();
    });
    // iPhone / browser: the browser's own Back (Safari's edge swipe, Chrome's back button) steps back
    // inside Pets OS. One spare history entry is kept while there is something to go back from; on the
    // first Home page with nothing open, Back is left to the browser.
    if (isWeb && window.history && history.pushState) {
      const arm = () => { if (!(history.state && history.state.pets)) history.pushState({ pets: 1 }, ''); };
      arm();
      window.addEventListener('popstate', () => { if (this.back()) arm(); });
      document.addEventListener('pointerdown', arm, true); // re-arm after the browser was allowed to leave
    }
  },
  // Back from anywhere: closes the top-most thing, or steps back one screen inside the app in front.
  // Returns false only when there was nothing to go back from (first Home page, nothing open).
  back() {
    const dlg = $('.dialog-bg');
    if (dlg) { const c = $('.dialog-cancel button', dlg); if (c) c.click(); if (dlg.isConnected) dlg.remove(); return true; }
    if ($('#restmenu')) { $('#restmenu').remove(); return true; }
    if (!$('#pin').classList.contains('hidden')) { $('#pin').classList.add('hidden'); return true; }
    if (this.locked) return true;
    if (this.sheetOpen()) { this.closeSheets(); return true; }
    if (!$('#recents').classList.contains('hidden')) { this.goHome(); return true; }
    if (this.editing) { this.setEditing(false); return true; }
    const w = this.front();
    if (w) { if (!w.back()) this.goHome(); return true; }
    if ($('#pages').scrollLeft > 0) { $('#pages').scrollTo({ left: 0, behavior: 'smooth' }); return true; }
    return false;
  },
  home() {
    if (this.locked) return;
    const atHome = !this.front() && !this.sheetOpen() && $('#recents').classList.contains('hidden');
    if (atHome) {
      if (this.editing) this.setEditing(false);
      else if ($('#pages').scrollLeft > 0) $('#pages').scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    this.goHome();
  },

  toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toast);
    this._toast = setTimeout(() => t.classList.remove('show'), 2600);
  }
};

// ---------------------------------------------------------------- app windows
class AppWindow {
  constructor(app) {
    this.app = app; this.id = app.id; this.stack = [];
    this.el = h('div', { class: 'win', 'data-app': app.id });
    this.header = h('header');
    this.titleEl = h('h1', { text: app.name });
    this.acts = h('div', { class: 'acts' });
    this.header.append(h('div', null, this.backEl = h('button', { class: 'back hidden' }), this.titleEl), this.acts);
    this.body = h('div', { class: 'body' });
    const bar = h('div', { class: 'homebar' }, h('i'));
    this.el.append(this.header, this.body, bar);
    this.backEl.onclick = () => this.back();
    // Home bar: flick up = home, slow drag and hold = recent apps.
    let holdT = null;
    swipe(bar, (dir, d) => {
      clearTimeout(holdT);
      // A hold that never moved calls Clarice; a slow swipe up opens the app switcher instead.
      const held = this.holdClarice; this.holdClarice = false;
      if (held && !dir && Math.abs(d.dy) < 12 && window.ClaricePanel) { this.el.style.transform = ''; ClaricePanel.open(); return; }
      this.el.style.transition = ''; this.el.style.transform = '';
      if (dir === 'up') { if (d.dt > 650 && Math.abs(d.dy) < 260) Shell.recents(); else Shell.goHome(); }
      else if (dir === 'left' || dir === 'right') Shell.switchApp(dir);
    }, {
      min: 30,
      start: () => { holdT = null; },
      move: (dx, dy) => { if (dy < 0) { this.el.style.transition = 'none'; const s = Math.max(.6, 1 + dy / 1000); this.el.style.transform = 'translateY(' + dy * .4 + 'px) scale(' + s + ')'; this.el.style.borderRadius = '30px'; } }
    });
    // Hold the home bar to call Clarice from inside any app (Stephone).
    press(bar, () => Shell.goHome(), () => { this.holdClarice = true; }, 600);
  }
  setTitle(t) { this.titleEl.textContent = t; }
  actions(list) {
    this.acts.innerHTML = '';
    (list || []).forEach(a => { const b = h('button', { html: a.icon ? icon(a.icon) : esc(a.label), 'aria-label': a.label || a.icon }); b.onclick = a.fn; this.acts.append(b); });
  }
  // push(): a sub-screen with its own back step, e.g. a note inside Pen.
  push(title, render, opts) {
    this.stack.push({ title: this.titleEl.textContent, scroll: this.body.scrollTop, render: this._render, acts: Array.from(this.acts.childNodes), onPop: opts && opts.onPop });
    this._render = render;
    this.backEl.classList.remove('hidden');
    this.backEl.innerHTML = icon('chevron-left') + esc(this.stack[this.stack.length - 1].title);
    this.setTitle(title);
    this.acts.innerHTML = '';
    this.body.innerHTML = ''; this.body.scrollTop = 0;
    render(this.body);
  }
  back() {
    if (this.onBack && this.onBack()) return true;
    const top = this.stack.pop();
    if (!top) return false;
    if (top.onPop) top.onPop();
    this._render = top.render;
    this.setTitle(top.title);
    this.acts.innerHTML = ''; top.acts.forEach(n => this.acts.append(n));
    this.body.innerHTML = '';
    if (top.render) top.render(this.body);
    this.body.scrollTop = top.scroll;
    if (!this.stack.length) this.backEl.classList.add('hidden');
    else this.backEl.innerHTML = icon('chevron-left') + esc(this.stack[this.stack.length - 1].title);
    return true;
  }
  root(render) {
    this.stack = [];
    this._render = render;
    this.backEl.classList.add('hidden');
    this.body.innerHTML = '';
    render(this.body);
  }
  refresh() { if (this._render) { const s = this.body.scrollTop; this.body.innerHTML = ''; this._render(this.body); this.body.scrollTop = s; } }
}
Shell.switchApp = function (dir) {
  if (this.windows.length < 2) return;
  const cur = this.front();
  const order = this.windows.slice();
  const i = order.indexOf(cur);
  const next = dir === 'right' ? order[(i - 1 + order.length) % order.length] : order[(i + 1) % order.length];
  if (next && next !== cur) { cur.el.classList.add('hidden'); this.open(next.id); }
};

// ---------------------------------------------------------------- dialogs
const Dialog = {
  // Cancel every open dialog the way its Cancel button would, so awaited answers resolve.
  cancelAll() {
    $$('.dialog-bg').forEach(bg => { const c = $('.dialog-cancel button', bg); if (c) c.click(); if (bg.isConnected) bg.remove(); });
  },
  show(content, opts) {
    const bg = h('div', { class: 'dialog-bg' });
    const box = h('div', { style: { width: '100%' } }, content);
    if (!opts || !opts.noCancel) {
      const c = h('div', { class: 'dialog dialog-cancel' }, h('div', { class: 'opts' }, h('button', { class: 'bold', text: 'Cancel', style: { borderTop: 0 } })));
      $('button', c).onclick = () => bg.remove();
      box.append(c);
    }
    bg.append(box);
    // The tap that opened the dialog also sends a click, which lands on this backdrop: ignore it.
    const shownAt = Date.now();
    bg.addEventListener('click', e => { if (e.target === bg && Date.now() - shownAt > 450) bg.remove(); });
    $('#phone').append(bg);
    return bg;
  },
  menu(title, text, options) {
    const d = h('div', { class: 'dialog' });
    if (title || text) d.append(h('div', { class: 'dh' }, title ? h('b', { text: title }) : null, text ? h('p', { text }) : null));
    const o = h('div', { class: 'opts' });
    let bg;
    options.forEach(opt => {
      const b = h('button', { class: opt.danger ? 'danger' : '', text: opt.label });
      b.onclick = () => { bg.remove(); opt.fn(); };
      o.append(b);
    });
    d.append(o);
    bg = this.show(d);
    return bg;
  },
  confirm(title, text, okLabel, danger) {
    return new Promise(res => {
      const bg = this.menu(title, text, [{ label: okLabel || 'OK', danger, fn: () => res(true) }]);
      $('.dialog-cancel button', bg).onclick = () => { bg.remove(); res(false); };
    });
  },
  prompt(title, text, value, opts) {
    return new Promise(res => {
      const f = h('input', { class: 'field', value: value || '', type: (opts && opts.type) || 'text', placeholder: (opts && opts.placeholder) || '', inputmode: (opts && opts.inputmode) || null, maxlength: (opts && opts.max) || null });
      const d = h('div', { class: 'dialog' }, h('div', { class: 'dh' }, h('b', { text: title }), text ? h('p', { text }) : null, f));
      const ok = h('button', { class: 'bold', text: (opts && opts.ok) || 'Done' });
      d.append(h('div', { class: 'opts' }, ok));
      const bg = this.show(d);
      const done = v => { bg.remove(); res(v); };
      ok.onclick = () => done(f.value);
      f.addEventListener('keydown', e => { if (e.key === 'Enter') done(f.value); });
      $('.dialog-cancel button', bg).onclick = () => done(null);
      setTimeout(() => f.focus(), 60);
    });
  }
};

// ---------------------------------------------------------------- Control Centre
const CC = {
  torchOn: false,
  torch(on) {
    if (!Phone.torch(on)) { Shell.toast('This phone has no torch'); return; }
    this.torchOn = on;
  },
  render() {
    const inner = $('#cc .inner');
    inner.innerHTML = '';
    const g = h('div', { class: 'grid' });
    const net = Phone.network();
    const b = json(Phone.battery(), {});
    const tile = (glyph, label, on, fn, cls, hold) => {
      const t = h('button', { class: 'cc-tile' + (on ? ' on' : '') + (cls ? ' ' + cls : ''), html: icon(glyph) + '<span>' + esc(label) + '</span>' });
      press(t, () => fn(t), hold);
      return t;
    };
    const wifi = h('button', { class: 'cc-tile wide' + (net === 'wifi' ? ' on accent' : ''), html: icon(net === 'wifi' ? 'wifi' : 'wifi-off') + '<div><b>Wi-Fi</b>' + (net === 'wifi' ? 'Connected' : net === 'cell' ? 'Using mobile data' : 'Not connected') + '</div>' });
    press(wifi, () => { if (Shell.locked) return; Shell.closeSheets(); Phone.settings('wifi'); });
    const bt = h('button', { class: 'cc-tile wide', html: icon('bluetooth') + '<div><b>Bluetooth</b>Settings</div>' });
    press(bt, () => { if (Shell.locked) return; Shell.closeSheets(); Phone.settings('bluetooth'); });
    if (!isWeb) g.append(wifi, bt);

    const bright = h('div', { class: 'slider' }, h('label', { text: 'Brightness' }), h('div', { class: 'fill' }));
    bright.insertAdjacentHTML('beforeend', icon('sun'));
    const setB = v => { $('.fill', bright).style.height = (v * 100) + '%'; };
    setB(S.brightness >= 0 ? S.brightness : Phone.systemBrightness());
    const drag = e => {
      const r = bright.getBoundingClientRect();
      const v = Math.max(0.02, Math.min(1, 1 - (e.clientY - r.top) / r.height));
      setB(v); Phone.brightness(v); S.brightness = v;
    };
    bright.addEventListener('pointerdown', e => { bright.setPointerCapture(e.pointerId); drag(e); bright.onpointermove = drag; });
    bright.addEventListener('pointerup', () => { bright.onpointermove = null; Store.save(); });
    if (!isWeb) g.append(bright);
    if (!isWeb) g.append(tile('flashlight', 'Torch', this.torchOn, t => { this.torch(!this.torchOn); t.classList.toggle('on', this.torchOn); }));
    g.append(tile(S.theme === 'dark' ? 'moon' : 'sun', S.theme === 'dark' ? 'Dark' : 'Light', S.theme === 'dark', () => { Settings.setTheme(S.theme === 'dark' ? 'light' : 'dark'); CC.render(); }));
    g.append(tile(S.dnd ? 'bell-off' : 'bell', 'Focus', S.dnd, t => { S.dnd = !S.dnd; Store.save(); t.classList.toggle('on', S.dnd); t.innerHTML = icon(S.dnd ? 'bell-off' : 'bell') + '<span>Focus</span>'; Shell.toast(S.dnd ? 'Focus on: Pets OS alerts are silent' : 'Focus off'); }, null, () => { if (Shell.locked) return; Shell.closeSheets(); Phone.settings('dnd'); }));
    if (Shell.locked) {
      // Nothing that opens an app or Android screen while locked: that would get past the passcode.
      if (!isWeb) g.append(tile(b.charging ? 'battery-charging' : 'battery-full', b.level == null ? '–' : b.level + '%', false, () => {}));
      if (isWeb) g.append(h('div', { class: 'cc-tile wide', html: icon('lock') + '<div><b>Locked</b>Unlock for more</div>' }));
      else bt.replaceWith(h('div', { class: 'cc-tile wide', html: icon('lock') + '<div><b>Locked</b>Unlock for more</div>' }));
      inner.append(g);
      return;
    }
    g.append(tile('lock', 'Lock', false, () => Shell.lock()));
    if (!isWeb) g.append(tile('plane', 'Airplane', false, () => { Shell.closeSheets(); Phone.settings('airplane'); }));
    g.append(tile('timer', 'Timer', false, () => { Shell.open('pets:clock'); Clock.show('timer'); }));
    g.append(tile('calculator', 'Calculator', false, () => Shell.open('pets:calculator')));
    g.append(tile('camera', 'Camera', false, () => { Shell.closeSheets(); Phone.camera(); }));
    const lvl = b.level == null ? '–' : b.level + '%';
    if (!isWeb) g.append(tile(b.charging ? 'battery-charging' : 'battery-full', lvl, false, () => { Shell.closeSheets(); Phone.settings('battery'); }));
    g.append(tile('music', 'Music', false, () => { Shell.closeSheets(); Phone.music() || Shell.toast('No music app found'); }));
    g.append(tile('settings', 'Settings', false, () => Shell.open('pets:settings')));
    if (!isWeb) g.append(tile('smartphone', 'Android', false, () => { Shell.closeSheets(); Phone.settings('main'); }));
    inner.append(g);
  }
};

// ---------------------------------------------------------------- Rest (app drawer)
const Rest = {
  cat: 'All',
  render() {
    const inner = $('#rest .inner');
    inner.innerHTML = '';
    const head = h('div', { class: 'head' }, h('img', { src: 'img/rest-fionn-desk.png', alt: '' }),
      h('div', null, h('h2', { text: 'Rest' }), h('p', { text: isWeb ? 'Every Pets OS app' : 'Every app on this phone' })));
    const field = h('input', { placeholder: 'Search apps', type: 'search', autocomplete: 'off' });
    const search = h('div', { class: 'search', html: icon('search') }, field);
    const cats = h('div', { class: 'cats' });
    (isWeb ? ['All', 'Recent'] : ['All', 'Pets OS', 'Android', 'Recent']).forEach(c => {
      const b = h('button', { class: c === this.cat ? 'on' : '', text: c });
      b.onclick = () => { this.cat = c; $$('button', cats).forEach(x => x.classList.toggle('on', x === b)); this.fill(all, field.value); };
      cats.append(b);
    });
    const all = h('div', { class: 'all' });
    field.addEventListener('input', () => this.fill(all, field.value));
    field.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const first = $('.app', all);
      if (first) first.dispatchEvent(new Event('pointerdown')), first.dispatchEvent(new Event('pointerup'));
      else if (field.value.trim() && Rest.noMatch) Rest.noMatch(field.value.trim());
      else if (field.value.trim()) { Shell.closeSheets(); Phone.openUrl('https://search.brave.com/search?q=' + encodeURIComponent(field.value.trim())); }
    });
    inner.append(head, search, cats, all);
    this.fill(all, '');
  },
  fill(box, q) {
    box.innerHTML = '';
    q = (q || '').trim().toLowerCase();
    let list = Apps.all();
    if (this.cat === 'Pets OS') list = list.filter(a => !a.android);
    if (this.cat === 'Android') list = list.filter(a => a.android);
    if (this.cat === 'Recent') list = S.recentApps.map(id => Apps.get(id)).filter(Boolean);
    if (q) list = list.filter(a => a.name.toLowerCase().includes(q) || (a.keywords || '').includes(q));
    else if (this.cat !== 'Recent') list.sort((a, b) => a.name.localeCompare(b.name));
    let letter = '';
    list.forEach(a => {
      if (!q && this.cat !== 'Recent') {
        const L = /[a-z]/i.test(a.name[0]) ? a.name[0].toUpperCase() : '#';
        if (L !== letter) { letter = L; box.append(h('div', { class: 'sect', text: L })); }
      }
      const el = h('div', { class: 'app', 'data-id': a.id }, Apps.tile(a), h('div', { class: 'name', text: a.short || a.name }));
      press(el, () => Shell.open(a.id, el), () => this.menu(a));
      box.append(el);
    });
    if (!list.length) box.append(h('div', { class: 'sect', style: { textTransform: 'none', height: 'auto', lineHeight: 1.5 }, text: q ? 'No apps match "' + q + '". Press Enter to search the web with Milo.' : 'Nothing here yet.' }));
  },
  menu(a) {
    const onHome = S.home.some(p => p.indexOf(a.id) >= 0) || S.dock.indexOf(a.id) >= 0;
    const opts = [];
    if (!onHome) opts.push({ label: 'Add to Home Screen', fn: () => { let last = S.home[S.home.length - 1]; if (last.length >= 24) { last = []; S.home.push(last); } last.push(a.id); Store.save(); Shell.buildHome(); Shell.toast(a.name + ' added to Home'); } });
    if (a.android) {
      opts.push({ label: 'App Info', fn: () => Phone.appInfo(a.pkg) });
      opts.push({ label: 'Uninstall', danger: true, fn: () => Phone.uninstall(a.pkg) });
    }
    if (!opts.length) opts.push({ label: 'Open', fn: () => Shell.open(a.id) });
    Dialog.menu(a.name, onHome ? 'On your Home Screen' : null, opts);
  }
};

// ---------------------------------------------------------------- home widgets
const Widgets = {
  make(id) {
    if (id === 'widget:today') {
      const w = h('div', { class: 'widget wide widget-today', style: { gridColumn: '1 / -1', gridRow: 'span 2', margin: '0 6px 8px' } });
      this.today(w);
      press(w, () => Shell.open('pets:calendar'));
      return w;
    }
    return null;
  },
  today(w) {
    const d = new Date();
    const wx = Store.app('weather.last', null);
    const next = window.Calendar ? Calendar.next() : null;
    const act = window.Activities ? Activities.current() : null;
    w.innerHTML = '';
    const parts = [
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
        h('div', null, h('h4', { text: d.toLocaleDateString(undefined, { weekday: 'long' }) }), h('div', { class: 'big', text: d.getDate() + ' ' + d.toLocaleDateString(undefined, { month: 'long' }) })),
        wx ? h('div', { style: { textAlign: 'right' } }, h('div', { class: 'big', text: Math.round(wx.temp) + '°' }), h('div', { class: 'muted', text: wx.place + ' · ' + wx.desc })) : h('div', { class: 'muted', text: 'Add your town in Skycast', style: { textAlign: 'right', maxWidth: '40%' } })),
      h('div', { class: 'row', style: { marginTop: '8px', borderTop: '1px solid var(--line)', paddingTop: '9px' } },
        h('span', { html: icon('calendar') }), h('span', { style: { flex: 1, marginLeft: '8px' }, text: next ? next.title : 'No upcoming events' }), h('span', { class: 'muted', text: next ? next.when : '' })),
      act ? h('div', { class: 'row' }, h('span', { html: icon('heart') }), h('span', { style: { flex: 1, marginLeft: '8px' }, text: act.name + ' in progress' }), h('span', { class: 'muted', text: Fmt.dur(Date.now() - act.start) })) : null
    ];
    w.append(...parts.filter(Boolean));
  }
};

// ---------------------------------------------------------------- first-run setup
const Setup = {
  step: 0,
  show() { $('#setup').classList.remove('hidden'); this.step = 0; this.render(); },
  render() {
    const box = $('#setup');
    box.innerHTML = '';
    const dots = h('div', { class: 'step-dots' }, [0, 1, 2, 3].map(i => h('i', { class: i <= this.step ? 'on' : '' })));
    const next = h('button', { class: 'btn block', text: 'Continue' });
    if (this.step === 0) {
      box.append(h('div', { class: 'logo' }), dots, h('h1', { text: 'Welcome to Pets OS' }),
        h('p', { text: isWeb ? 'Pets OS on your iPhone: Rest holds every Pets OS app, Clarice helps you out, and your notes, photos and plans stay on this phone.' : 'Pets OS is now your phone\'s home. Rest holds every app, Clarice helps you out, and your Android apps keep working.' }),
        h('div', { class: 'grow' }), next);
      next.onclick = () => { this.step = 1; this.render(); };
    } else if (this.step === 1) {
      const f = h('input', { class: 'field', placeholder: 'Your name', value: S.name, maxlength: 40, autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', autocapitalize: 'words' });
      box.append(dots, h('h1', { text: 'What\'s your name?' }), h('p', { text: 'Pets OS uses it on the lock screen and in Clarice.' }), f, h('div', { class: 'grow' }), next);
      next.onclick = () => { S.name = f.value.trim(); Store.save(); this.step = 2; this.render(); };
      f.addEventListener('keydown', e => { if (e.key === 'Enter') next.onclick(); });
      setTimeout(() => f.focus(), 100);
    } else if (this.step === 2) {
      const f = h('input', { class: 'field', placeholder: '4 to 6 digits', type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: 'off' });
      const f2 = h('input', { class: 'field', placeholder: 'Type it again', type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: 'off' });
      const msg = h('p', { style: { color: '#ffd6d8', minHeight: '20px' } });
      const skip = h('button', { class: 'link', text: 'Skip for now' });
      box.append(dots, h('h1', { text: 'Set a passcode' }), h('p', { text: 'You\'ll enter it on the Pets OS lock screen. It is stored only as a salted hash on this phone.' }), f, f2, msg, h('div', { class: 'grow' }), next, skip);
      next.onclick = () => {
        const p = f.value;
        if (!/^\d{4,6}$/.test(p)) { msg.textContent = 'Use 4 to 6 digits.'; return; }
        if (p !== f2.value) { msg.textContent = 'The two passcodes don\'t match.'; return; }
        Shell.setPin(p); this.step = 3; this.render();
      };
      skip.onclick = () => { Shell.setPin(null); this.step = 3; this.render(); };
      f.addEventListener('keydown', e => { if (e.key === 'Enter') f2.focus(); });
      f2.addEventListener('keydown', e => { if (e.key === 'Enter') next.onclick(); });
      setTimeout(() => f.focus(), 100);
    } else if (isWeb) {
      const installed = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
      box.append(dots, h('h1', { text: installed ? 'All set' : 'Add Pets OS to your Home Screen' }),
        h('p', { text: installed ? 'Pets OS opens full screen from its Home Screen icon.' : 'In Safari, tap the Share button, then "Add to Home Screen". Pets OS then opens full screen from its own icon, and works offline.' }),
        h('div', { class: 'grow' }), next);
      next.textContent = 'Start using Pets OS';
      next.onclick = () => { S.setupDone = true; Store.save(); $('#setup').classList.add('hidden'); Shell.toast('Welcome' + (S.name ? ', ' + S.name : '') + '!'); };
    } else {
      const dev = json(Phone.device(), {});
      const homeBtn = h('div', { class: 'opt', html: icon('house') + '<div class="grow">Make Pets OS your home app<small>' + (dev.defaultHome ? 'Done' : 'Then the Home button always brings you here') + '</small></div>' });
      press(homeBtn, () => Phone.askToBeHome());
      const notifBtn = h('div', { class: 'opt', html: icon('bell') + '<div class="grow">Show notifications in Pets OS<small>' + (dev.notifAccess ? 'Done' : 'Allow Notification access for Pets OS') + '</small></div>' });
      press(notifBtn, () => Phone.settings('notifications'));
      box.append(dots, h('h1', { text: 'Last thing' }), h('p', { text: 'Two Android switches let Pets OS take over properly. You can do them now or later in Settings.' }), homeBtn, notifBtn, h('div', { class: 'grow' }), next);
      next.textContent = 'Start using Pets OS';
      next.onclick = () => {
        S.setupDone = true; Store.save(); $('#setup').classList.add('hidden'); Shell.toast('Welcome' + (S.name ? ', ' + S.name : '') + '!');
        if (!json(Phone.device(), {}).defaultHome) setTimeout(() => Phone.askToBeHome(), 600);
      };
    }
  }
};

// ---------------------------------------------------------------- software updates
const Updates = {
  last: null, waiters: [],
  check() { return new Promise(res => { this.waiters.push(res); Phone.checkUpdate(); }); },
  // Once a day, quietly, after Pets OS has started.
  daily() {
    if (Date.now() - (S.lastUpdateCheck || 0) < 864e5) return;
    S.lastUpdateCheck = Date.now(); Store.save();
    this.check();
  }
};

// ---------------------------------------------------------------- native events
window.PetsOS = {
  start: () => Shell.start(),
  // Answer to Phone.checkUpdate(): latest.json from shouldbe.media plus currentCode.
  updateInfo(text) {
    const u = json(text, { error: 'bad answer' });
    Updates.last = u;
    if (!u.error && u.versionCode > u.currentCode && S.notifiedUpdate !== u.versionCode) {
      S.notifiedUpdate = u.versionCode; Store.save();
      Shell.notify('Pets OS ' + u.version + ' is available', 'Open Settings, then Software Update.', { app: 'pets:settings', glyph: 'download' });
    }
    Updates.waiters.splice(0).forEach(f => f(u));
  },
  native(ev) {
    switch (ev) {
      case 'back': Shell.back(); break;
      case 'home': Shell.home(); break;
      case 'screen-off': Shell.lock(); break;
      case 'battery': Shell.battery(); break;
      case 'apps': Shell.syncAndroid(); if ($('#rest').classList.contains('open')) Rest.render(); break;
      case 'resume': Shell.syncAndroid(); Shell.pollPhone(); if (Setup.step === 3 && !S.setupDone) Setup.render(); { const w = Shell.front(); if (w && w.onShow) w.onShow(); } break;
      case 'pause': break;
      case 'storage': { const w = Shell.front(); if (w && w.id === 'pets:files') w.refresh(); } break;
    }
  }
};
