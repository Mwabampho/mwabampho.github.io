// StepOS app suite for Pets OS for Stephone (2026-11-02).
//   - Suite.CATALOG: the 31 phone functions in the owner's order (Camera first, Calculator last), each with
//     its StepOS app name, the familiar function name search also finds it by, the permissions it uses and
//     what it needs to work. Existing apps keep their ids (so their data stays) and take the StepOS names.
//   - StepIcon: one original, consistent icon family for every app (vector, sharp at 3x).
//   - Home Screen: new apps are added after the owner's own pages, in catalogue order (pages stay horizontal).
//   - Settings › Apps: every app, its version, source, permissions (live status) and notifications.
//   - O Store › Included with Pets OS: the catalogue in order with description, version and status.
'use strict';

// Old Android WebViews (Chrome < 84) have no flex gap; stepos.css spaces things with margins there.
(() => { const f = document.createElement('div'); f.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden'; f.append(document.createElement('div'), document.createElement('div')); document.documentElement.append(f); const ok = f.scrollHeight === 1; f.remove(); if (!ok) document.documentElement.classList.add('no-flexgap'); })();

// ================================================================ extra line glyphs (24 grid, Lucide style)
Object.assign(ICONS, {
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-4v12l-6-4"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  navigation: '<path d="M3 11 22 2l-9 19-2-8z"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  wallet: '<rect x="2" y="5" width="20" height="15" rx="2"/><path d="M2 10h20"/><path d="M16 15h2"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="M12 12 18 6"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  languages: '<path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c-1 4-4 7-7 8"/><path d="m13 21 4-9 4 9M14.5 18h5"/>',
  accessibility: '<circle cx="12" cy="4" r="1.6"/><path d="M5 8h14M12 8v6M12 14l-4 7M12 14l4 7"/>',
  'life-buoy': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>',
  'list-checks': '<path d="m3 6 2 2 4-4M3 14l2 2 4-4"/><path d="M13 6h8M13 14h8M13 20h8"/>',
  'square-check': '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
  square0: '<rect x="3" y="3" width="18" height="18" rx="3"/>',
  record: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  'folder-plus': '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13h6"/>',
  'rotate-cw': '<path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.7L21 8"/><path d="M21 3v5h-5"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  'external-link': '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  'zoom-in': '<circle cx="11" cy="11" r="7"/><path d="m21 21-5-5M11 8v6M8 11h6"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  shield2: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  sos: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.01"/>',
  'hand-coins': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 15h4"/>',
  'sliders-v': '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'
});

// ================================================================ the catalogue (owner's order)
const Suite = {
  version: 1,
  // n, StepOS name, familiar function, app id, words search should also find, permissions, short description
  CATALOG: [
    [1, 'Shutter', 'Camera', 'pets:camera', 'camera photo picture video record selfie', ['camera', 'mic'], 'Photos and video with the phone cameras, then straight to Moments.'],
    [2, 'Moments', 'Photos', 'pets:moments', 'photos gallery pictures albums images edit', [], 'Browse, search and organise photos and videos in albums. Edits are saved as copies.'],
    [3, 'Calla', 'Phone', 'pets:phone', 'phone call dial dialler keypad recents', ['call'], 'Keypad, favourites and call history. Calls need a SIM and the phone hardware.'],
    [4, 'Kinbook', 'Contacts', 'pets:contacts', 'contacts people address book vcard numbers', ['contacts'], 'Your contacts, with vCard import and export.'],
    [5, 'Relay', 'Messages', 'pets:messages', 'messages sms text texting chat', ['sms'], 'Text messages. It says plainly when this device can\'t send them.'],
    [6, 'StepMail', 'Email', 'pets:stepmail', 'email mail inbox', [], 'Mail accounts, inbox, folders, drafts, attachments and search.'],
    [7, 'Lenda', 'Calendar', 'pets:lenda', 'calendar events diary schedule reminders', [], 'Events, reminders, repeating events and calendars.'],
    [8, 'Milo', 'Browser', 'pets:milo', 'browser web internet search tabs bookmarks', [], 'Tabs, search, bookmarks, history and privacy controls.'],
    [9, 'Atlas', 'Maps', 'pets:atlas', 'maps map directions route navigation places location', ['location'], 'Search places and plan routes on OpenStreetMap. Needs the internet.'],
    [10, 'Skycast', 'Weather', 'pets:weather', 'weather forecast rain temperature', ['location'], 'Current conditions and 7-day forecasts from Open-Meteo, with the time they were measured.'],
    [11, 'Timewell', 'Clock', 'pets:clock', 'clock alarm timer stopwatch world time', ['notifications'], 'Alarms, timers, stopwatch and world clock.'],
    [12, 'Burrow', 'Files', 'pets:files', 'files folders storage documents', ['storage'], 'Browse, preview, move, rename and organise files.'],
    [13, 'O Store', 'App Store', 'pets:ostore', 'app store apps download install update', [], 'Discover, install, update and remove apps from the signed Pets OS catalogue.'],
    [14, 'Settings', 'Settings', 'pets:settings', 'settings preferences system', [], 'Display, sound, connections, battery, privacy, notifications, apps, storage and updates.'],
    [15, 'Pocket Notes', 'Notes', 'pets:pen', 'notes note write checklist folders', [], 'Searchable notes and checklists in folders, saved as you type.'],
    [16, 'Nudge', 'Reminders', 'pets:nudge', 'reminders tasks to do todo lists due', ['notifications'], 'Lists, due dates, repeats and reminders.'],
    [17, 'Sonix', 'Music', 'pets:sonix', 'music songs player playlists audio', [], 'Play music, make playlists and see what\'s playing.'],
    [18, 'Screenroom', 'Videos', 'pets:screenroom', 'video player movies films watch', [], 'Play videos from this phone and carry on where you stopped.'],
    [19, 'Voice Pin', 'Voice Recorder', 'pets:voicepin', 'voice recorder record audio memo microphone', ['mic'], 'Record, label, play and export voice recordings.'],
    [20, 'PocketPay', 'Wallet', 'pets:pocketpay', 'wallet pay payment cards passes loyalty', [], 'Loyalty and membership cards. Payments only with a supported provider.'],
    [21, 'Beacon', 'Find My Device', 'pets:beacon', 'find my device lost phone locate', ['location'], 'Where this phone is now, and what remote finding needs.'],
    [22, 'Clarice', 'Assistant', 'pets:clarice', 'assistant ai help ask aida', [], 'Your Pets OS assistant for questions and phone tasks.'],
    [23, 'Dropzone', 'Downloads', 'pets:dropzone', 'downloads download saved files', ['storage'], 'Active, finished and failed downloads; open, share or delete them.'],
    [24, 'Scanwise', 'Scanner', 'pets:scanwise', 'scanner scan qr code barcode document', ['camera'], 'Scan QR codes and documents, and check the result before using it.'],
    [25, 'Lingua', 'Translate', 'pets:lingua', 'translate translation language', [], 'Translate typed text with the MyMemory service. Needs the internet.'],
    [26, 'Assist', 'Accessibility', 'pets:assist', 'accessibility text size contrast magnifier read aloud', [], 'Text size, bold text, contrast, magnifier, reduce motion and read aloud.'],
    [27, 'SafeLine', 'Emergency', 'pets:safeline', 'emergency sos 999 112 911 medical id', ['call'], 'Emergency numbers for your region and your medical information.'],
    [28, 'Step Update', 'Software Update', 'pets:stepupdate', 'software update system update version', [], 'Check for, download and install signed Pets OS updates.'],
    [29, 'Capture', 'Screen Recorder', 'pets:capture', 'screen recording recorder record screen', [], 'Record the screen where the device allows it.'],
    [30, 'Torch', 'Flashlight', 'pets:torch', 'torch flashlight light lamp', [], 'Turn the phone light on and off.'],
    [31, 'QuickCalc', 'Calculator', 'pets:calculator', 'calculator maths sum scientific', [], 'Basic and scientific calculator with history.']
  ].map(([n, name, fn, id, words, perms, desc]) => ({ n, name, fn, id, words, perms, desc })),
  // Real Pets OS apps that aren't in the 31 but stay (with what they are for).
  EXTRAS: [
    ['pets:rest', 'Every app on the phone, searchable (the Dock\'s first icon).'],
    ['pets:pip', 'Your Pets OS pet.'],
    ['pets:activities', 'Log showers, meals, sleep, runs and boxing.'],
    ['pets:capsule', 'Write to your future self.'],
    ['pets:calendar', 'Quick events for the Today widget and lock screen. Lenda is the full calendar.'],
    ['pets:syncro', 'The owner\'s Syncro (owner builds only).']
  ],
  PERM: {
    camera: ['Camera', 'camera'], mic: ['Microphone', 'mic'], call: ['Phone calls', 'call'], contacts: ['Contacts', 'contacts'],
    sms: ['Send texts', 'sms'], location: ['Location', 'location'], notifications: ['Notifications', 'notifications'], storage: ['Files and storage', 'storage']
  },
  entry(id) { return this.CATALOG.find(c => c.id === id) || (id === 'store:milo' ? this.CATALOG.find(c => c.id === 'pets:milo') : null); },
  // Ids the catalogue shows (Milo from the O Store replaces the built-in one when installed).
  liveId(c) { return c.id === 'pets:milo' && Apps.builtin['store:milo'] ? 'store:milo' : c.id; },
  available(c) { return !!Apps.get(this.liveId(c)); }
};

// Names, keywords and short names for the existing apps; ids stay so notes, photos and settings are kept.
Suite.CATALOG.forEach(c => {
  const a = Apps.builtin[c.id]; if (!a) return;
  if (a.name !== c.name) a.oldName = a.name;
  a.keywords = (a.keywords || '') + (a.oldName ? ' ' + a.oldName : '');
  a.name = c.name; a.fn = c.fn; a.desc = c.desc;
  a.keywords = ((a.keywords || '') + ' ' + c.fn + ' ' + c.words).toLowerCase();
});
if (Apps.builtin['pets:calendar']) { Apps.builtin['pets:calendar'].name = 'Agenda'; Apps.builtin['pets:calendar'].keywords += ' agenda today events'; }
// The old "hand to Android" shortcuts follow the new names too.
[['sys:phone', 'Calla'], ['sys:messages', 'Relay'], ['sys:camera', 'Shutter'], ['sys:contacts', 'Kinbook']].forEach(([id, n]) => { if (Apps.builtin[id]) Apps.builtin[id].name = n; });
// Milo opens its own start page: from the O Store when installed, Android's Milo browser on the phone,
// and a built-in start page in a browser/iPhone (sites then open in a new tab, which it says).
if (Apps.builtin['pets:milo']) {
  const milo = Apps.builtin['pets:milo'];
  Object.defineProperty(milo, 'hiddenFromRest', { get: () => !!Apps.builtin['store:milo'], configurable: true });
  milo.launch = () => {
    if (Apps.builtin['store:milo']) { Shell.open('store:milo'); return true; }
    if (onPhone) { Phone.openUrl(''); return true; }
    return false; // falls through to the start page window below
  };
  milo.open = w => MiloStart.open(w);
}
// Shell.open: a launch() that returns false means "open my window instead".
(orig => { Shell.open = function (id, fromEl) {
  const app = Apps.get(id);
  if (app && app.launch && app.open) {
    if (app.launch() !== false) { this.closeSheets(); S.recentApps = [id].concat(S.recentApps.filter(x => x !== id)).slice(0, 12); Store.save(); return; }
    const l = app.launch; app.launch = null;
    try { return orig.call(this, id, fromEl); } finally { app.launch = l; }
  }
  return orig.call(this, id, fromEl);
}; })(Shell.open);

const MiloStart = {
  data() { return Store.app('milo.start', { bookmarks: [{ title: 'Should Be Media', url: 'https://shouldbe.media' }, { title: 'Wikipedia', url: 'https://en.wikipedia.org' }], history: [], privateMode: false }); },
  save(d) { Store.setApp('milo.start', d); },
  url(q) {
    q = String(q || '').trim(); if (!q) return null;
    if (/^https?:\/\//i.test(q)) return q;
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(q)) return 'https://' + q;
    return 'https://search.brave.com/search?q=' + encodeURIComponent(q);
  },
  go(q) {
    const u = this.url(q); if (!u) return;
    const d = this.data();
    if (!d.privateMode) { d.history = [{ url: u, at: Date.now() }].concat(d.history.filter(x => x.url !== u)).slice(0, 100); this.save(d); }
    Phone.openExternal(u);
  },
  open(w) {
    w.root(body => {
      const d = this.data();
      body.append(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-t', text: 'Milo' }), h('div', { class: 'st-hero-s', text: 'Search the web or type an address' })));
      const f = h('input', { class: 'field', type: 'search', placeholder: 'Search or enter address', enterkeyhint: 'go', autocapitalize: 'off', autocorrect: 'off', 'aria-label': 'Search or enter address' });
      f.addEventListener('keydown', e => { if (e.key === 'Enter') { this.go(f.value); f.value = ''; w.refresh(); } });
      body.append(f, h('p', { class: 'set-note', text: 'On this device websites open in a new browser tab. On a Stephone they open in Milo\'s own browser with tabs.' }));
      const card = (title, items, empty) => {
        body.append(h('div', { class: 'label', text: title }));
        const c = h('div', { class: 'card' });
        if (!items.length) c.append(h('div', { class: 'row' }, h('div', { class: 'grow sub', text: empty })));
        items.forEach(it => c.append(it));
        body.append(c);
      };
      card('Bookmarks', d.bookmarks.map((b, i) => {
        const r = h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: '#2c5d92' }, html: icon('star') }), h('div', { class: 'grow' }, h('div', { text: b.title }), h('div', { class: 'sub', text: b.url })));
        press(r, () => this.go(b.url), () => Dialog.menu(b.title, b.url, [{ label: 'Remove bookmark', danger: true, fn: () => { d.bookmarks.splice(i, 1); this.save(d); w.refresh(); } }]));
        return r;
      }), 'No bookmarks yet');
      const add = h('button', { class: 'btn block secondary', text: 'Add a bookmark' });
      add.onclick = async () => { const u = await Dialog.prompt('Add a bookmark', 'Address', 'https://'); const url = this.url(u); if (!url) return; d.bookmarks.push({ title: url.replace(/^https?:\/\//, '').split('/')[0], url }); this.save(d); w.refresh(); };
      body.append(add);
      card('History', d.history.slice(0, 15).map(x => { const r = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { text: x.url.replace(/^https?:\/\//, '') }), h('div', { class: 'sub', text: Fmt.ago(x.at) }))); press(r, () => this.go(x.url)); return r; }), d.privateMode ? 'Private browsing is on: nothing is saved' : 'No history yet');
      body.append(h('div', { class: 'label', text: 'Privacy' }));
      body.append(h('div', { class: 'card' }, Ui.toggleRow('Private browsing', 'Don\'t keep history', d.privateMode, v => { d.privateMode = v; this.save(d); }),
        Ui.row('Clear history', null, async () => { if (await Dialog.confirm('Clear Milo history?', null, 'Clear', true)) { d.history = []; this.save(d); w.refresh(); } })));
    });
  }
};

// ================================================================ shared UI helpers for the suite
const Ui = {
  row(title, sub, fn, opts) {
    opts = opts || {};
    const r = h('div', { class: 'row' }, opts.glyph ? h('div', { class: 'sq', style: { background: opts.colour || '#4a5162' }, html: icon(opts.glyph) }) : null,
      h('div', { class: 'grow' }, h('div', { text: title, style: opts.danger ? { color: 'var(--danger)' } : null }), sub ? h('div', { class: 'sub', text: sub }) : null),
      opts.val != null ? h('span', { class: 'val', text: opts.val }) : null, fn && !opts.noChev ? h('span', { class: 'chev', html: icon('chevron-right') }) : null);
    if (fn) { press(r, fn); r.setAttribute('role', 'button'); r.tabIndex = 0; r.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); }); }
    return r;
  },
  toggleRow(title, sub, on, fn) {
    const t = h('div', { class: 'toggle' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': title });
    const r = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { text: title }), sub ? h('div', { class: 'sub', text: sub }) : null), t);
    press(r, () => { const v = !t.classList.contains('on'); t.classList.toggle('on', v); t.setAttribute('aria-checked', v ? 'true' : 'false'); fn(v); });
    return r;
  },
  card(...rows) { return h('div', { class: 'card' }, ...rows.filter(Boolean)); },
  label(t) { return h('div', { class: 'label', text: t }); },
  note(t) { return h('p', { class: 'set-note', text: t }); },
  btn(label, fn, cls) { const b = h('button', { class: 'btn block ' + (cls || ''), html: label }); b.onclick = fn; return b; },
  empty(glyph, title, sub) { return h('div', { class: 'empty-state', html: icon(glyph) + '<br>' + esc(title) + (sub ? '<br><small>' + esc(sub) + '</small>' : '') }); },
  // A clear "this needs something this device doesn't have" panel (never a fake result).
  unavailable(glyph, title, why, needs) {
    return h('div', { class: 'st-unavail' }, h('div', { class: 'st-unavail-i', html: icon(glyph) }), h('b', { text: title }), h('p', { text: why }),
      needs ? h('p', { class: 'st-needs', text: 'Needs: ' + needs }) : null);
  },
  seg(options, cur, fn) {
    const s = h('div', { class: 'seg', role: 'tablist' });
    options.forEach(([v, t]) => { const b = h('button', { class: v === cur ? 'on' : '', text: t, role: 'tab', 'aria-selected': v === cur ? 'true' : 'false' }); b.onclick = () => fn(v); s.append(b); });
    return s;
  },
  // Files made in Pets OS: on the phone they go to Download/Pets OS; in a browser the browser downloads them.
  async saveFile(blob, name) {
    if (onPhone && Phone.saveDownload) {
      const b64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => res(''); r.readAsDataURL(blob); });
      const path = Phone.saveDownload(name, blob.type || 'application/octet-stream', b64);
      if (path) { Downloads.record({ name, size: blob.size, type: blob.type, path, from: 'Pets OS' }); Shell.toast('Saved to ' + path); return path; }
      Shell.toast('Couldn\'t save ' + name); return '';
    }
    const u = URL.createObjectURL(blob);
    const a = h('a', { href: u, download: name, style: { display: 'none' } });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    Downloads.record({ name, size: blob.size, type: blob.type, path: 'Browser downloads', from: 'Pets OS' });
    Shell.toast(name + ' saved to your downloads');
    return name;
  }
};
// Permissions: on the phone Android asks; in a browser the browser asks when the feature is first used.
const Need = {
  async ask(kind) {
    if (!onPhone) return true;
    if (kind === 'storage') return Phone.storageAllowed();
    if (Perm.has(kind)) return true;
    return Perm.ask(kind);
  },
  status(kind) {
    if (kind === 'storage') return onPhone ? (Phone.storageAllowed() ? 'Allowed' : 'Not allowed') : 'Asked by the browser';
    if (!onPhone) return 'Asked by the browser when used';
    if (kind === 'notifications' && !Phone.hasPermission('notifications')) return 'Allowed (or not needed on this Android)';
    return Perm.has(kind) ? 'Allowed' : 'Not allowed yet';
  }
};
// System notifications when Pets OS isn't on screen (Android), as well as the in-OS banner.
(orig => { Shell.notify = function (title, text, opts) {
  const n = orig.call(this, title, text, opts);
  if (onPhone && Phone.postNotification && (document.hidden || (opts && opts.system)) && !((S.notifOff || []).indexOf(n.app) >= 0)) Phone.postNotification(n.id, title, text || '');
  return n;
}; })(Shell.notify);

// ================================================================ StepIcon: the StepOS icon family
// Every icon: a deep two-tone field, the StepOS "step" facet in the lower right, one white line glyph at a
// single stroke weight and one accent colour. Original artwork, drawn here; nothing is copied.
const StepIcon = {
  n: 0,
  uid() { return 'si' + (++this.n); },
  L: 'fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"',
  F: c => 'fill="' + c + '"',
  base(a, b, glyph) {
    const g = this.uid();
    return '<svg class="hd st-icon" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="' + g + '" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>' +
      '<rect width="120" height="120" fill="url(#' + g + ')"/><path d="M120 78H104V94H88V110H72V120H120Z" fill="#fff" opacity=".07"/>' +
      '<rect x="1" y="1" width="118" height="118" rx="26" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="2"/>' + glyph + '</svg>';
  },
  draw(id) {
    const L = this.L, F = this.F, d = this.defs[id];
    return d ? this.base(d[0], d[1], d[2](L, F)) : null;
  },
  has(id) { return !!this.defs[id]; },
  defs: {
    'pets:camera': ['#3a3d46', '#1b1d22', (L, F) => '<rect x="22" y="40" width="76" height="50" rx="13" ' + L + '/><path d="M45 40l5-9h20l5 9" ' + L + '/><circle cx="60" cy="65" r="14" ' + L + '/><circle cx="60" cy="65" r="5.5" ' + F('#ffb547') + '/><circle cx="86" cy="51" r="3.5" fill="#fff"/>'],
    'pets:moments': ['#4a3a7d', '#241b45', (L, F) => '<rect x="34" y="26" width="56" height="44" rx="9" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="5"/><rect x="26" y="38" width="62" height="52" rx="10" ' + L + '/><path d="M32 82l15-17 11 11 8-8 16 14" ' + L + '/><circle cx="72" cy="54" r="6" ' + F('#ff8a7a') + '/>'],
    'pets:phone': ['#16735a', '#0b3e31', (L, F) => '<path transform="translate(25 27) scale(2.6)" d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/><path d="M72 30a20 20 0 0 1 18 18M71 42a9 9 0 0 1 7 7" fill="none" stroke="#8ff0c8" stroke-width="5.5" stroke-linecap="round"/>'],
    'pets:contacts': ['#4b5466', '#262b36', (L, F) => '<rect x="30" y="24" width="56" height="72" rx="11" ' + L + '/><circle cx="58" cy="52" r="10" ' + L + '/><path d="M42 80c3-10 29-10 32 0" ' + L + '/><rect x="90" y="36" width="8" height="14" rx="4" ' + F('#f0c987') + '/><rect x="90" y="56" width="8" height="14" rx="4" ' + F('#f0c987') + ' opacity=".6"/>'],
    'pets:messages': ['#2463a6', '#123461', (L, F) => '<path d="M26 34h44a10 10 0 0 1 10 10v12a10 10 0 0 1-10 10H44l-12 9v-9h-6a10 10 0 0 1-10-10V44a10 10 0 0 1 10-10z" ' + L + '/><path d="M60 58h34a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8h-2v8l-11-8H60a8 8 0 0 1-8-8V66a8 8 0 0 1 8-8z" ' + F('#86ccff') + '/>'],
    'pets:stepmail': ['#4549b8', '#252873', (L, F) => '<rect x="22" y="36" width="76" height="52" rx="11" ' + L + '/><path d="M26 42l34 24 34-24" ' + L + '/><circle cx="92" cy="34" r="10" ' + F('#ffcf5c') + '/>'],
    'pets:lenda': ['#a23447', '#5d1726', (L, F) => { const d = new Date(); return '<rect x="24" y="30" width="72" height="64" rx="13" ' + L + '/><path d="M24 50h72M44 22v14M76 22v14" ' + L + '/><text x="60" y="84" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="600" font-size="28" fill="#fff">' + d.getDate() + '</text><circle cx="86" cy="40" r="0" ' + F('#ffd0d7') + '/>'; }],
    'pets:milo': ['#1b6cb8', '#0d3c6e', (L, F) => '<circle cx="60" cy="60" r="30" ' + L + '/><path d="M30 60h60M60 30c-12 14-12 46 0 60M60 30c12 14 12 46 0 60" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="88" cy="34" r="8" ' + F('#7fe0ff') + '/>'],
    'pets:atlas': ['#227a6f', '#0f4440', (L, F) => '<path d="M24 36l22-9 28 9 22-9v57l-22 9-28-9-22 9z" ' + L + '/><path d="M46 27v57M74 36v57" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5"/><path d="M74 44c-7 0-12 5-12 11 0 9 12 19 12 19s12-10 12-19c0-6-5-11-12-11z" ' + F('#ff8a6b') + '/><circle cx="74" cy="55" r="4" fill="#0f4440"/>'],
    'pets:weather': ['#3576c0', '#1a3f73', (L, F) => '<circle cx="74" cy="44" r="13" ' + F('#ffd166') + '/><path d="M74 22v5M96 44h-5M89.6 28.4l-3.5 3.5" stroke="#ffd166" stroke-width="5" stroke-linecap="round"/><path d="M38 88h42a15 15 0 0 0 0-30 21 21 0 0 0-40 5 13 13 0 0 0-2 25z" fill="#fff"/>'],
    'pets:clock': ['#30333f', '#15171e', (L, F) => { const d = new Date(), m = d.getMinutes(), hh = (d.getHours() % 12) + m / 60; const p = (a, r) => (60 + r * Math.sin(a)).toFixed(1) + ' ' + (60 - r * Math.cos(a)).toFixed(1); return '<circle cx="60" cy="60" r="32" ' + L + '/><path d="M60 60L' + p(hh / 12 * 2 * Math.PI, 17) + 'M60 60L' + p(m / 60 * 2 * Math.PI, 25) + '" ' + L + '/><circle cx="60" cy="60" r="5" ' + F('#ffb547') + '/>'; }],
    'pets:files': ['#86612e', '#4a3517', (L, F) => '<path d="M24 38a8 8 0 0 1 8-8h16l8 8h32a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H32a8 8 0 0 1-8-8z" ' + L + '/><path d="M24 50h72" ' + L + '/><rect x="64" y="62" width="22" height="8" rx="4" ' + F('#ffd9a0') + '/>'],
    'pets:ostore': ['#202228', '#0b0c0f', (L, F) => '<circle cx="60" cy="60" r="27" fill="none" stroke="#fff" stroke-width="11"/><circle cx="83" cy="37" r="8" ' + F('#7ea6ff') + '/>'],
    'pets:settings': ['#535b6e', '#2b303c', (L, F) => '<path d="M30 40h60M30 60h60M30 80h60" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="6" stroke-linecap="round"/><circle cx="74" cy="40" r="8.5" fill="#fff"/><circle cx="46" cy="60" r="8.5" ' + F('#9fb3ff') + '/><circle cx="64" cy="80" r="8.5" fill="#fff"/>'],
    'pets:pen': ['#b98b1e', '#6e5010', (L, F) => '<rect x="30" y="24" width="60" height="72" rx="11" ' + L + '/><path d="M54 46h24M54 62h24M54 78h14" ' + L + '/><path d="M38 44l4 4 7-8" fill="none" stroke="#fff3c4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="43" cy="62" r="4" ' + F('#fff3c4') + '/><circle cx="43" cy="78" r="4" ' + F('#fff3c4') + '/>'],
    'pets:nudge': ['#c25a2c', '#7a3215', (L, F) => '<circle cx="36" cy="40" r="7" ' + F('#ffd7a8') + '/><circle cx="36" cy="60" r="7" ' + L + ' stroke-width="5"/><circle cx="36" cy="80" r="7" ' + L + ' stroke-width="5"/><path d="M54 40h34M54 60h34M54 80h24" ' + L + '/>'],
    'pets:sonix': ['#2c1c5a', '#110a27', (L, F) => '<path d="M30 54v12M42 42v36M54 32v56M66 46v28M78 38v44M90 52v16" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/><path d="M54 32v56" stroke="#a98bff" stroke-width="6.5" stroke-linecap="round"/>'],
    'pets:screenroom': ['#5b2236', '#2b0f1a', (L, F) => '<rect x="22" y="30" width="76" height="52" rx="10" ' + L + '/><path d="M44 96h32M60 82v14" ' + L + '/><path d="M53 45v22l19-11z" ' + F('#ff8a9c') + '/>'],
    'pets:voicepin': ['#147a83', '#0a4248', (L, F) => '<rect x="48" y="22" width="24" height="44" rx="12" ' + L + '/><path d="M36 58a24 24 0 0 0 48 0M60 82v14" ' + L + '/><path d="M22 52v12M98 52v12" stroke="#8ff0ea" stroke-width="5.5" stroke-linecap="round"/>'],
    'pets:pocketpay': ['#24486d', '#12253b', (L, F) => '<rect x="20" y="34" width="80" height="54" rx="11" ' + L + '/><path d="M20 50h80" ' + L + '/><rect x="30" y="62" width="18" height="13" rx="3" ' + F('#f3cf72') + '/><path d="M64 70h24" ' + L + '/>'],
    'pets:beacon': ['#43328a', '#231851', (L, F) => '<circle cx="60" cy="60" r="32" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="5"/><circle cx="60" cy="60" r="20" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="5"/><circle cx="60" cy="60" r="8" ' + F('#8ef0c4') + '/><path d="M60 60L84 36" ' + L + '/>'],
    'pets:clarice': ['#6145dd', '#2e1f7a', (L, F) => '<path d="M56 24c3 18 10 25 28 28-18 3-25 10-28 28-3-18-10-25-28-28 18-3 25-10 28-28z" fill="#fff"/><path d="M86 70c1.5 8 4.5 11 12 12-7.5 1-10.5 4-12 12-1.5-8-4.5-11-12-12 7.5-1 10.5-4 12-12z" ' + F('#c9b8ff') + '/>'],
    'pets:dropzone': ['#1e6a9c', '#0f3a5a', (L, F) => '<path d="M60 26v44M42 54l18 18 18-18" ' + L + '/><path d="M28 74v10a8 8 0 0 0 8 8h48a8 8 0 0 0 8-8V74" ' + L + '/><circle cx="60" cy="92" r="0" fill="none"/><rect x="50" y="84" width="20" height="0"/><path d="M28 74h0" ' + F('#9fdcff') + '/><circle cx="92" cy="30" r="7" ' + F('#9fdcff') + '/>'],
    'pets:scanwise': ['#273746', '#121b24', (L, F) => '<path d="M26 44V34a8 8 0 0 1 8-8h10M76 26h10a8 8 0 0 1 8 8v10M94 76v10a8 8 0 0 1-8 8H76M44 94H34a8 8 0 0 1-8-8V76" ' + L + '/><rect x="42" y="42" width="14" height="14" rx="2" ' + F('#6fe3ff') + '/><rect x="64" y="42" width="14" height="14" rx="2" ' + F('#6fe3ff') + '/><rect x="42" y="64" width="14" height="14" rx="2" ' + F('#6fe3ff') + '/><rect x="66" y="66" width="10" height="10" rx="2" fill="#fff"/>'],
    'pets:lingua': ['#2f4299', '#1a2560', (L, F) => '<path d="M22 32a8 8 0 0 1 8-8h34a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8H42l-12 9v-9a8 8 0 0 1-8-8z" ' + L + '/><path d="M37 52l10-22 10 22M41 45h12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 70a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8h-2v8l-10-8H66a8 8 0 0 1-8-8z" ' + F('#a8c0ff') + '/><path d="M68 76h20M68 84h12" stroke="#1a2560" stroke-width="4.5" stroke-linecap="round"/>'],
    'pets:assist': ['#2367cc', '#123c80', (L, F) => '<circle cx="60" cy="60" r="34" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="5"/><circle cx="60" cy="34" r="6" ' + F('#bfe0ff') + '/><path d="M36 48h48M60 48v20M60 68l-11 20M60 68l11 20" ' + L + '/>'],
    'pets:safeline': ['#b8323b', '#6e141b', (L, F) => '<path d="M60 22l30 11v22c0 21-14 35-30 43-16-8-30-22-30-43V33z" ' + L + '/><path d="M60 44v26M47 57h26" stroke="#fff" stroke-width="8" stroke-linecap="round"/>'],
    'pets:stepupdate': ['#305178', '#182c46', (L, F) => '<path d="M90 60a30 30 0 1 1-9-21.2" ' + L + '/><path d="M84 24v16H68" ' + L + '/><path d="M60 76V50M50 60l10-10 10 10" fill="none" stroke="#8fd3ff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>'],
    'pets:capture': ['#3d2226', '#1d0f11', (L, F) => '<rect x="38" y="20" width="44" height="80" rx="11" ' + L + '/><circle cx="60" cy="60" r="11" ' + F('#ff5468') + '/><path d="M52 90h16" ' + L + '/>'],
    'pets:torch': ['#38331f', '#1a170c', (L, F) => '<path d="M46 52l-8-26h44l-8 26v36a8 8 0 0 1-8 8H54a8 8 0 0 1-8-8z" ' + L + '/><path d="M46 52h28" ' + L + '/><circle cx="60" cy="68" r="5" ' + F('#ffe08a') + '/><path d="M60 10v6M36 14l4 5M84 14l-4 5" stroke="#ffe08a" stroke-width="5" stroke-linecap="round"/>'],
    'pets:calculator': ['#383b45', '#191b21', (L, F) => '<rect x="26" y="26" width="28" height="28" rx="8" ' + L + '/><rect x="66" y="26" width="28" height="28" rx="8" ' + L + '/><rect x="26" y="66" width="28" height="28" rx="8" ' + L + '/><rect x="66" y="66" width="28" height="28" rx="8" ' + F('#ff9f43') + '/><path d="M74 76h12M74 84h12" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M40 33v14M33 40h14" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'],
    'pets:rest': ['#28304d', '#121628', (L, F) => '<rect x="26" y="26" width="28" height="28" rx="9" ' + L + '/><rect x="66" y="26" width="28" height="28" rx="9" ' + L + '/><rect x="26" y="66" width="28" height="28" rx="9" ' + L + '/><circle cx="80" cy="80" r="12" ' + F('#9d8cff') + '/>'],
    'pets:activities': ['#9a2f57', '#561730', (L, F) => '<path d="M60 92S26 72 26 48a16 16 0 0 1 34-6 16 16 0 0 1 34 6c0 24-34 44-34 44z" ' + L + '/><path d="M34 60h14l6-12 10 22 6-10h16" fill="none" stroke="#ffc2d6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'],
    'pets:capsule': ['#5e3f91', '#2f1e52', (L, F) => '<rect x="22" y="40" width="76" height="48" rx="11" ' + L + '/><path d="M26 46l34 22 34-22" ' + L + '/><path d="M84 18l3.5 8.5 8.5 3.5-8.5 3.5L84 42l-3.5-8.5L72 30l8.5-3.5z" ' + F('#ffd98a') + '/>'],
    'pets:calendar': ['#8f3a52', '#4e1a2a', (L, F) => { const d = new Date(); return '<rect x="24" y="30" width="72" height="64" rx="13" ' + L + '/><path d="M24 50h72" ' + L + '/><text x="60" y="84" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-weight="600" font-size="26" fill="#fff">' + d.getDate() + '</text>'; }],
    'pets:syncro': ['#205f7a', '#0e3142', (L, F) => '<path d="M86 48a28 28 0 0 0-50-8M34 72a28 28 0 0 0 50 8" ' + L + '/><path d="M36 26v14h14M84 94V80H70" ' + L + '/>']
  }
};
StepIcon.defs['store:milo'] = StepIcon.defs['pets:milo'];
StepIcon.defs['sys:phone'] = StepIcon.defs['pets:phone']; StepIcon.defs['sys:messages'] = StepIcon.defs['pets:messages'];
StepIcon.defs['sys:camera'] = StepIcon.defs['pets:camera']; StepIcon.defs['sys:contacts'] = StepIcon.defs['pets:contacts'];
// Settings › Home Screen › Classic icons brings back the earlier artwork.
(orig => { Apps.tile = function (app, big) {
  if (!app || S.classicIcons || !StepIcon.has(app.id) || (app.id === 'pets:pip')) return orig.call(this, app, big);
  const t = h('div', { class: 'tile hd-tile st-tile', 'data-st': app.id });
  t.innerHTML = StepIcon.draw(app.id);
  return t;
}; })(Apps.tile);
// Timewell shows the time and Lenda today's date.
setInterval(() => { if (S.classicIcons) return; $$('.tile[data-st="pets:clock"], .tile[data-st="pets:lenda"], .tile[data-st="pets:calendar"]').forEach(t => { t.innerHTML = StepIcon.draw(t.getAttribute('data-st')); }); }, 30000);

// ================================================================ Home Screen: every suite app gets a place
Suite.migrate = function () {
  if (!S.home) return;
  let changed = false;
  // The Dock's Phone/Messages/Camera shortcuts become Calla, Relay and Shutter.
  if ((S.suiteV || 0) < 1) {
    S.dock = S.dock.map(id => ({ 'sys:phone': 'pets:phone', 'sys:messages': 'pets:messages', 'sys:camera': 'pets:camera', 'sys:contacts': 'pets:contacts' }[id] || id));
    const seen = new Set(); S.dock = S.dock.filter(id => !seen.has(id) && seen.add(id));
    changed = true;
  }
  const placed = new Set([].concat(...S.home, S.dock));
  if (Apps.builtin['store:milo']) placed.add('pets:milo');
  const missing = Suite.CATALOG.map(c => c.id).filter(id => Apps.get(id) && !placed.has(id) && !(S.suiteRemoved || []).includes(id));
  if ((S.suiteV || 0) < Suite.version && missing.length) {
    for (let i = 0; i < missing.length; i += 24) S.home.push(missing.slice(i, i + 24));
    changed = true;
  }
  if ((S.suiteV || 0) < Suite.version) { S.suiteV = Suite.version; changed = true; }
  if (changed) Store.save();
};
(orig => { Shell.ensureHome = function () { orig.call(this); Suite.migrate(); }; })(Shell.ensureHome);
// Remember a suite app the owner took off the Home Screen, so it isn't put back.
(orig => { Shell.iconMenu = function (id, where, el) {
  orig.call(this, id, where, el);
  const c = Suite.entry(id); if (!c || where.dock) return;
  const btn = $$('.dialog button').find(b => /Remove from Home Screen/.test(b.textContent));
  if (btn) btn.addEventListener('click', () => { S.suiteRemoved = (S.suiteRemoved || []).filter(x => x !== id).concat([id]); Store.save(); }, true);
}; })(Shell.iconMenu);

// ================================================================ Settings › Apps (+ icon style)
SettingsIndex.push(['Apps', 'apps', 'apps permissions camera microphone location notifications installed version uninstall'], ['App Permissions', 'apps', 'permission allow camera mic location contacts']);
SettingsPageNames.apps = 'Apps';
Suite.appInfo = function (w, id) {
  const app = Apps.get(id); if (!app) return;
  const c = Suite.entry(id) || {}, store = id.startsWith('store:') ? PetStore.installed[id.slice(6)] : null;
  w.push(app.name, body => {
    body.append(h('div', { class: 'st-apphead' }, (() => { const t = Apps.tile(app); t.classList.add('st-big'); return t; })(),
      h('div', { class: 'grow' }, h('div', { class: 'st-apphead-n', text: app.name }), h('div', { class: 'sub', text: c.fn || app.cat || 'App' }))));
    const open = h('button', { class: 'btn block', text: 'Open ' + app.name }); open.onclick = () => Shell.open(id);
    body.append(open);
    if (app.desc || c.desc) body.append(Ui.card(h('div', { class: 'row', style: { display: 'block', lineHeight: 1.5 }, text: app.desc || c.desc })));
    body.append(Ui.label('About'), Ui.card(
      Ui.row('Version', null, null, { val: store ? store.version : PETS_VERSION }),
      Ui.row('Source', null, null, { val: store ? 'O Store (signed)' : app.android ? 'Android' : 'Built into Pets OS' }),
      Ui.row('Status', null, null, { val: 'Installed' + (Shell.windows.some(x => x.id === id) ? ' · open' : '') })));
    const perms = (c.perms || []).filter(p => p !== 'storage' || !isWeb);
    body.append(Ui.label('Permissions'));
    if (!perms.length) body.append(Ui.card(Ui.row('No special permissions', 'This app only uses its own Pets OS storage.', null)));
    else {
      const card = h('div', { class: 'card' });
      perms.forEach(p => {
        const [title, key] = Suite.PERM[p];
        const st = Need.status(key);
        card.append(Ui.row(title, st, onPhone && !/^Allowed/.test(st) ? async () => { if (p === 'storage') Phone.askStorage(); else await Need.ask(key); w.refresh(); } : (onPhone ? () => Phone.appInfo('media.shouldbe.petsos') : null), { val: onPhone && !/^Allowed/.test(st) ? 'Allow' : null }));
      });
      body.append(card, Ui.note(onPhone ? 'Pets OS asks for a permission the first time an app needs it. To take one back, open Android\'s app info for Pets OS.' : 'In a browser, the browser asks the first time an app uses the camera, microphone or location, and remembers your answer.'));
    }
    const off = (S.notifOff || []).indexOf(id) >= 0;
    body.append(Ui.label('Notifications'), Ui.card(Ui.toggleRow('Allow notifications', null, !off, v => { S.notifOff = (S.notifOff || []).filter(x => x !== id).concat(v ? [] : [id]); Store.save(); })));
    const onHome = S.home.some(p => p.indexOf(id) >= 0) || S.dock.indexOf(id) >= 0;
    body.append(Ui.label('Home Screen'), Ui.card(onHome ? Ui.row('On your Home Screen', null, null) : Ui.row('Add to Home Screen', null, () => { PetStore.addToHome(id); S.suiteRemoved = (S.suiteRemoved || []).filter(x => x !== id); Store.save(); Shell.buildHome(); Shell.toast(app.name + ' added to your Home Screen'); w.refresh(); })));
    if (store) { const u = h('button', { class: 'btn block secondary', text: 'Uninstall ' + app.name + '…', style: { color: 'var(--danger)', marginTop: '14px' } }); u.onclick = () => PetStore.askUninstall(id.slice(6), () => w.back()); body.append(u); }
    else body.append(Ui.note('Apps included with Pets OS can\'t be uninstalled, but you can take them off the Home Screen. They stay in Rest and search.'));
  });
};
(orig => { Apps.builtin['pets:settings'].open = function (w) {
  orig.call(this, w);
  Settings.pages.apps = body => {
    const f = h('input', { type: 'search', placeholder: 'Search apps', autocomplete: 'off', 'aria-label': 'Search apps' });
    const box = h('div');
    const draw = () => {
      box.innerHTML = '';
      const q = f.value.trim().toLowerCase();
      const card = h('div', { class: 'card' });
      const add = (id, sub) => { const a = Apps.get(id); if (!a || (q && !(a.name + ' ' + (a.keywords || '')).toLowerCase().includes(q))) return; const r = h('div', { class: 'row' }, (() => { const t = Apps.tile(a); t.classList.add('st-small'); return t; })(), h('div', { class: 'grow' }, h('div', { text: a.name }), h('div', { class: 'sub', text: sub })), h('span', { class: 'chev', html: icon('chevron-right') })); press(r, () => Suite.appInfo(w, id)); card.append(r); };
      Suite.CATALOG.forEach(c => { if (Suite.available(c)) add(Suite.liveId(c), c.fn); });
      Object.keys(PetStore.installed || {}).forEach(k => { if (k !== 'milo') add('store:' + k, 'From the O Store'); });
      Suite.EXTRAS.forEach(([id]) => add(id, 'Pets OS'));
      box.append(card.childNodes.length ? card : Ui.card(Ui.row('No apps match', null, null)));
    };
    f.addEventListener('input', draw);
    body.append(h('div', { class: 'search set-search', html: icon('search') }, f), box);
    draw();
  };
  Settings.pages.home = (homeOrig => body => {
    homeOrig(body);
    body.append(Ui.label('App icons'), Ui.card(Ui.toggleRow('Classic icons', 'Use the earlier Pets OS artwork instead of the StepOS icons', !!S.classicIcons, v => { S.classicIcons = v; Store.save(); Shell.buildHome(); })));
  })(Settings.pages.home || (() => {}));
  const m = Settings.main || null;
  // Add "Apps" to the main page, next to Storage.
  const addRow = () => {
    const rows = $$('.row', w.body).filter(r => /^Storage/.test((r.querySelector('.grow > div') || {}).textContent || ''));
    if (!rows.length || $('[data-st-apps]', w.body)) return;
    const r = h('div', { class: 'row', 'data-st-apps': '1' }, h('div', { class: 'sq', style: { background: '#4b6bd8' }, html: icon('layout-grid') }), h('div', { class: 'grow' }, h('div', { text: 'Apps' })),
      h('span', { class: 'val', text: String(Suite.CATALOG.filter(c => Suite.available(c)).length + Suite.EXTRAS.filter(([id]) => Apps.get(id)).length + Object.keys(PetStore.installed || {}).filter(k => k !== 'milo').length) }), h('span', { class: 'chev', html: icon('chevron-right') }));
    press(r, () => w.push('Apps', Settings.pages.apps));
    rows[0].parentNode.insertBefore(r, rows[0]);
  };
  const render = w._render;
  if (render && !w.stack.length) { w.root(body => { render(body); addRow(); }); Settings.main = w._render; }
  void m;
}; })(Apps.builtin['pets:settings'].open);
// Settings.go() re-roots with Settings.main; keep the Apps row there too.

// ================================================================ O Store: the StepOS catalogue in order
(orig => { Apps.builtin['pets:ostore'].open = function (w) {
  orig.call(this, w);
  const render = w._render;
  const detail = c => {
    const id = Suite.liveId(c), a = Apps.get(id);
    w.push(c.name, body => {
      body.append(h('div', { class: 'st-apphead' }, (() => { const t = Apps.tile(a || { id }); t.classList.add('st-big'); return t; })(), h('div', { class: 'grow' }, h('div', { class: 'st-apphead-n', text: c.name }), h('div', { class: 'sub', text: c.fn + ' · #' + c.n }))));
      if (a) { const o = h('button', { class: 'btn block', text: 'Open' }); o.onclick = () => Shell.open(id); body.append(o); }
      body.append(Ui.card(h('div', { class: 'row', style: { display: 'block', lineHeight: 1.5 }, text: c.desc })));
      const perms = c.perms.filter(p => p !== 'storage' || !isWeb).map(p => Suite.PERM[p][0]);
      body.append(Ui.card(Ui.row('Version', null, null, { val: id === 'store:milo' && PetStore.installed.milo ? PetStore.installed.milo.version : PETS_VERSION }),
        Ui.row('Source', null, null, { val: id.startsWith('store:') ? 'O Store, signed' : 'Included with Pets OS' }),
        Ui.row('Status', null, null, { val: a ? 'Installed' : 'Not on this device' }),
        Ui.row('Permissions', null, null, { val: perms.length ? perms.join(', ') : 'None' })));
      if (a) body.append(Ui.btn('App settings', () => { Settings.go('apps'); setTimeout(() => Settings.win && Suite.appInfo(Settings.win, id), 50); }, 'secondary'));
    });
  };
  if (!render) return;
  w.root(body => {
    render(body);
    const lbl = $$('.label', body).find(l => l.textContent === 'Included with Pets OS');
    if (!lbl) return;
    const old = lbl.nextElementSibling;
    const card = h('div', { class: 'card' });
    Suite.CATALOG.forEach(c => {
      const id = Suite.liveId(c), a = Apps.get(id);
      if (!a) return;
      const onHome = S.home.some(p => p.indexOf(id) >= 0) || S.dock.indexOf(id) >= 0;
      const b = h('button', { class: 'btn ' + (onHome ? 'secondary' : ''), text: onHome ? 'Open' : 'Add', style: { height: '32px', borderRadius: '16px', fontSize: '14px', padding: '0 16px', flex: 'none' } });
      b.onclick = e => { e.stopPropagation(); if (onHome) Shell.open(id); else { PetStore.addToHome(id); S.suiteRemoved = (S.suiteRemoved || []).filter(x => x !== id); Store.save(); Shell.buildHome(); Shell.toast(c.name + ' added to your Home Screen'); w.refresh(); } };
      const t = Apps.tile(a); t.classList.add('st-small');
      const r = h('div', { class: 'row' }, t, h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 }, text: c.name }), h('div', { class: 'sub', text: c.fn + ' · ' + (id === 'store:milo' && PetStore.installed.milo ? PetStore.installed.milo.version : PETS_VERSION) + ' · Installed' })), b);
      press(r, () => detail(c));
      card.append(r);
    });
    lbl.textContent = 'StepOS apps · included with Pets OS';
    if (old && old.classList.contains('card')) old.replaceWith(card); else lbl.after(card);
  });
}; })(Apps.builtin['pets:ostore'].open);

