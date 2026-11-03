// Pets OS for Stephone, round 2 of features no other phone has.
//   Pip Guard     - wrong passcode tries make Pip bark on the lock screen; after you unlock, Pip tells you
//                   how many tries there were and when.
//   Pip Wardrobe  - accessories for Pip, unlocked by looking after yourself: visiting each day, focus
//                   walks, writing a Time Capsule. Pip wears one on the Home Screen and lock screen.
//   Wind Down     - at bedtime the screen turns warm and dim, and can go grey, to make putting the phone
//                   down easier. Follows Sleep mood or the night hours.
'use strict';

// ================================================================ Pip Guard
const PipGuard = {
  tries: [],
  log() { return Store.app('pipguard', []); },
  wrong() {
    this.tries.push(Date.now());
    const lockPip = $('#lock .lock-pip');
    if (this.tries.length >= 2) {
      Pip.speak(this.tries.length >= 3 ? 'WOOF! Not the owner!' : 'Woof! That\'s not the code.', 2500);
      Pip.excitedUntil = Date.now() + 1500;
      if (lockPip) Pip.draw(lockPip);
      Phone.vibrate(200);
    }
  },
  unlocked() {
    if (this.tries.length >= 2) {
      const n = this.tries.length, first = this.tries[0];
      const l = this.log(); l.unshift({ at: first, tries: n }); Store.setApp('pipguard', l.slice(0, 50));
      setTimeout(() => Shell.notify('Pip Guard', n + ' wrong passcode tries at ' + Fmt.time(new Date(first)) + ' while the phone was locked. ' + Pip.data().name + ' barked at them.', { app: 'pets:settings', glyph: 'shield' }), 600);
    }
    this.tries = [];
  }
};
(orig => { Shell.checkPin = function () {
  const fails = this.pinFails, lockedUntil = S.pinLockUntil || 0;
  const ok = this.hashPin(this.pinEntry, S.salt) === S.pin && Date.now() >= lockedUntil;
  orig.call(this);
  if (ok) PipGuard.unlocked();
  else if (this.pinFails !== fails || (S.pinLockUntil || 0) !== lockedUntil) PipGuard.wrong();
}; })(Shell.checkPin);

