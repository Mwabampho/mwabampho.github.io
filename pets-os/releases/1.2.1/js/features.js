// Pets OS for Stephone: features no other phone has.
//   Pip Walk     - a focus timer: Pip goes for a walk while you focus and comes home when it ends.
//                  The Pets Island shows Pip walking; opening a distracting app makes Pip look back sadly.
//   Time Capsule - write a message to your future self; it stays sealed until the day you chose,
//                  then Pip brings it to you.
//   Day Story    - in the evening Clarice tells the story of your day from what stayed on the phone:
//                  moods, activities, notes, focus walks, Pip. Nothing leaves the phone.
'use strict';

// ================================================================ Pip Walk
const PipWalk = {
  data() { return Store.app('pipwalk', { walk: null, log: [] }); },
  save(d) { Store.setApp('pipwalk', d); },
  current() { return this.data().walk; },
  start(min) {
    const d = this.data();
    d.walk = { start: Date.now(), end: Date.now() + min * 60000, min, peeks: 0 };
    this.save(d);
    Pip.speak('Off for a ' + min + '-minute walk!', 3000);
    Island.update();
    Shell.toast(Pip.data().name + ' is out for a walk. Focus until ' + Fmt.time(new Date(d.walk.end)) + '.');
  },
  stop(done) {
    const d = this.data(), w = d.walk; if (!w) return null;
    d.walk = null;
    const mins = Math.round((Math.min(Date.now(), w.end) - w.start) / 60000);
    const entry = { start: w.start, mins, done: !!done, peeks: w.peeks };
    d.log = [entry].concat(d.log).slice(0, 200); this.save(d);
    if (done) {
      const p = Pip.data(); p.happy = Math.min(100, Pip.stats(p).happy + 15); p.petted = Date.now(); Pip.save(p);
      Pip.excitedUntil = Date.now() + 3000;
      Shell.notify(p.name + ' is home!', 'You focused for ' + mins + ' minutes' + (w.peeks ? ' (' + w.peeks + ' peek' + (w.peeks > 1 ? 's' : '') + ')' : '') + '. ' + p.name + ' found a stick.', { app: 'pets:pip', glyph: 'paw' });
    }
    Island.update(); Pip.refresh();
    return entry;
  },
  tick() { const w = this.current(); if (w && Date.now() >= w.end) this.stop(true); },
  // Opening a distracting app during a walk counts as a peek; Pip notices.
  distracting: ['store:liveo', 'pets:moments', 'store:milo', 'pets:milo'],
  peek(id) {
    const d = this.data(); if (!d.walk || this.distracting.indexOf(id) < 0) return;
    d.walk.peeks++; this.save(d);
    Island.flash({ pip: true, title: Pip.data().name + ' looks back…', sub: 'Still ' + Fmt.dur(d.walk.end - Date.now()) + ' of the walk left', ms: 2600 });
  },
  minutesToday() { const k = Calendar.key(new Date()); return this.data().log.filter(e => Calendar.key(new Date(e.start)) === k).reduce((n, e) => n + e.mins, 0); }
};
// The island shows the walk when nothing else is live.
(orig => { Island.live = function () {
  const l = orig.call(this); if (l) return l;
  const w = PipWalk.current();
  if (w) return { glyph: 'paw', colour: '#3dd6a0', text: Fmt.dur(Math.max(0, w.end - Date.now())), open: () => Shell.open('pets:pip') };
  return null;
}; })(Island.live);
(orig => { Shell.open = function (id, fromEl) { PipWalk.peek(id); return orig.call(this, id, fromEl); }; })(Shell.open);
(orig => { Pip.say = function () {
  if (PipWalk.current() && !(this.line && Date.now() < this.lineUntil)) return 'Out on a walk…';
  return orig.call(this);
}; })(Pip.say);
// Walk controls in the Pip app.
(orig => { Apps.builtin['pets:pip'].open = function (w) {
  orig.call(this, w);
  const draw = w._render;
  w._render = body => {
    draw(body);
    const walk = PipWalk.current();
    const card = h('div', { class: 'card walk-card' });
    if (walk) {
      const left = h('div', { class: 'walk-left', text: Fmt.dur(Math.max(0, walk.end - Date.now())) });
      const stop = h('button', { class: 'btn secondary', text: 'Call ' + Pip.data().name + ' home' });
      stop.onclick = () => { PipWalk.stop(false); w.refresh(); };
      card.append(h('div', { class: 'walk-head', html: icon('paw') + '<b>Out on a walk</b>' }), left, h('p', { class: 'sub', text: 'Focus until Pip is back. Opening Moments, Milo or Liveo makes Pip look back.' }), stop);
      clearInterval(w.walkTimer); w.walkTimer = setInterval(() => { if (!PipWalk.current()) { clearInterval(w.walkTimer); w.refresh(); } else left.textContent = Fmt.dur(Math.max(0, walk.end - Date.now())); }, 1000);
    } else {
      const btns = h('div', { class: 'walk-btns' });
      [10, 25, 45].forEach(m => { const b = h('button', { class: 'btn', text: m + ' min' }); b.onclick = () => { PipWalk.start(m); w.refresh(); }; btns.append(b); });
      const today = PipWalk.minutesToday();
      card.append(h('div', { class: 'walk-head', html: icon('paw') + '<b>Pip Walk</b>' }),
        h('p', { class: 'sub', text: 'A focus timer: ' + Pip.data().name + ' goes for a walk while you focus and comes home happy when it ends.' + (today ? ' Today: ' + today + ' min.' : '') }), btns);
    }
    body.insertBefore(card, body.children[2] || null);
  };
  w.refresh();
}; })(Apps.builtin['pets:pip'].open);