window.Suite = Suite; window.StepIcon = StepIcon; window.Ui = Ui; window.Need = Need; window.MiloStart = MiloStart;

// ================================================================ owner, 2026-11-02: bottom navigation bar + light look
// One invisible iPhone-style home bar (gestures). The whole phone takes a light, glassy look
// with light icons; dark is still in Settings › Display.
Wallpapers.list.unshift({ id: 'daylight', name: 'Daylight', css: 'linear-gradient(172deg,#76a9ef 0%,#9fb4f4 38%,#c4a6ee 70%,#f2a9c6 100%)' });
// One bar like an iPhone's, along the bottom of every screen. It is invisible but works:
// swipe up = Home, swipe up and hold = recent apps, swipe sideways = switch apps (and swipe in
// from the left edge = Back). Settings › Home Screen & Dock › Show the home bar makes it visible.
const HomeBar = {
  apply() { document.documentElement.classList.toggle('show-homebar', !!S.showHomeBar); },
  // On the Home Screen too: a swipe up and hold opens recent apps.
  zone() {
    if ($('#homezone')) return;
    const z = h('div', { id: 'homezone', 'aria-hidden': 'true' }, h('i'));
    swipe(z, (dir, d) => { if (dir === 'up') { if (d.dt > 450) Shell.recents(); else Shell.home(); } else if (dir === 'left' || dir === 'right') Shell.switchApp(dir); }, { min: 30 });
    $('#home').append(z);
  }
};
Suite.lightLook = function () {
  if ((S.lookV || 0) >= 1) return;
  S.lookV = 1; S.theme = 'light'; S.themeAuto = false;
  if (!S.wallpaper || S.wallpaper === 'alpine-dusk') S.wallpaper = 'daylight';
  Store.save();
};
// Light icons: a pale tile with the glyph in the app's own colour (still the StepOS artwork).
(orig => { StepIcon.draw = function (id) {
  if (S.theme !== 'light') return orig.call(this, id);
  const d = this.defs[id]; if (!d) return null;
  const ink = d[0];
  const glyph = d[2](this.L, this.F).replace(/(stroke|fill)="#fff"/g, '$1="' + ink + '"');
  const g = this.uid();
  return '<svg class="hd st-icon st-light" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="' + g + '" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eceef3"/></linearGradient></defs>' +
    '<rect width="120" height="120" fill="url(#' + g + ')"/><path d="M120 78H104V94H88V110H72V120H120Z" fill="' + ink + '" opacity=".06"/>' + glyph + '</svg>';
}; })(StepIcon.draw);
(orig => { Settings.setTheme = function (t) { orig.call(this, t); Shell.buildHome(); }; })(Settings.setTheme);
(orig => { Shell.start = function () { Suite.lightLook(); orig.call(this); HomeBar.apply(); HomeBar.zone(); }; })(Shell.start);
(orig => { Apps.builtin['pets:settings'].open = function (w) {
  orig.call(this, w);
  const homeP = Settings.pages.home;
  Settings.pages.home = body => {
    homeP(body);
    body.append(Ui.label('Navigation'), Ui.card(Ui.toggleRow('Show the home bar', 'The bar at the bottom always works: swipe up for Home, swipe up and hold for recent apps, swipe sideways to switch apps. Off keeps it invisible.', !!S.showHomeBar, v => { S.showHomeBar = v; Store.save(); HomeBar.apply(); })));
  };
}; })(Apps.builtin['pets:settings'].open);
SettingsIndex.push(['Home bar', 'home', 'navigation bar home bar gestures swipe bottom bar invisible']);
window.HomeBar = HomeBar;