// ================================================================ Pip Wardrobe
const Wardrobe = {
  items: [
    { id: 'bow', name: 'Bow', need: 'Free', ok: () => true },
    { id: 'glasses', name: 'Sunglasses', need: 'Visit 3 days in a row', ok: s => s.streak >= 3 },
    { id: 'party', name: 'Party hat', need: 'Finish 5 Pip Walks', ok: s => s.walks >= 5 },
    { id: 'scarf', name: 'Scarf', need: 'Write a Time Capsule', ok: s => s.capsules >= 1 },
    { id: 'crown', name: 'Crown', need: 'Visit 7 days in a row', ok: s => s.streak >= 7 }
  ],
  data() { return Store.app('wardrobe', { days: [], wearing: null }); },
  save(d) { Store.setApp('wardrobe', d); },
  // One visit per day; the streak counts days in a row up to today.
  visit() {
    const d = this.data(), k = Calendar.key(new Date());
    if (d.days[d.days.length - 1] !== k) { d.days.push(k); d.days = d.days.slice(-60); this.save(d); }
    const before = this.unlocked().map(i => i.id);
    this.notifyNew(before);
  },
  streak() {
    const days = new Set(this.data().days); let n = 0; const t = new Date();
    for (;;) { const k = Calendar.key(new Date(t.getFullYear(), t.getMonth(), t.getDate() - n)); if (!days.has(k)) break; n++; }
    return n;
  },
  stats() { return { streak: this.streak(), walks: PipWalk.data().log.filter(e => e.done).length, capsules: Capsule.list().length }; },
  unlocked() { const s = this.stats(); return this.items.filter(i => i.ok(s)); },
  seen() { return Store.app('wardrobe.seen', ['bow']); },
  notifyNew() {
    const seen = this.seen(), now = this.unlocked().map(i => i.id), fresh = now.filter(id => seen.indexOf(id) < 0);
    if (!fresh.length) return;
    Store.setApp('wardrobe.seen', seen.concat(fresh));
    const it = this.items.find(i => i.id === fresh[0]);
    Shell.notify('New for ' + Pip.data().name + ': ' + it.name, 'Open Pip and tap Wardrobe to try it on.', { app: 'pets:pip', glyph: 'star' });
  },
  // Pip wearing an item, for the wardrobe buttons.
  preview(id) {
    const d = this.data(), was = d.wearing; d.wearing = id; this.save(d);
    const svg = Pip.svg('happy').replace('class="pip-svg m-happy"', 'class="pip-svg"');
    d.wearing = was; this.save(d);
    return svg;
  },
  wear(id) { const d = this.data(); d.wearing = id; this.save(d); Pip.refresh(); if (window.LockExtras) LockExtras.render(); },
  // The accessory, drawn on the same 120 × 120 grid as Pip.
  svg(id) {
    switch (id) {
      case 'bow': return '<g transform="translate(60 26)"><path d="M0 0 L-14 -8 L-14 8 Z M0 0 L14 -8 L14 8 Z" fill="#ff5c7a"/><circle r="4" fill="#ff8fa3"/></g>';
      case 'glasses': return '<g><rect x="37" y="40" width="20" height="13" rx="5" fill="#16181f"/><rect x="63" y="40" width="20" height="13" rx="5" fill="#16181f"/><path d="M57 45 h6" stroke="#16181f" stroke-width="3"/><path d="M40 43 l6 0" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round"/></g>';
      case 'party': return '<g><path d="M60 0 L46 30 L74 30 Z" fill="#5b8cff"/><path d="M53 15 L67 15 M50 22 L70 22" stroke="#ffb84d" stroke-width="3"/><circle cx="60" cy="0" r="4" fill="#ff5c7a"/></g>';
      case 'scarf': return '<g><path d="M33 70 Q60 82 87 70 L87 77 Q60 89 33 77 Z" fill="#3dd6a0"/><path d="M72 76 L76 96 L84 94 L80 74 Z" fill="#2fb88a"/></g>';
      case 'crown': return '<g><path d="M42 26 L46 8 L54 20 L60 4 L66 20 L74 8 L78 26 Z" fill="#ffcf4d" stroke="#e0a800" stroke-width="1.5"/><circle cx="60" cy="16" r="2.6" fill="#ff5c7a"/></g>';
    }
    return '';
  }
};
(orig => { Pip.svg = function (mood, d) {
  const s = orig.call(this, mood, d), w = Wardrobe.data().wearing;
  if (!w) return s;
  const i = s.lastIndexOf('</g>', s.indexOf('<g class="zzz"') > 0 ? s.indexOf('<g class="zzz"') : s.length);
  return s.slice(0, i) + Wardrobe.svg(w) + s.slice(i);
}; })(Pip.svg);
// Wardrobe card in the Pip app, under the walk card.
(orig => { Apps.builtin['pets:pip'].open = function (w) {
  orig.call(this, w);
  const draw = w._render;
  w._render = body => {
    draw(body);
    const d = Wardrobe.data(), have = Wardrobe.unlocked().map(i => i.id), st = Wardrobe.stats();
    const grid = h('div', { class: 'wardrobe' });
    const none = h('button', { class: 'ward-item' + (!d.wearing ? ' on' : '') }, h('div', { class: 'ward-pic', html: icon('x') }), h('span', { text: 'Nothing' }));
    none.onclick = () => { Wardrobe.wear(null); w.refresh(); };
    grid.append(none);
    Wardrobe.items.forEach(it => {
      const owned = have.indexOf(it.id) >= 0;
      const b = h('button', { class: 'ward-item' + (d.wearing === it.id ? ' on' : '') + (owned ? '' : ' locked'), 'aria-label': it.name },
        h('div', { class: 'ward-pic', html: Wardrobe.preview(it.id) + (owned ? '' : icon('lock')) }), h('span', { text: owned ? it.name : it.need }));
      b.onclick = () => { if (!owned) { Shell.toast(it.name + ': ' + it.need); return; } Wardrobe.wear(it.id); w.refresh(); };
      grid.append(b);
    });
    const card = h('div', { class: 'card walk-card' }, h('div', { class: 'walk-head', html: icon('star') + '<b>Wardrobe</b>' }),
      h('p', { class: 'sub', text: 'Unlock things for ' + Pip.data().name + ' by looking after yourself. Streak: ' + st.streak + ' day' + (st.streak === 1 ? '' : 's') + ' · Walks: ' + st.walks + '.' }), grid);
    body.insertBefore(card, body.children[3] || null);
  };
  w.refresh();
}; })(Apps.builtin['pets:pip'].open);