// ================================================================ Time Capsule
const Capsule = {
  list() { return Store.app('capsule', []); },
  save(l) { Store.setApp('capsule', l); },
  add(text, openOn) { const l = this.list(); const c = { id: uid(), text, written: Date.now(), openOn, opened: false }; l.push(c); this.save(l); return c; },
  ready(c) { return Date.now() >= new Date(c.openOn + 'T00:00').getTime(); },
  // Pip brings any capsule whose day has come.
  deliver() {
    const l = this.list(); let changed = false;
    l.forEach(c => { if (!c.delivered && this.ready(c)) { c.delivered = true; changed = true; Shell.notify('A Time Capsule has arrived', Pip.data().name + ' brought a message you wrote on ' + new Date(c.written).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) + '.', { app: 'pets:capsule', glyph: 'archive' }); } });
    if (changed) this.save(l);
  }
};
Apps.register({
  id: 'pets:capsule', name: 'Capsule', glyph: 'archive', bg: 'linear-gradient(145deg,#8c7bff,#ff8fb1)', cat: 'Pets OS', keywords: 'time capsule future letter message memory',
  open(w) {
    const fmt = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    const write = () => w.push('New Capsule', body => {
      const t = h('textarea', { class: 'field', rows: 8, placeholder: 'Dear future me…' });
      const dt = new Date(Date.now() + 30 * 864e5);
      const date = h('input', { class: 'field', type: 'date', value: Calendar.key(dt), min: Calendar.key(new Date(Date.now() + 864e5)) });
      const quick = h('div', { class: 'walk-btns' });
      [['1 month', 30], ['6 months', 182], ['1 year', 365]].forEach(([l, d]) => { const b = h('button', { class: 'btn secondary', text: l }); b.onclick = () => { date.value = Calendar.key(new Date(Date.now() + d * 864e5)); }; quick.append(b); });
      const seal = h('button', { class: 'btn block', html: icon('lock') + ' Seal it' });
      seal.onclick = () => {
        if (!t.value.trim()) { Shell.toast('Write something first'); return; }
        if (!date.value || date.value <= Calendar.key(new Date())) { Shell.toast('Choose a day after today'); return; }
        Capsule.add(t.value.trim(), date.value); Shell.toast('Sealed until ' + fmt(date.value + 'T00:00')); w.back();
      };
      body.append(t, h('div', { class: 'label', text: 'Open on' }), date, quick, seal,
        h('p', { class: 'set-note', style: { marginTop: '12px' }, text: 'You can\'t read it until that day, then ' + Pip.data().name + ' brings it to you. It stays on this phone.' }));
    });
    const read = c => w.push('Time Capsule', body => {
      c.opened = true; const l = Capsule.list().map(x => x.id === c.id ? c : x); Capsule.save(l);
      body.append(h('div', { class: 'card capsule-letter' }, h('div', { class: 'sub', text: 'Written ' + fmt(c.written) }), h('div', { class: 'capsule-text', text: c.text })));
      const del = h('button', { class: 'btn block secondary', text: 'Delete', style: { color: 'var(--danger)' } });
      del.onclick = async () => { if (await Dialog.confirm('Delete this capsule?', null, 'Delete', true)) { Capsule.save(Capsule.list().filter(x => x.id !== c.id)); w.back(); } };
      body.append(del);
    });
    w.actions([{ icon: 'plus', label: 'New capsule', fn: write }]);
    w.root(body => {
      const l = Capsule.list().sort((a, b) => a.openOn > b.openOn ? 1 : -1);
      if (!l.length) {
        body.append(h('div', { class: 'empty-state', html: icon('archive') + '<br>Write a message to your future self.<br>It stays sealed until the day you choose.' }));
        const b = h('button', { class: 'btn block', text: 'Write a capsule' }); b.onclick = write; body.append(b); return;
      }
      const ready = l.filter(c => Capsule.ready(c)), sealed = l.filter(c => !Capsule.ready(c));
      if (ready.length) {
        body.append(h('div', { class: 'label', text: 'Ready to open' }));
        const card = h('div', { class: 'card' });
        ready.forEach(c => { const r = h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: '#8c7bff' }, html: icon(c.opened ? 'file-text' : 'archive') }), h('div', { class: 'grow' }, h('div', { text: c.opened ? 'Opened' : 'Tap to open' }), h('div', { class: 'sub', text: 'Written ' + fmt(c.written) })), h('span', { class: 'chev', html: icon('chevron-right') })); press(r, () => read(c)); card.append(r); });
        body.append(card);
      }
      if (sealed.length) {
        body.append(h('div', { class: 'label', text: 'Sealed' }));
        const card = h('div', { class: 'card' });
        sealed.forEach(c => { const days = Math.ceil((new Date(c.openOn + 'T00:00') - Date.now()) / 864e5); card.append(h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: '#5d6680' }, html: icon('lock') }), h('div', { class: 'grow' }, h('div', { text: 'Opens ' + fmt(c.openOn + 'T00:00') }), h('div', { class: 'sub', text: 'Written ' + fmt(c.written) })), h('span', { class: 'val', text: days + (days === 1 ? ' day' : ' days') }))); });
        body.append(card);
      }
    });
    w.onShow = () => { if (!w.stack.length) w.refresh(); };
  }
});

