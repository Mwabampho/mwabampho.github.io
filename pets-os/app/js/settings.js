// Settings for Pets OS for Stephone, laid out like a phone's Settings: Search at the top, grouped
// rows, and a page for each area. Replaces the first Settings app (apps.js); Android-only rows stay
// Android-only. Also holds the preferences other parts read (text size, read aloud, haptics, lock screen).
'use strict';

// ================================================================ preferences that change the whole phone
const Speak = {
  ok() { return 'speechSynthesis' in window; },
  say(text) {
    if (!this.ok() || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[•♥♪]/g, ''));
      u.rate = S.speechRate || 1;
      speechSynthesis.speak(u);
    } catch (e) { /* no voice */ }
  },
  stop() { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
};

const Prefs = {
  apply() {
    const r = document.documentElement;
    r.style.setProperty('--ts', S.textScale || 1);
    const on = (cls, v) => r.classList.toggle(cls, !!v);
    on('bold-text', S.boldText); on('easy-read', S.easyRead); on('reduce-trans', S.reduceTrans);
    on('hide-labels', S.hideLabels); on('hide-pill', S.hidePill); on('lock-bold', S.lockClockBold);
    on('no-lock-pip', S.lockPip === false); on('no-lock-widgets', S.lockWidgets === false); on('no-lock-notes', S.lockNotes === false);
    Settings.applyMotion();
    this.autoTheme();
  },
  autoTheme() {
    if (!S.themeAuto) return;
    const hr = new Date().getHours(), want = hr >= 19 || hr < 7 ? 'dark' : 'light';
    if (S.theme !== want) Settings.setTheme(want);
  },
  set(k, v) { S[k] = v; Store.save(); this.apply(); }
};

// Haptics switch.
(orig => { Phone.vibrate = ms => { if (S.haptics !== false) orig(ms); }; })(Phone.vibrate.bind ? Phone.vibrate.bind(Phone) : Phone.vibrate);

// Alert sounds and read-aloud for new alerts.
const Chimes = {
  list: [['chime', 'Chime'], ['bell', 'Bell'], ['soft', 'Soft'], ['none', 'None']],
  play(kind) {
    kind = kind || S.alertSound || 'chime';
    if (kind === 'none') return;
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      const notes = { chime: [[880, 0], [1320, .12]], bell: [[660, 0], [990, 0], [1320, .02]], soft: [[523, 0], [659, .14]] }[kind] || [];
      notes.forEach(([f, t]) => {
        const o = a.createOscillator(), g = a.createGain();
        o.type = kind === 'soft' ? 'sine' : 'triangle'; o.frequency.value = f; o.connect(g); g.connect(a.destination);
        g.gain.setValueAtTime(.0001, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.18, a.currentTime + t + .02);
        g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + t + .6); o.start(a.currentTime + t); o.stop(a.currentTime + t + .65);
      });
    } catch (e) { /* no audio */ }
  }
};
(orig => { Shell.notify = function (title, text, opts) {
  const n = orig.call(this, title, text, opts);
  if (n && this.notes[0] === n && !S.dnd && !Moods.quiet() && !(opts && opts.app === 'pets:clock')) {
    Chimes.play();
    if (S.speakNotes) Speak.say(title + (text ? '. ' + text : ''));
  }
  return n;
}; })(Shell.notify);

// Notification previews: always, only when unlocked, or never.
(orig => { Shell.noteCard = function (n, android) {
  const card = orig.call(this, n, android);
  const p = S.previews || 'always';
  if (p === 'never' || (p === 'unlocked' && this.locked)) {
    const x = $('.x', card); if (x) x.textContent = 'Notification';
  }
  return card;
}; })(Shell.noteCard);

// Clarice can read her answers aloud.
(orig => { Clarice.answer = async function (raw) {
  const reply = await orig.call(this, raw);
  if (S.claSpeak) Speak.say(reply);
  return reply;
}; })(Clarice.answer);

// ================================================================ the Settings app
// Every row that search can find: title, page, extra words.
const SettingsIndex = [
  ['Your name', 'name', 'profile me owner account'],
  ['Moods', 'moods', 'everyday work chill sleep focus schedule'],
  ['Pip', 'pip', 'pet companion dog cat bunny'],
  ['Clarice', 'clarice', 'assistant suggestions speak replies voice'],
  ['Notifications', 'notifications', 'alerts banners previews badges'],
  ['Sounds & Haptics', 'sounds', 'sound vibrate vibration alert chime ringtone volume buzz'],
  ['Focus', 'notifications', 'do not disturb quiet silence dnd'],
  ['Display & Text Size', 'display', 'dark light mode appearance brightness text size font bigger bold reading'],
  ['Text Size', 'display', 'font bigger larger smaller letters zoom'],
  ['Dark Mode', 'display', 'appearance night theme light automatic'],
  ['Wallpaper', 'wallpaper', 'background picture photo'],
  ['Home Screen & Dock', 'home', 'icons labels names search widgets dock layout reset'],
  ['Lock Screen', 'lock', 'clock widgets pip notifications auto-lock'],
  ['Auto-Lock', 'lock', 'lock after screen timeout'],
  ['Accessibility', 'accessibility', 'read aloud speak voice bold reduce motion transparency dyslexia easier reading'],
  ['Read Aloud', 'accessibility', 'speak voice spoken content speech'],
  ['Reduce Motion', 'accessibility', 'animation movement'],
  ['Passcode', 'passcode', 'pin code password lock security'],
  ['Privacy & Security', 'privacy', 'data history suggestions clear'],
  ['Battery', 'battery', 'power charge low power'],
  ['Storage', 'storage', 'space data clear memory'],
  ['General', 'general', 'about update reset date time'],
  ['About', 'about', 'version phone model'],
  ['Software Update', 'update', 'version new download'],
  ['Date & Time', 'datetime', '24-hour clock time zone'],
  ['Reset', 'reset', 'erase start fresh reset settings layout']
];