// ================================================================ Wind Down
const WindDown = {
  el: null,
  init() { this.el = h('div', { id: 'winddown' }); $('#phone').append(this.el); this.apply(); setInterval(() => this.apply(), 60000); },
  night() { const hr = new Date().getHours(); return S.mood === 'sleep' || hr >= 22 || hr < 6; },
  active() { return S.windDown !== false && this.night(); },
  apply() {
    const on = this.active();
    document.documentElement.classList.toggle('wind-down', on);
    document.documentElement.classList.toggle('wind-grey', on && !!S.windGrey);
  }
};
(orig => { Moods.apply = function (...a) { const r = orig.apply(this, a); WindDown.apply(); return r; }; })(Moods.apply);
// Settings > Display & Text Size gets a Wind Down section.
(orig => { Apps.builtin['pets:settings'].open = function (w) {
  orig.call(this, w);
  const disp = Settings.pages.display;
  Settings.pages.display = body => {
    disp(body);
    const toggle = (title, on, fn, sub) => {
      const t = h('div', { class: 'toggle' + (on ? ' on' : ''), role: 'switch' });
      const r = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { text: title }), sub ? h('div', { class: 'sub', text: sub }) : null), t);
      press(r, () => { const v = !t.classList.contains('on'); t.classList.toggle('on', v); fn(v); });
      return r;
    };
    body.append(h('div', { class: 'label', text: 'Wind Down' }), h('div', { class: 'card' },
      toggle('Warm, dim screen at night', S.windDown !== false, v => { S.windDown = v; Store.save(); WindDown.apply(); }, 'In Sleep mood and from 10 pm to 6 am'),
      toggle('Grey screen at bedtime', !!S.windGrey, v => { S.windGrey = v; Store.save(); WindDown.apply(); }, 'Colours fade so the phone is less tempting')),
      h('p', { class: 'set-note', text: WindDown.active() ? 'Wind Down is on now.' : 'Wind Down starts at 10 pm or when Sleep mood comes on.' }));
  };
}; })(Apps.builtin['pets:settings'].open);
SettingsIndex.push(['Wind Down', 'display', 'night shift warm screen grey greyscale bedtime sleep'], ['Pip Guard', 'passcode', 'security intruder wrong code']);

// Clarice
(orig => { Clarice.answer = async function (raw) {
  const q = String(raw || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  let m;
  if ((m = /^(?:put|dress) (?:pip|my pet) in (?:a |the )?(.+)$|^pip wear(?:s)? (?:a |the )?(.+)$/.exec(q))) {
    const want = (m[1] || m[2]).trim(), it = Wardrobe.items.find(i => i.name.toLowerCase() === want || i.id === want || i.name.toLowerCase().includes(want));
    if (!it) return 'The wardrobe has: ' + Wardrobe.items.map(i => i.name.toLowerCase()).join(', ') + '.';
    if (Wardrobe.unlocked().indexOf(it) < 0) return it.name + ' is still locked: ' + it.need.toLowerCase() + '.';
    Wardrobe.wear(it.id); return Pip.data().name + ' is wearing the ' + it.name.toLowerCase() + '. Very smart.';
  }
  if (/^(take off|remove) (pip'?s )?(hat|bow|glasses|sunglasses|scarf|crown|outfit)$/.test(q)) { Wardrobe.wear(null); return Pip.data().name + ' is back to just being ' + Pip.data().name + '.'; }
  if (/^(wind down|bedtime|night mode)( on)?$/.test(q)) { S.windDown = true; Store.save(); Moods.apply('sleep'); return 'Winding down: Sleep mood is on and the screen is warm and dim.'; }
  if (/^(did anyone|has anyone) try (to )?(unlock|get into) my phone$|^pip guard$/.test(q)) {
    const l = PipGuard.log(); return l.length ? 'Last time: ' + l[0].tries + ' wrong tries at ' + Fmt.time(new Date(l[0].at)) + ' on ' + new Date(l[0].at).toLocaleDateString() + '.' : 'Nobody has tried a wrong passcode. ' + Pip.data().name + ' is keeping watch.';
  }
  if (/help|what can you do/.test(q)) { const base = await orig.call(this, raw); return base + '\n• put Pip in the bow\n• wind down\n• did anyone try to unlock my phone?'; }
  return orig.call(this, raw);
}; })(Clarice.answer);

(orig => { Shell.start = function () {
  orig.call(this);
  WindDown.init();
  setTimeout(() => Wardrobe.visit(), 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Wardrobe.visit(); });
}; })(Shell.start);

window.PipGuard = PipGuard; window.Wardrobe = Wardrobe; window.WindDown = WindDown;