// ================================================================ Day Story
const DayStory = {
  tell(d) {
    d = d || new Date();
    const key = Calendar.key(d), name = Pip.data().name, who = S.name || 'you';
    const parts = [];
    const acts = (Activities.data().log || []).filter(e => Calendar.key(new Date(e.start)) === key);
    const notes = Pen.load().notes.filter(n => Calendar.key(new Date(n.created)) === key);
    const evs = Calendar.events().filter(e => e.date === key);
    const walks = PipWalk.minutesToday();
    const usage = Store.app('usage', {});
    const top = Object.keys(usage).filter(id => Apps.get(id)).sort((a, b) => usage[b].reduce((x, y) => x + y, 0) - usage[a].reduce((x, y) => x + y, 0))[0];
    const hr = d.getHours();
    parts.push((hr < 12 ? 'This morning' : hr < 18 ? 'Today' : 'Today') + ', ' + who + ' was in ' + Moods.current().name.toLowerCase() + ' mood.');
    if (evs.length) parts.push('The calendar had ' + evs.map(e => e.title).slice(0, 3).join(', ') + '.');
    if (acts.length) parts.push(who.charAt(0).toUpperCase() + who.slice(1) + ' logged ' + acts.map(a => a.name.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).join(', ') + '.');
    if (walks) parts.push(name + ' went on focus walks for ' + walks + ' minutes.');
    if (notes.length) parts.push(notes.length === 1 ? 'One new note went into Pen: "' + Pen.title(notes[0]) + '".' : notes.length + ' new notes went into Pen.');
    if (top) parts.push('The most-used app was ' + Apps.get(top).name + '.');
    const s = Pip.stats();
    parts.push(name + ' ends the day ' + (s.happy > 70 ? 'very happy' : s.happy > 40 ? 'content' : 'wanting some attention') + (s.full < 40 ? ' and a bit hungry' : '') + '.');
    return parts.join(' ');
  }
};
(orig => { Clarice.answer = async function (raw) {
  const q = String(raw || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  let m;
  if (/^(my day story|day story|tell me (about )?my day|how was my day|story of my day)$/.test(q)) return DayStory.tell();
  if ((m = /^(?:pip walk|walk pip|take pip for a walk|focus walk|start a walk)(?: for)?(?: (\d+))?(?: ?min(?:ute)?s?)?$/.exec(q))) { const n = Math.max(1, Math.min(180, +(m[1] || 25))); PipWalk.start(n); return Pip.data().name + ' is off on a ' + n + '-minute walk. Focus until ' + Fmt.time(new Date(PipWalk.current().end)) + '.'; }
  if (/^(stop|end) (the )?walk$|^call pip home$/.test(q)) { const e = PipWalk.stop(false); return e ? Pip.data().name + ' is home after ' + e.mins + ' minutes.' : Pip.data().name + ' isn\'t on a walk.'; }
  if (/^(time capsule|write a time capsule|new capsule|write to future me)$/.test(q)) { setTimeout(() => { ClaricePanel.close(); Shell.open('pets:capsule'); }, 400); return 'Opening Capsule. Write to your future self and choose when it opens.'; }
  if (/help|what can you do/.test(q)) { const base = await orig.call(this, raw); return base + '\n• pip walk 25\n• tell me about my day\n• time capsule'; }
  return orig.call(this, raw);
}; })(Clarice.answer);
// Evening suggestion: hear the story of the day.
(orig => { Clarice.tips = function () {
  const t = orig.call(this); const hr = new Date().getHours();
  if (hr >= 19 && t.length < 3) t.push({ text: 'Your day, as a story.', label: 'Day Story', fn: () => ClaricePanel.open('tell me about my day') });
  if (hr >= 9 && hr < 18 && !PipWalk.current() && t.length < 3) t.push({ text: 'Need to focus? ' + Pip.data().name + ' can go for a walk.', label: 'Pip Walk', fn: () => PipWalk.start(25) });
  return t;
}; })(Clarice.tips);

// Put Capsule on the Home Screen once; deliver capsules and finish walks every few seconds.
(orig => { Shell.start = function () {
  orig.call(this);
  if (!S.addedCapsule) { S.addedCapsule = true; const p = S.home[0]; if (p && p.indexOf('pets:capsule') < 0) p.splice(Math.max(0, p.indexOf('pets:settings')), 0, 'pets:capsule'); Store.save(); Shell.buildHome(); }
  setInterval(() => { PipWalk.tick(); Capsule.deliver(); }, 5000);
  setTimeout(() => Capsule.deliver(), 3000);
}; })(Shell.start);
SettingsIndex.push(['Pip Walk', 'pip', 'focus timer walk concentrate'], ['Time Capsule', 'pip', 'future message letter']);

window.PipWalk = PipWalk; window.Capsule = Capsule; window.DayStory = DayStory;