// Page names, known before Settings has been opened (search and Clarice use them).
const SettingsPageNames = { name: 'Your Name', moods: 'Moods', pip: 'Pip', clarice: 'Clarice', notifications: 'Notifications', sounds: 'Sounds & Haptics',
  display: 'Display & Text Size', wallpaper: 'Wallpaper', home: 'Home Screen & Dock', lock: 'Lock Screen', accessibility: 'Accessibility', passcode: 'Passcode',
  privacy: 'Privacy & Security', battery: 'Battery', storage: 'Storage', general: 'General', about: 'About', update: 'Software Update', datetime: 'Date & Time', reset: 'Reset' };
Settings.applyMotion = () => document.documentElement.classList.toggle('reduce-motion', !!(S.reduceMotion || S.lowPower));
// Suggestions can be turned off (Settings > Clarice or Privacy).
(orig => { Usage.suggest = function (n) { return S.claSuggest === false ? [] : orig.call(this, n); }; })(Usage.suggest);
(orig => { Shell.start = function () { orig.call(this); Prefs.apply(); setInterval(() => Prefs.autoTheme(), 60000); }; })(Shell.start);

Object.assign(Settings, {
  win: null,
  // Open Settings on a page (used by search, Clarice and other apps).
  go(page) {
    Shell.open('pets:settings');
    const w = this.win; if (!w) return;
    w.root(this.main); w.setTitle('Settings'); w.el.classList.remove('compact');
    if (page && this.pages[page]) w.push(this.titles[page] || 'Settings', this.pages[page]);
  },
  titles: SettingsPageNames, pages: {}, main: null
});

Apps.register({
  id: 'pets:settings', name: 'Settings', glyph: 'settings', bg: G.grey, cat: 'Pets OS', keywords: 'preferences wallpaper passcode text size display',
  open(w) {
    Settings.win = w;
    const dev = () => json(Phone.device(), {});
    const huawei = () => /huawei|honor/i.test(dev().manufacturer || '');
    const note = text => h('p', { class: 'set-note', text });
    const label = text => h('div', { class: 'label', text });
    const card = (...rows) => h('div', { class: 'card' }, ...rows.filter(Boolean));
    const row = (sq, colour, title, val, fn, extra) => {
      const r = h('div', { class: 'row' }, sq ? h('div', { class: 'sq', style: { background: colour }, html: icon(sq) }) : null,
        h('div', { class: 'grow' }, h('div', { text: title }), extra ? h('div', { class: 'sub', text: extra }) : null),
        val != null ? h('span', { class: 'val', text: val }) : null, fn ? h('span', { class: 'chev', html: icon('chevron-right') }) : null);
      if (fn) press(r, fn);
      return r;
    };
    const toggle = (sq, colour, title, on, fn, extra) => {
      const t = h('div', { class: 'toggle' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false' });
      const r = h('div', { class: 'row' }, sq ? h('div', { class: 'sq', style: { background: colour }, html: icon(sq) }) : null,
        h('div', { class: 'grow' }, h('div', { text: title }), extra ? h('div', { class: 'sub', text: extra }) : null), t);
      press(r, () => { const v = !t.classList.contains('on'); t.classList.toggle('on', v); t.setAttribute('aria-checked', v ? 'true' : 'false'); fn(v); });
      return r;
    };
    const choice = (options, current, fn) => {
      const c = h('div', { class: 'card' });
      options.forEach(([v, title, sub]) => {
        const r = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { text: title }), sub ? h('div', { class: 'sub', text: sub }) : null),
          h('span', { class: 'tick', html: v === current ? icon('check') : '' }));
        press(r, () => { fn(v); w.refresh(); });
        c.append(r);
      });
      return c;
    };
    const seg = (options, current, fn) => {
      const s = h('div', { class: 'seg' });
      options.forEach(([v, title]) => { const b = h('button', { class: v === current ? 'on' : '', text: title }); b.onclick = () => { fn(v); w.refresh(); }; s.append(b); });
      return s;
    };
    const go = page => () => w.push(Settings.titles[page] || 'Settings', Settings.pages[page]);
    const pageRow = (sq, colour, page, val, extra) => row(sq, colour, Settings.titles[page], val, go(page), extra);
    const platformName = () => isStephone ? 'Stephone ' + (dev().model || '') : isWeb ? (/iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : 'this browser') : ((dev().manufacturer || '') + ' ' + (dev().model || '')).trim();

    // ---------------------------------------------------------------- main page
    const main = body => {
      // Search Settings
      const field = h('input', { type: 'search', placeholder: 'Search Settings', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false' });
      const results = h('div', { class: 'card set-results hidden' });
      const rest = h('div');
      field.addEventListener('input', () => {
        const q = field.value.trim().toLowerCase();
        results.innerHTML = '';
        rest.classList.toggle('hidden', !!q); results.classList.toggle('hidden', !q);
        if (!q) return;
        const hits = SettingsIndex.filter(([t, p, k]) => (t + ' ' + k).toLowerCase().includes(q) && Settings.pages[p]);
        if (!hits.length) results.append(h('div', { class: 'row' }, h('div', { class: 'grow sub', text: 'No settings match "' + field.value.trim() + '"' })));
        hits.forEach(([t, p]) => results.append(row(null, null, t, Settings.titles[p] !== t ? Settings.titles[p] : null, () => { field.value = ''; w.push(Settings.titles[p], Settings.pages[p]); })));
      });
      body.append(h('div', { class: 'search set-search', html: icon('search') }, field), results, rest);

      const d = dev();
      const me = h('div', { class: 'card' }, h('div', { class: 'row me-row' },
        h('div', { class: 'avatar', text: (S.name || 'P').slice(0, 1).toUpperCase() }),
        h('div', { class: 'grow' }, h('div', { class: 'me-name', text: S.name || 'Your name' }), h('div', { class: 'sub', text: 'Pets OS for Stephone · ' + platformName() })),
        h('span', { class: 'chev', html: icon('chevron-right') })));
      press(me.firstChild, go('name'));
      rest.append(me);
      if (!isWeb) rest.append(card(
        row('wifi', '#3d7bff', 'Wi-Fi', Phone.network() === 'wifi' ? 'Connected' : 'Not connected', () => Phone.settings('wifi')),
        row('bluetooth', '#3d7bff', 'Bluetooth', null, () => Phone.settings('bluetooth')),
        row('signal', '#3dd6a0', 'Mobile data', Phone.network() === 'cell' ? 'In use' : null, () => Phone.settings('data')),
        row('plane', '#ffb84d', 'Airplane mode', null, () => Phone.settings('airplane'))));
      const m = Moods.current();
      rest.append(card(
        pageRow(m.glyph, m.colour, 'moods', m.name),
        pageRow('paw', '#ffb84d', 'pip', Pip.data().name),
        pageRow('sparkles', '#8c7bff', 'clarice')));
      rest.append(card(
        pageRow('bell', '#ff5c63', 'notifications', (S.notifOff || []).length ? S.notifOff.length + ' off' : null),
        pageRow('volume-2', '#ff5c7a', 'sounds'),
        toggle('bell-off', '#8c7bff', 'Focus', S.dnd, v => { S.dnd = v; Store.save(); }, 'Silence alerts; they still wait in Notifications')));
      rest.append(card(
        pageRow('sun', '#3d7bff', 'display', S.themeAuto ? 'Automatic' : S.theme === 'dark' ? 'Dark' : 'Light'),
        pageRow('image', '#2fb8d8', 'wallpaper', (Wallpapers.list.find(x => x.id === S.wallpaper) || { name: 'Your photo' }).name),
        pageRow('layout-grid', '#3dd6a0', 'home'),
        pageRow('lock', '#5b5f7a', 'lock')));
      rest.append(card(
        pageRow('user-round', '#3d7bff', 'accessibility'),
        pageRow('lock', '#ff5c63', 'passcode', S.pin ? 'On' : 'Off'),
        pageRow('shield', '#3d7bff', 'privacy')));
      const b = json(Phone.battery(), {});
      rest.append(card(
        b.level >= 0 ? pageRow(b.charging ? 'battery-charging' : 'battery-full', '#3dd6a0', 'battery', b.level + '%') : null,
        pageRow('hard-drive', '#5d6680', 'storage')));
      rest.append(card(pageRow('settings', '#5d6680', 'general', 'Pets OS ' + PETS_VERSION)));
      if (!isWeb) rest.append(card(row('smartphone', '#5d6680', 'All Android settings', null, () => Phone.settings('main'))));
    };

    // ---------------------------------------------------------------- pages
    const P = Settings.pages, T = Settings.titles;
    T.name = 'Your Name';
    P.name = body => {
      const f = h('input', { class: 'field', value: S.name, maxlength: 40, placeholder: 'Your name', autocorrect: 'off', spellcheck: 'false', autocapitalize: 'words' });
      f.addEventListener('change', () => { S.name = f.value.trim(); Store.save(); });
      f.addEventListener('keydown', e => { if (e.key === 'Enter') { f.blur(); w.back(); } });
      body.append(f, note('Pets OS uses your name on the lock screen, in Clarice and when Pip says hello. It stays on this phone.'));
    };

    T.moods = 'Moods';
    P.moods = body => {
      const c = h('div', { class: 'card' });
      Moods.list.forEach(m => c.append(row(m.glyph, m.colour, m.name, (S.mood || 'everyday') === m.id ? 'On' : null, () => w.push(m.name, moodPage(m.id)), m.text)));
      body.append(c);
      const a = S.sleepAuto || { on: false, from: '23:00', to: '07:00' };
      body.append(label('Schedule'), card(
        toggle(null, null, 'Sleep mood by itself', a.on, v => { S.sleepAuto = Object.assign({}, a, { on: v }); Store.save(); Moods.autoTick(); }, 'From ' + a.from + ' to ' + a.to),
        row(null, null, 'Times', a.from + ' – ' + a.to, async () => {
          const ok = s => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s);
          const f = await Dialog.prompt('Sleep starts at', '24-hour time, like 23:00', a.from, { inputmode: 'numeric', max: 5 });
          if (f == null) return; if (!ok(f)) { Shell.toast('Use a time like 23:00'); return; }
          const t = await Dialog.prompt('Sleep ends at', '24-hour time, like 07:00', a.to, { inputmode: 'numeric', max: 5 });
          if (t == null) return; if (!ok(t)) { Shell.toast('Use a time like 07:00'); return; }
          S.sleepAuto = Object.assign({}, a, { from: f.padStart(5, '0'), to: t.padStart(5, '0') }); Store.save(); w.refresh();
        })),
        note('Change mood from Control Centre (tap the Mood tile, hold it to pick), the Mood key on the Stephone, or tell Clarice: "chill mood", "good night".'));
    };
    const moodPage = id => body => {
      const m = Moods.get(id), c = Moods.conf(id);
      const on = h('button', { class: 'btn block', text: (S.mood || 'everyday') === id ? m.name + ' is on' : 'Turn on ' + m.name, style: { background: 'linear-gradient(135deg,' + m.colour + ',' + m.colour2 + ')', marginBottom: '14px' } });
      on.onclick = () => { Moods.apply(id); w.refresh(); };
      body.append(on, card(toggle(null, null, 'Quiet alerts', c.quiet, v => Moods.setConf(id, { quiet: v }), 'No banners, sounds or buzzes; alerts still wait in Notifications')));
      const walls = h('div', { class: 'mood-walls' });
      [{ id: null, name: 'Your own', css: 'var(--card)' }].concat(Wallpapers.list).forEach(wp => {
        const t = h('button', { class: c.wall === wp.id ? 'on' : '', style: { background: wp.css + ' center/cover' } }, h('span', { text: wp.name }));
        t.onclick = () => { Moods.setConf(id, { wall: wp.id }); w.refresh(); };
        walls.append(t);
      });
      body.append(label('Wallpaper'), walls, label('Apps on the Home Screen'));
      const list = h('div', { class: 'card' });
      Object.values(Apps.builtin).filter(a => !a.hiddenFromRest && a.id !== 'pets:settings').sort((a, b) => a.name.localeCompare(b.name)).forEach(a => {
        list.append(toggle(null, null, a.name, c.hide.indexOf(a.id) < 0, v => { const cc = Moods.conf(id); Moods.setConf(id, { hide: cc.hide.filter(x => x !== a.id).concat(v ? [] : [a.id]) }); }));
      });
      body.append(list, note('Hidden apps leave the Home Screen and Dock while ' + m.name + ' is on. They are still in Rest.'));
    };

    T.pip = 'Pip';
    P.pip = body => {
      const d = Pip.data();
      const box = h('div', { class: 'set-pip' }); Pip.draw(box);
      body.append(box, card(
        row('paw', '#ffb84d', 'Open ' + d.name, null, () => Shell.open('pets:pip'), 'Pet, feed and play'),
        toggle(null, null, d.name + ' on the Home Screen', S.home.some(p => p.indexOf('widget:pip') >= 0), v => {
          if (v) { if (!S.home.some(p => p.indexOf('widget:pip') >= 0)) S.home[0].splice(Math.max(0, S.home[0].indexOf('widget:today') + 1), 0, 'widget:pip'); }
          else S.home = S.home.map(p => p.filter(x => x !== 'widget:pip'));
          Store.save(); Shell.buildHome();
        }),
        toggle(null, null, d.name + ' on the lock screen', S.lockPip !== false, v => Prefs.set('lockPip', v)),
        toggle(null, null, d.name + ' reacts to alerts', S.pipAlerts !== false, v => { S.pipAlerts = v; Store.save(); }, 'Pops up in the Pets Island')));
    };

    T.clarice = 'Clarice';
    P.clarice = body => {
      body.append(card(
        toggle('sparkles', '#8c7bff', 'Suggestions', S.claSuggest !== false, v => { S.claSuggest = v; Store.save(); }, 'Apps you usually open and next steps, worked out on this phone'),
        toggle('volume-2', '#ff5c7a', 'Read replies aloud', !!S.claSpeak, v => { S.claSpeak = v; Store.save(); if (v) Speak.say('Clarice will read her replies aloud.'); })),
        label('Call Clarice'),
        note('Tap the Pets Island, press the Clarice key, hold the bar at the bottom of an app, hold the Search pill, or use the Clarice tile in Control Centre.'),
        card(row('message', '#3dd6a0', 'Open Clarice', null, () => Shell.open('pets:clarice')),
          row('trash-2', '#ff5c63', 'Clear conversation', null, async () => { if (await Dialog.confirm('Clear the conversation?', 'Everything you and Clarice said is removed from this phone.', 'Clear', true)) { Clarice.save([]); Shell.toast('Conversation cleared'); } })));
    };

    T.notifications = 'Notifications';
    P.notifications = body => {
      const d = dev();
      body.append(label('Show previews'), choice([['always', 'Always'], ['unlocked', 'When unlocked'], ['never', 'Never']], S.previews || 'always', v => { S.previews = v; Store.save(); Shell.renderLockNotes(); }));
      body.append(card(
        toggle('bell-off', '#8c7bff', 'Focus', S.dnd, v => { S.dnd = v; Store.save(); }, 'Silences banners and sounds'),
        toggle('volume-2', '#ff5c7a', 'Read new alerts aloud', !!S.speakNotes, v => { S.speakNotes = v; Store.save(); })));
      if (!isWeb) body.append(card(row('bell', '#ff5c63', 'Phone notifications in Pets OS', d.notifAccess ? 'Allowed' : 'Off', () => Phone.settings('notifications'), 'Android Notification access')));
      body.append(label('Pets OS apps'));
      const c = h('div', { class: 'card' });
      Object.values(Apps.builtin).filter(a => a.id.startsWith('pets:') && !a.launch && a.id !== 'pets:settings').sort((a, b) => a.name.localeCompare(b.name)).forEach(a => {
        const off = (S.notifOff || []).indexOf(a.id) >= 0;
        c.append(toggle(null, null, a.name, !off, v => { S.notifOff = (S.notifOff || []).filter(x => x !== a.id).concat(v ? [] : [a.id]); Store.save(); }));
      });
      body.append(c, note('When an app is off, its alerts are not shown or kept.'));
    };

    T.sounds = 'Sounds & Haptics';
    P.sounds = body => {
      body.append(label('Alert sound'), choice(Chimes.list, S.alertSound || 'chime', v => { S.alertSound = v; Store.save(); Chimes.play(v); }));
      body.append(card(toggle('smartphone', '#5d6680', 'Haptics', S.haptics !== false, v => { S.haptics = v; Store.save(); if (v) Phone.vibrate(20); }, 'Small buzzes when you tap, pet Pip or get an alert')));
      if (!isWeb) {
        const s = json(Phone.sound(), {});
        body.append(label('Ringer'), seg([['normal', 'Ring'], ['vibrate', 'Vibrate'], ['silent', 'Silent']], s.mode, m => { if (!Phone.setRingerMode(m) && m === 'silent') Shell.toast('Allow Do Not Disturb access for Pets OS, then try again'); }));
        const c = h('div', { class: 'card' });
        [['ring', 'Ringtone', 'bell'], ['notification', 'Notifications', 'bell-ring'], ['media', 'Music & videos', 'music'], ['alarm', 'Alarms', 'clock']].forEach(([k, t, g]) => {
          const v = s[k]; if (!v) return;
          const range = h('input', { type: 'range', min: 0, max: v.max, value: v.now, style: { width: '100%', accentColor: 'var(--accent)' } });
          range.onchange = () => { Phone.setVolume(k, +range.value); Phone.vibrate(10); };
          c.append(h('div', { class: 'row', style: { display: 'block' } }, h('div', { class: 'vol-head', html: icon(g) + '<span>' + t + '</span>' }), range));
        });
        body.append(c, card(row('settings', '#5d6680', 'Ringtones and more', null, () => Phone.settings('sound'))));
      } else body.append(note('Ringtone and volume are set by the phone itself.'));
    };

    T.display = 'Display & Text Size';
    P.display = body => {
      body.append(label('Appearance'), seg([['light', 'Light'], ['dark', 'Dark'], ['auto', 'Automatic']], S.themeAuto ? 'auto' : S.theme, v => {
        if (v === 'auto') { S.themeAuto = true; Store.save(); Prefs.autoTheme(); } else { S.themeAuto = false; Store.save(); Settings.setTheme(v); }
      }), note('Automatic is dark from 7 pm to 7 am.'));
      // Text size: a slider with a live sample.
      const sizes = [0.9, 1, 1.1, 1.2, 1.35, 1.5];
      const cur = Math.max(0, sizes.indexOf(S.textScale || 1));
      const sample = h('div', { class: 'ts-sample', text: 'Apps that use text will change to this size.' });
      const range = h('input', { type: 'range', min: 0, max: sizes.length - 1, step: 1, value: cur, class: 'ts-range', 'aria-label': 'Text size' });
      range.oninput = () => { Prefs.set('textScale', sizes[+range.value]); };
      body.append(label('Text Size'), h('div', { class: 'card ts-card' }, sample, h('div', { class: 'ts-row' }, h('span', { class: 'a-small', text: 'A' }), range, h('span', { class: 'a-big', text: 'A' }))));
      body.append(card(
        toggle(null, null, 'Bold text', !!S.boldText, v => Prefs.set('boldText', v)),
        toggle(null, null, 'Easier reading', !!S.easyRead, v => Prefs.set('easyRead', v), 'More space between letters, words and lines')));
      if (!isWeb) body.append(card(row('sun', '#3d7bff', 'Brightness', null, () => Phone.settings('display'))));
      body.append(card(toggle('clock', '#8c7bff', '24-hour time', S.use24h, v => { S.use24h = v; Store.save(); Shell.tick(); })));
    };

    T.wallpaper = 'Wallpaper';
    P.wallpaper = body => {
      const grid = h('div', { class: 'wall-grid' });
      Wallpapers.list.forEach(wp => {
        const t = h('button', { class: 'wall-tile' + (S.wallpaper === wp.id ? ' on' : ''), style: { background: wp.css + ' center/cover' } }, h('span', { text: wp.name }));
        t.onclick = () => { S.wallpaper = wp.id; Store.save(); Wallpapers.apply(); w.refresh(); };
        grid.append(t);
      });
      body.append(grid, note('To use one of your photos, open it in Moments and tap Wallpaper.' + (Moods.conf(S.mood || 'everyday').wall ? ' Your current mood shows its own wallpaper; change that in Moods.' : '')));
    };

    T.home = 'Home Screen & Dock';
    P.home = body => {
      body.append(card(
        toggle(null, null, 'App names', !S.hideLabels, v => Prefs.set('hideLabels', !v)),
        toggle(null, null, 'Search pill', !S.hidePill, v => Prefs.set('hidePill', !v), 'Above the Dock; hold it for Clarice'),
        toggle(null, null, 'Today widget', S.home.some(p => p.indexOf('widget:today') >= 0), v => {
          if (v) { if (!S.home.some(p => p.indexOf('widget:today') >= 0)) S.home[0].unshift('widget:today'); } else S.home = S.home.map(p => p.filter(x => x !== 'widget:today'));
          Store.save(); Shell.buildHome();
        }),
        toggle(null, null, Pip.data().name + ' widget', S.home.some(p => p.indexOf('widget:pip') >= 0), v => {
          if (v) { if (!S.home.some(p => p.indexOf('widget:pip') >= 0)) S.home[0].splice(Math.max(0, S.home[0].indexOf('widget:today') + 1), 0, 'widget:pip'); } else S.home = S.home.map(p => p.filter(x => x !== 'widget:pip'));
          Store.save(); Shell.buildHome();
        }),
        !isWeb ? toggle(null, null, 'Add new apps to Home Screen', S.autoAddAndroid, v => { S.autoAddAndroid = v; Store.save(); }) : null,
        !isWeb ? row('house', '#3dd6a0', 'Default home app', dev().defaultHome ? 'Pets OS' : 'Not Pets OS', () => Phone.askToBeHome()) : null));
      body.append(card(
        row('layout-grid', '#3d7bff', 'Edit Home Screen', null, () => { Shell.goHome(); setTimeout(() => Shell.setEditing(true), 250); }, 'Drag icons to move them'),
        row('rotate', '#5d6680', 'Reset Home Screen layout', null, resetLayout)));
      if (!isWeb && (huawei() || Apps.android.some(a => Apps.isHuawei(a.pkg)))) body.append(card(row('layout-grid', '#ff5c63', 'Huawei apps', S.hideHuawei ? 'Hidden' : 'Shown', () => w.push('Huawei apps', huaweiPage))));
    };
    const resetLayout = async () => {
      if (!(await Dialog.confirm('Reset the Home Screen?', 'Icons go back to where Pets OS first put them. Apps are not deleted.', 'Reset'))) return;
      S.home = null; Shell.ensureHome(); S.dock = Store.defaults().dock; Store.save(); Shell.buildHome(); Shell.toast('Home Screen reset');
    };
    const huaweiPage = body => {
      const theirs = Apps.android.filter(a => Apps.isHuawei(a.pkg));
      body.append(card(toggle('layout-grid', '#ff5c63', 'Hide Huawei apps', S.hideHuawei, v => { Shell.setHideHuawei(v); w.refresh(); }, 'Keeps them out of Rest and the Home Screen')),
        note('Hidden apps stay installed and keep working. Huawei Camera and Gallery stay visible. Pets OS can\'t remove Huawei\'s system or its start-up logo.'));
      const c = h('div', { class: 'card' });
      theirs.forEach(a => { const r = h('div', { class: 'row' }, h('div', { class: 'grow', text: a.label }), h('span', { class: 'val', text: 'Open' })); press(r, () => Phone.launch(a.pkg)); c.append(r); });
      if (theirs.length) body.append(c);
    };

    T.lock = 'Lock Screen';
    P.lock = body => {
      body.append(card(
        toggle(null, null, Pip.data().name, S.lockPip !== false, v => Prefs.set('lockPip', v)),
        toggle(null, null, 'Widgets', S.lockWidgets !== false, v => Prefs.set('lockWidgets', v), 'Mood, battery, weather and next event'),
        toggle(null, null, 'Notifications', S.lockNotes !== false, v => Prefs.set('lockNotes', v)),
        toggle(null, null, 'Bold clock', !!S.lockClockBold, v => Prefs.set('lockClockBold', v))));
      if (isWeb) {
        body.append(label('Auto-Lock'), choice([[30000, '30 seconds'], [60000, '1 minute'], [300000, '5 minutes'], [0, 'Never']], S.autoLockMs == null ? 30000 : S.autoLockMs, v => { S.autoLockMs = v; Store.save(); }),
          note('How long Pets OS can be in the background before it asks for your passcode again.' + (S.pin ? '' : ' It only matters with a passcode on.')));
      } else body.append(note('The phone locks when the screen turns off.'));
      body.append(card(row('lock', '#5b5f7a', 'Lock now', null, () => { Shell.goHome(true); Shell.lock(); })));
    };

    T.accessibility = 'Accessibility';
    P.accessibility = body => {
      body.append(label('Vision'), card(
        row('sun', '#3d7bff', 'Text Size', Math.round((S.textScale || 1) * 100) + '%', go('display')),
        toggle(null, null, 'Bold text', !!S.boldText, v => Prefs.set('boldText', v)),
        toggle(null, null, 'Easier reading', !!S.easyRead, v => Prefs.set('easyRead', v), 'Wider spacing between letters, words and lines'),
        toggle(null, null, 'Reduce transparency', !!S.reduceTrans, v => Prefs.set('reduceTrans', v), 'Solid backgrounds instead of see-through glass'),
        toggle(null, null, 'Reduce motion', !!S.reduceMotion, v => { S.reduceMotion = v; Store.save(); Settings.applyMotion(); }, 'No zooms, slides or fades')));
      body.append(label('Read aloud'));
      if (!Speak.ok()) body.append(note('This browser has no speaking voice.'));
      else {
        body.append(card(
          toggle('volume-2', '#ff5c7a', 'Clarice\'s replies', !!S.claSpeak, v => { S.claSpeak = v; Store.save(); }),
          toggle('bell', '#ff5c63', 'New alerts', !!S.speakNotes, v => { S.speakNotes = v; Store.save(); })),
          label('Voice speed'), seg([[0.8, 'Slower'], [1, 'Normal'], [1.2, 'Faster']], S.speechRate || 1, v => { S.speechRate = v; Store.save(); Speak.say('This is how fast I will speak.'); }),
          card(row('play', '#3dd6a0', 'Try the voice', null, () => Speak.say('Hello' + (S.name ? ' ' + S.name : '') + '. This is Pets OS reading aloud.'))));
      }
      body.append(label('Touch'), card(toggle(null, null, 'Haptics', S.haptics !== false, v => { S.haptics = v; Store.save(); })));
      if (!isWeb) body.append(card(row('settings', '#5d6680', 'Android accessibility', null, () => Phone.settings('accessibility'))));
    };

    T.passcode = 'Passcode';
    P.passcode = body => {
      const ask = async () => {
        const p = await Dialog.prompt('New passcode', '4 to 6 digits', '', { type: 'password', inputmode: 'numeric', max: 6 });
        if (p == null) return;
        if (!/^\d{4,6}$/.test(p)) { Shell.toast('Use 4 to 6 digits'); return; }
        const p2 = await Dialog.prompt('Type it again', null, '', { type: 'password', inputmode: 'numeric', max: 6 });
        if (p2 !== p) { Shell.toast('The passcodes didn\'t match'); return; }
        Shell.setPin(p); Shell.toast('Passcode set'); w.refresh();
      };
      const check = async () => {
        if (!S.pin) return true;
        const p = await Dialog.prompt('Current passcode', null, '', { type: 'password', inputmode: 'numeric', max: 6 });
        if (p != null && Shell.hashPin(p, S.salt) === S.pin) return true;
        if (p != null) Shell.toast('Wrong passcode');
        return false;
      };
      body.append(card(
        row('lock', '#ff5c63', S.pin ? 'Change passcode' : 'Turn passcode on', null, async () => { if (await check()) ask(); }),
        S.pin ? row('lock', '#5d6680', 'Turn passcode off', null, async () => { if (await check()) { Shell.setPin(null); Shell.toast('Passcode off'); w.refresh(); } }) : null),
        note('The passcode guards the Pets OS lock screen. It is stored as a salted SHA-256 hash, and 5 wrong tries pause entry for 30 seconds.' + (isStephone ? ' On the Stephone you can also hold the Power key to unlock with your fingerprint.' : '')));
    };

    T.privacy = 'Privacy & Security';
    P.privacy = body => {
      body.append(note('Pets OS keeps your notes, events, photos, Pip, Clarice\'s conversation and your settings on this phone. Only weather and web searches go out to the internet.'));
      body.append(card(
        row('lock', '#ff5c63', 'Passcode', S.pin ? 'On' : 'Off', go('passcode')),
        toggle('sparkles', '#8c7bff', 'Clarice suggestions', S.claSuggest !== false, v => { S.claSuggest = v; Store.save(); }, 'Uses which apps you open and when, on this phone only')));
      body.append(card(
        row('trash-2', '#ff5c63', 'Clear app history', null, async () => { if (await Dialog.confirm('Clear app history?', 'Clarice forgets which apps you open and when.', 'Clear', true)) { Store.setApp('usage', {}); S.recentApps = []; Store.save(); Shell.toast('App history cleared'); } }),
        row('trash-2', '#ff5c63', 'Clear Clarice conversation', null, async () => { if (await Dialog.confirm('Clear the conversation?', null, 'Clear', true)) { Clarice.save([]); Shell.toast('Conversation cleared'); } })));
      if (!isWeb) body.append(card(row('shield', '#3d7bff', 'Android security', null, () => Phone.settings('security'))));
    };

    T.battery = 'Battery';
    P.battery = body => {
      const b = json(Phone.battery(), {});
      const lvl = b.level >= 0 ? b.level : null;
      body.append(h('div', { class: 'card batt-card' },
        h('div', { class: 'batt-big', text: lvl == null ? '–' : lvl + '%' }),
        h('div', { class: 'batt-bar' }, h('i', { style: { width: (lvl || 0) + '%', background: lvl != null && lvl <= 20 ? 'var(--danger)' : 'var(--success)' } })),
        h('div', { class: 'sub', text: b.charging ? 'Charging' : lvl == null ? 'This phone doesn\'t share its battery level' : 'On battery' })));
      body.append(card(toggle('zap', '#ffb84d', 'Low Power Mode', !!S.lowPower, v => {
        S.lowPower = v; Store.save(); if (v) Settings.setTheme('dark');
        Settings.applyMotion(); Shell.toast(v ? 'Low Power Mode on: dark and still' : 'Low Power Mode off');
      }, 'Dark look and no movement, to save power')));
      if (!isWeb) body.append(card(row('battery-full', '#3dd6a0', 'Android battery settings', null, () => Phone.settings('battery'))));
    };

    T.storage = 'Storage';
    P.storage = body => {
      const names = { pen: 'Pen', clarice: 'Clarice', pip: 'Pip', usage: 'App history', clock: 'Clock', calendar: 'Calendar', activities: 'Activities', 'weather.last': 'Weather', weather: 'Weather places', 'wallpaper.custom': 'Your wallpaper' };
      const items = [];
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i); if (!k || !k.startsWith('petsos.')) continue;
        const size = (localStorage.getItem(k) || '').length * 2; total += size;
        if (k.startsWith('petsos.app.')) { const id = k.slice(11); items.push({ k, id, name: names[id] || id, size }); }
      }
      const fmt = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
      const head = h('div', { class: 'card batt-card' }, h('div', { class: 'batt-big', text: fmt(total) }), h('div', { class: 'sub', text: 'Pets OS settings and app data on this phone (photos in Moments not included)' }));
      body.append(head);
      if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { if (e && e.usage) head.append(h('div', { class: 'sub', text: 'All Pets OS storage, with photos: ' + fmt(e.usage) })); }).catch(() => {});
      items.sort((a, b) => b.size - a.size);
      const c = h('div', { class: 'card' });
      items.forEach(it => c.append(row(null, null, it.name, fmt(it.size), async () => {
        if (await Dialog.confirm('Clear ' + it.name + '?', 'Its data on this phone is deleted.', 'Clear', true)) { localStorage.removeItem(it.k); Shell.toast(it.name + ' cleared'); w.refresh(); }
      })));
      if (items.length) body.append(label('Apps'), c);
      if (!isWeb) body.append(card(row('hard-drive', '#5d6680', 'Phone storage', (() => { const st = json(Phone.storageInfo(), {}); return st.total ? Files.size(st.free) + ' free' : null; })(), () => Shell.open('pets:files'))));
    };

    T.general = 'General';
    P.general = body => {
      body.append(card(pageRow('info', '#5d6680', 'about'), pageRow('download', '#3d7bff', 'update', 'Pets OS ' + PETS_VERSION)));
      body.append(card(pageRow('clock', '#8c7bff', 'datetime')));
      if (!isWeb) {
        const d = dev();
        body.append(label('Start-up'), card(
          row('power', '#3dd6a0', 'Start with the phone', d.defaultHome ? 'On' : 'Off', () => startUp(d)),
          huawei() ? row('shield', '#ff5c63', 'Allow auto-launch', null, () => Phone.autoLaunchSettings(), 'Huawei: let Pets OS start by itself') : null));
      }
      body.append(card(pageRow('rotate', '#ff5c63', 'reset')));
    };
    const startUp = d => {
      if (d.defaultHome) { Dialog.menu('Start with the phone is on', 'Pets OS is your home app, so Android opens it every time the phone turns on.', [{ label: 'Choose a different home app', fn: () => Phone.settings('home') }]); return; }
      Phone.setStartOnBoot(true); Phone.askToBeHome(); Shell.toast('Choose Pets OS so it opens when the phone turns on');
    };

    T.about = 'About';
    P.about = body => {
      const d = dev();
      body.append(h('div', { class: 'about-head' }, h('div', { class: 'about-logo' }), h('div', { class: 'about-name', text: 'Pets OS for Stephone' }), h('div', { class: 'sub', text: 'Version ' + PETS_VERSION }), h('div', { class: 'sub about-creator', text: 'Created by Fionn Mpho Mwaba' })));
      const c = h('div', { class: 'card' });
      [['Created by', 'Fionn Mpho Mwaba'], ['Name', S.name || '–'], ['Phone', platformName()], ['Runs on', isStephone ? 'Stephone simulator' : isWeb ? (/iPhone|iPad/.test(navigator.userAgent) ? 'iOS (web app)' : 'Web browser') : 'Android ' + (d.android || '–')],
        ['Pets OS apps', Object.keys(Apps.builtin).filter(k => k.startsWith('pets:') || k.startsWith('store:')).length], isWeb ? null : ['Android apps', Apps.android.length], ['Mood', Moods.current().name], ['Pet', Pip.data().name]]
        .filter(Boolean).forEach(([k, v]) => c.append(h('div', { class: 'row' }, h('span', { class: 'grow', text: k }), h('span', { class: 'val', text: String(v) }))));
      body.append(c, label('Credits'), card(h('div', { class: 'row credits', text: 'Pets OS is a new operating system created by Fionn Mpho Mwaba, published by Should Be Media (petsos.shouldbe.media). Inter typeface © The Inter Project Authors (SIL Open Font Licence). Icons from Lucide (ISC licence). Weather data by Open-Meteo.com (CC BY 4.0).' })));
    };

    T.update = 'Software Update';
    P.update = body => {
      const box = h('div');
      body.append(h('div', { class: 'card' }, h('div', { class: 'row', style: { padding: '16px' } }, h('div', { class: 'about-logo small' }),
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600, fontSize: '18px' }, text: 'Pets OS ' + PETS_VERSION }), h('div', { class: 'sub', text: 'Installed' })))), box);
      if (isWeb) { box.append(note('On ' + platformName() + ', Pets OS updates itself: a new version loads the next time you open it.')); return; }
      const show = u => {
        box.innerHTML = '';
        if (u.error) { box.append(note('Couldn\'t check for updates. Check the internet connection and try again.')); const b = h('button', { class: 'btn block secondary', text: 'Try again' }); b.onclick = run; box.append(b); }
        else if (u.versionCode > u.currentCode) {
          const dl = h('button', { class: 'btn block', html: icon('download') + ' Download and install ' + esc(u.version) });
          dl.onclick = () => { Phone.openExternal(u.url) || Shell.toast('Couldn\'t open the download'); };
          box.append(card(h('div', { class: 'row', style: { display: 'block', padding: '16px', lineHeight: 1.5 } }, h('div', { style: { fontWeight: 600 }, text: 'Pets OS ' + u.version + ' is available' }), h('div', { class: 'sub', style: { whiteSpace: 'pre-wrap' }, text: u.notes || '' }))), dl);
        } else box.append(h('div', { class: 'empty-state', style: { padding: '30px 20px' }, html: icon('circle-check') + '<br>Pets OS is up to date.' }));
      };
      const run = () => { box.innerHTML = '<div class="empty-state" style="padding:30px 20px">Checking…</div>'; Updates.check().then(show); };
      run();
    };

    T.datetime = 'Date & Time';
    P.datetime = body => {
      let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* ignore */ }
      body.append(card(toggle(null, null, '24-hour time', S.use24h, v => { S.use24h = v; Store.save(); Shell.tick(); w.refresh(); }),
        h('div', { class: 'row' }, h('span', { class: 'grow', text: 'Time now' }), h('span', { class: 'val', text: Fmt.time() + (S.use24h ? '' : ' ' + Fmt.ampm(new Date())) })),
        h('div', { class: 'row' }, h('span', { class: 'grow', text: 'Time zone' }), h('span', { class: 'val', text: tz.replace(/_/g, ' ') || '–' }))),
        note('The date and time come from the phone.'));
    };

    T.reset = 'Reset';
    P.reset = body => {
      body.append(card(
        row('layout-grid', '#3d7bff', 'Reset Home Screen layout', null, resetLayout),
        row('rotate', '#ffb84d', 'Reset all settings', null, async () => {
          if (!(await Dialog.confirm('Reset all settings?', 'Settings go back to how they started. Your name, passcode, notes, photos, events and Pip stay.', 'Reset settings', true))) return;
          const keep = ['name', 'pin', 'salt', 'pinLength', 'setupDone', 'home', 'dock', 'knownAndroid', 'addedFiles', 'addedPip', 'pipHello'];
          const fresh = Store.defaults(); keep.forEach(k => { if (S[k] !== undefined) fresh[k] = S[k]; });
          Object.keys(S).forEach(k => delete S[k]); Object.assign(S, fresh); Store.save(); location.reload();
        }),
        row('trash-2', '#ff5c63', 'Erase Pets OS and start fresh', null, async () => {
          if (!(await Dialog.confirm('Start Pets OS fresh?', 'This erases Pets OS settings, notes, events, photos in Moments, Pip, activities and the passcode on this phone, then starts setup again.' + (isWeb ? '' : ' Your Android apps are not touched.'), 'Erase Pets OS data', true))) return;
          localStorage.clear(); try { indexedDB.deleteDatabase('petsos-moments'); } catch (e) { /* ignore */ }
          location.reload();
        })));
    };

    Settings.main = main;
    w.root(main);
    w.onShow = () => { if (!w.stack.length) w.refresh(); };
  }
});

// Text that speaks: hold any text in Clarice's answers to hear it is handled by the panel; also used by search.
window.SettingsPageNames = SettingsPageNames; window.Prefs = Prefs; window.Speak = Speak; window.SettingsIndex = SettingsIndex; window.Chimes = Chimes;
