// Pets OS for Stephone: the parts that make it a Stephone and not a copy of an iPhone.
//   Pip      - a pet that lives on the Home Screen and lock screen and reacts to the phone
//   Moods    - Everyday / Work / Chill / Sleep: one tap changes colour, wallpaper, alerts and apps
//   Island   - the Pets Island at the top: live timers and activities, Pip's reactions, Clarice
//   Clarice  - summoned from anywhere, suggests apps and next steps, understands moods and Pip
// Loaded after apps.js and store.js, before PetsOS.start().
'use strict';

// The Stephone simulator app (tools/stephone-sim) is a full-screen host on iOS that lets Pets OS draw
// its own status bar, like the real Stephone will. It says hello through a WebKit message handler.
const isStephone = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.stephone);
const Host = {
  post(msg) { try { window.webkit.messageHandlers.stephone.postMessage(msg); } catch (e) { /* not in the host */ } }
};
if (isStephone) {
  document.documentElement.classList.add('stephone');
  // The Stephone design has a round front camera: the idle Pets Island is a small circle round it.
  if (window.StephoneHost && window.StephoneHost.punch) document.documentElement.classList.add('punch');
  // The host keeps window.StephoneHost.battery up to date ({ level, charging }).
  Phone.battery = () => JSON.stringify((window.StephoneHost && window.StephoneHost.battery) || {});
  Phone.network = () => navigator.onLine ? 'wifi' : 'none';
  Phone.vibrate = ms => Host.post({ haptic: ms > 80 ? 'heavy' : ms > 30 ? 'medium' : 'light' });
  const dev = Phone.device;
  Phone.device = () => { const d = json(dev(), {}); d.manufacturer = 'Stephone'; d.model = (window.StephoneHost && window.StephoneHost.model) || 'Simulator'; return JSON.stringify(d); };
}
const hasIsland = isStephone || onPhone;

// Extra line icons (Lucide style, ISC).
Object.assign(ICONS, {
  paw: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  bed: ICONS.bed || '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  bone: '<path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.82-.7-1.8 0-2.5Z"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path d="M6 5.3a9 9 0 0 1 0 13.4"/><path d="M18 5.3a9 9 0 0 0 0 13.4"/>'
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hoursSince = t => (Date.now() - (t || Date.now())) / 36e5;
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = s => clamp(Math.round(((n >> s) & 255) * f), 0, 255);
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
}

// ================================================================ Moods
const Moods = {
  list: [
    { id: 'everyday', name: 'Everyday', glyph: 'sun', colour: '#5b8cff', colour2: '#8c7bff', text: 'Everything on, alerts on' },
    { id: 'work', name: 'Work', glyph: 'briefcase', colour: '#2fb8d8', colour2: '#3d7bff', text: 'Fewer distractions while you work' },
    { id: 'chill', name: 'Chill', glyph: 'coffee', colour: '#ff7a8a', colour2: '#ffb84d', text: 'Warm colours, play things first' },
    { id: 'sleep', name: 'Sleep', glyph: 'moon', colour: '#8c7bff', colour2: '#5b5f7a', text: 'Dark, quiet, Pip sleeps too' }
  ],
  defaults: {
    everyday: { wall: null, quiet: false, hide: [] },
    work: { wall: 'aurora', quiet: false, hide: ['pets:moments', 'pets:activities', 'store:liveo'] },
    chill: { wall: 'sunrise', quiet: false, hide: ['pets:calendar', 'pets:files'] },
    sleep: { wall: 'night', quiet: true, hide: ['pets:moments', 'pets:activities', 'pets:pen', 'pets:calendar', 'pets:files', 'store:liveo'] }
  },
  get(id) { return this.list.find(m => m.id === id) || this.list[0]; },
  current() { return this.get(S.mood || 'everyday'); },
  conf(id) { return Object.assign({}, this.defaults[id], (S.moodConf || {})[id] || {}); },
  setConf(id, patch) { S.moodConf = S.moodConf || {}; S.moodConf[id] = Object.assign(this.conf(id), patch); Store.save(); if (S.mood === id) this.apply(id, true); },
  hidden(appId) { return appId !== 'pets:rest' && this.conf(S.mood || 'everyday').hide.indexOf(appId) >= 0; },
  // quiet: from the mood, not the user's Focus switch (S.dnd), which stays theirs.
  quiet() { return !!this.conf(S.mood || 'everyday').quiet; },
  apply(id, silent) {
    const before = S.mood || 'everyday';
    S.mood = id; Store.save();
    const m = this.get(id), r = document.documentElement.style;
    r.setProperty('--accent', m.colour); r.setProperty('--accent2', m.colour2);
    document.documentElement.setAttribute('data-mood', id);
    Wallpapers.apply();
    Shell.buildHome();
    LockExtras.render();
    Pip.refresh();
    if (!silent && before !== id) {
      Phone.vibrate(30);
      Island.flash({ glyph: m.glyph, colour: m.colour, title: m.name + ' mood', sub: this.conf(id).quiet ? 'Alerts are quiet' : m.text, ms: 2600 });
    }
  },
  // Sleep comes on and goes off by itself if the owner turned that on (Settings > Moods).
  autoTick() {
    const a = S.sleepAuto;
    if (!a || !a.on) return;
    const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
    const toMin = s => { const [hh, mm] = s.split(':').map(Number); return hh * 60 + mm; };
    const from = toMin(a.from), to = toMin(a.to);
    const inside = from <= to ? (mins >= from && mins < to) : (mins >= from || mins < to);
    const day = Calendar.key(now);
    if (inside && S.mood !== 'sleep' && a.skipped !== day) { S.moodBeforeSleep = S.mood || 'everyday'; S.sleepByAuto = true; this.apply('sleep'); }
    else if (!inside && S.mood === 'sleep' && S.sleepByAuto) { S.sleepByAuto = false; this.apply(S.moodBeforeSleep || 'everyday'); }
  },
  // A tile for Control Centre: tap cycles, hold picks.
  picker() {
    Dialog.menu('Mood', 'Changes colours, wallpaper, alerts and which apps show', this.list.map(m => ({
      label: (m.id === (S.mood || 'everyday') ? '✓ ' : '') + m.name, fn: () => { if (m.id !== 'sleep' && S.sleepByAuto) { S.sleepByAuto = false; S.sleepAuto.skipped = Calendar.key(new Date()); } this.apply(m.id); }
    })));
  }
};
// The mood's wallpaper is shown over the owner's own choice, which stays saved.
(orig => { Wallpapers.apply = function () {
  orig.call(this);
  const wid = Moods.conf(S.mood || 'everyday').wall, w = wid && this.list.find(x => x.id === wid);
  if (w) $('#wall').style.background = w.css + ' center/cover no-repeat';
}; })(Wallpapers.apply);
// Hidden-by-mood apps leave the Home Screen and Dock while the mood is on (they stay in Rest).
(orig => { Shell.appIcon = function (id, where) { if (Moods.hidden(id) && !this.editing) return null; return orig.call(this, id, where); }; })(Shell.appIcon);
// Quiet moods silence banners and buzzes but keep the alerts, like Focus.
(orig => { Shell.notify = function (title, text, opts) {
  const was = S.dnd; if (Moods.quiet()) S.dnd = true;
  const n = orig.call(this, title, text, opts);
  S.dnd = was;
  if (n && this.notes[0] === n) Pip.react(n);
  return n;
}; })(Shell.notify);

// ================================================================ Pip, the Pets OS pet
const Pip = {
  kinds: [{ id: 'pup', name: 'Pup' }, { id: 'kitty', name: 'Kitty' }, { id: 'bunny', name: 'Bunny' }],
  colours: [['#ffb84d', 'Honey'], ['#8c7bff', 'Lilac'], ['#3dd6a0', 'Mint'], ['#ff8fa3', 'Rose'], ['#a8b0c2', 'Silver'], ['#a0693f', 'Cocoa']],
  excitedUntil: 0, line: null, lineUntil: 0,
  data() {
    const now = Date.now();
    return Object.assign({ name: 'Pip', kind: 'pup', colour: '#ffb84d', born: now, fed: now, petted: now, happy: 85, pets: 0, meals: 0, plays: 0 }, Store.app('pip', {}));
  },
  save(d) { Store.setApp('pip', d); },
  stats(d) {
    d = d || this.data();
    const b = json(Phone.battery(), {});
    const happy = clamp(Math.round(d.happy - 4 * hoursSince(d.petted)), 0, 100);
    const full = clamp(Math.round(100 - 7 * hoursSince(d.fed)), 0, 100);
    const h = new Date().getHours();
    const energy = b.level >= 0 ? b.level : (h >= 22 || h < 7 ? 30 : 85);
    return { happy, full, energy, charging: !!b.charging, battery: b.level };
  },
  sleeping() { const h = new Date().getHours(); return S.mood === 'sleep' || h >= 23 || h < 6; },
  mood() {
    const s = this.stats();
    if (Date.now() < this.excitedUntil) return 'excited';
    if (this.sleeping()) return 'sleep';
    if (s.battery >= 0 && s.battery <= 15 && !s.charging) return 'tired';
    if (s.full < 30) return 'hungry';
    if (s.happy < 35) return 'sad';
    return 'happy';
  },
  say() {
    if (this.line && Date.now() < this.lineUntil) return this.line;
    const d = this.data(), s = this.stats(), h = new Date().getHours(), who = S.name ? ', ' + S.name : '';
    switch (this.mood()) {
      case 'sleep': return 'Zzz…';
      case 'tired': return 'Battery is low. Plug me in?';
      case 'hungry': return 'I\'m hungry!';
      case 'sad': return 'Pet me?';
      case 'excited': return 'Something new!';
    }
    if (s.charging) return 'Yum, energy!';
    if (S.mood === 'work') return 'Working hard' + who + '?';
    if (S.mood === 'chill') return 'Chill time ♪';
    if (h < 12) return 'Morning' + who + '!';
    if (h < 18) return 'Hi' + who + '!';
    return 'Evening' + who + '.';
  },
  // The drawing. Every part is plain SVG so it scales from the lock screen to the Pip app.
  svg(mood, d) {
    d = d || this.data();
    const c = d.colour, dark = shade(c, .78), ink = '#2b2d42';
    const ears = {
      pup: `<ellipse cx="33" cy="40" rx="10" ry="19" fill="${dark}" transform="rotate(22 33 40)"/><ellipse cx="87" cy="40" rx="10" ry="19" fill="${dark}" transform="rotate(-22 87 40)"/>`,
      kitty: `<path d="M33 34 L38 9 L56 24 Z" fill="${c}"/><path d="M38 28 L40 16 L49 24 Z" fill="#ffc2cf"/><path d="M87 34 L82 9 L64 24 Z" fill="${c}"/><path d="M82 28 L80 16 L71 24 Z" fill="#ffc2cf"/>`,
      bunny: `<ellipse cx="47" cy="16" rx="8" ry="22" fill="${c}"/><ellipse cx="47" cy="17" rx="4" ry="16" fill="#ffc2cf"/><ellipse cx="73" cy="16" rx="8" ry="22" fill="${c}"/><ellipse cx="73" cy="17" rx="4" ry="16" fill="#ffc2cf"/>`
    }[d.kind] || '';
    const eyes = {
      sleep: `<path d="M42 48 q6 5 12 0 M66 48 q6 5 12 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      excited: `<path d="M42 50 q6 -8 12 0 M66 50 q6 -8 12 0" stroke="${ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
      happy: `<g class="eyes"><circle cx="48" cy="47" r="5" fill="${ink}"/><circle cx="72" cy="47" r="5" fill="${ink}"/><circle cx="49.6" cy="45.2" r="1.7" fill="#fff"/><circle cx="73.6" cy="45.2" r="1.7" fill="#fff"/></g>`,
      sad: `<g class="eyes"><circle cx="48" cy="49" r="4.4" fill="${ink}"/><circle cx="72" cy="49" r="4.4" fill="${ink}"/></g><path d="M41 40 l11 3 M79 40 l-11 3" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`,
      tired: `<g class="eyes"><path d="M42 48 h12 M66 48 h12" stroke="${ink}" stroke-width="3" stroke-linecap="round"/></g>`,
      hungry: `<g class="eyes"><circle cx="48" cy="47" r="5.4" fill="${ink}"/><circle cx="72" cy="47" r="5.4" fill="${ink}"/><circle cx="49.8" cy="45" r="2" fill="#fff"/><circle cx="73.8" cy="45" r="2" fill="#fff"/></g>`
    }[mood] || '';
    const mouth = {
      sleep: `<ellipse cx="60" cy="64" rx="2.6" ry="2" fill="${ink}"/>`,
      excited: `<path d="M53 61 q7 10 14 0 Z" fill="${ink}"/><path d="M56 64 q4 4 8 0" fill="#ff7a8a"/>`,
      happy: `<path d="M54 61 q6 6 12 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
      sad: `<path d="M54 65 q6 -5 12 0" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
      tired: `<path d="M55 63 h10" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`,
      hungry: `<ellipse cx="60" cy="64" rx="5" ry="6" fill="${ink}"/><ellipse cx="60" cy="67" rx="3" ry="2.4" fill="#ff7a8a"/>`
    }[mood] || '';
    const extra = mood === 'sleep' ? '<g class="zzz" fill="#fff" font-family="Inter" font-weight="600"><text x="92" y="22" font-size="13">z</text><text x="101" y="12" font-size="10">z</text></g>' : '';
    return `<svg class="pip-svg m-${mood}" viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="111" rx="30" ry="5" fill="rgba(0,0,0,.22)"/>
      <path class="tail" d="M88 84 q18 -6 16 -26" stroke="${dark}" stroke-width="9" fill="none" stroke-linecap="round"/>
      <g class="bob">
        <ellipse cx="60" cy="82" rx="33" ry="26" fill="${c}"/>
        <g opacity=".5" fill="#fff"><ellipse cx="60" cy="90" rx="7" ry="6"/><circle cx="51" cy="81" r="2.8"/><circle cx="60" cy="78" r="2.8"/><circle cx="69" cy="81" r="2.8"/></g>
        <ellipse cx="45" cy="105" rx="9" ry="5" fill="${dark}"/><ellipse cx="75" cy="105" rx="9" ry="5" fill="${dark}"/>
        ${d.kind === 'pup' ? '' : ears}
        <circle cx="60" cy="50" r="29" fill="${c}"/>
        ${d.kind === 'pup' ? ears : ''}
        <ellipse cx="60" cy="60" rx="14" ry="10" fill="#fff" opacity=".55"/>
        <ellipse cx="60" cy="55" rx="4.2" ry="3.2" fill="${ink}"/>
        <ellipse cx="40" cy="58" rx="5" ry="3" fill="#ff7a8a" opacity=".45"/><ellipse cx="80" cy="58" rx="5" ry="3" fill="#ff7a8a" opacity=".45"/>
        ${eyes}${mouth}
      </g>${extra}</svg>`;
  },
  // Draw into an element: .pip-box holds the drawing and the speech bubble.
  draw(box, opts) {
    const mood = this.mood();
    box.classList.add('pip-box');
    box.setAttribute('data-mood', mood);
    // Only the drawing and the bubble are replaced, so hearts and the ball keep flying.
    let art = $(':scope > .pip-art', box);
    if (!art) { art = h('div', { class: 'pip-art' }); box.prepend(art); }
    art.innerHTML = this.svg(mood);
    let say = $(':scope > .pip-say', box);
    if (opts && opts.bubble === false) { if (say) say.remove(); return; }
    const line = this.say();
    if (!say) { say = h('div', { class: 'pip-say' }); box.append(say); }
    if (say.textContent !== line) { say.textContent = line; say.style.animation = 'none'; void say.offsetWidth; say.style.animation = ''; }
  },
  refresh() { $$('.pip-box').forEach(b => this.draw(b, { bubble: !b.classList.contains('nobubble') ? undefined : false })); },
  speak(text, ms) { this.line = text; this.lineUntil = Date.now() + (ms || 3500); this.refresh(); setTimeout(() => this.refresh(), (ms || 3500) + 50); },
  hearts(box, n) {
    if (!box) return;
    for (let i = 0; i < (n || 3); i++) {
      const hEl = h('i', { class: 'pip-heart', html: icon('heart'), style: { left: (35 + Math.random() * 30) + '%', animationDelay: (i * 120) + 'ms' } });
      box.append(hEl); setTimeout(() => hEl.remove(), 1400 + i * 120);
    }
  },
  pet(box) {
    const d = this.data();
    d.happy = clamp(this.stats(d).happy + 12, 0, 100); d.petted = Date.now(); d.pets++;
    this.save(d);
    Phone.vibrate(15);
    if (this.sleeping()) { this.speak('Mm… five more minutes.', 2200); return; }
    this.excitedUntil = Date.now() + 1800;
    this.speak(['♥', 'Hehe!', 'Again!', 'I like that.', 'Best ' + (S.name || 'human') + '!'][d.pets % 5], 1800);
    this.hearts(box);
  },
  feed(box, treat) {
    const d = this.data();
    d.fed = Date.now(); d.meals++; d.happy = clamp(this.stats(d).happy + 5, 0, 100);
    this.save(d); Phone.vibrate(20);
    this.excitedUntil = Date.now() + 1500;
    this.speak('Yum! ' + (treat || 'Thank you') + '!', 2200);
    this.hearts(box, 2);
  },
  play(box) {
    const d = this.data();
    if (this.sleeping()) { this.speak('Too sleepy to play.', 2000); return; }
    d.happy = clamp(this.stats(d).happy + 20, 0, 100); d.petted = Date.now(); d.plays++;
    this.save(d); Phone.vibrate(25);
    this.excitedUntil = Date.now() + 2500;
    this.speak('Fetch! Again, again!', 2500);
    if (box) { const ball = h('i', { class: 'pip-ball', html: icon('ball') }); box.append(ball); setTimeout(() => ball.remove(), 1300); }
    this.hearts(box, 2);
  },
  // A notification arrived: Pip perks up and the island shows who it is from.
  react(n) {
    this.excitedUntil = Date.now() + 2500;
    this.refresh();
    setTimeout(() => this.refresh(), 2600);
    if (!S.dnd && !Moods.quiet() && S.pipAlerts !== false) Island.flash({ pip: true, title: n.title, sub: n.text || '', ms: 3200, onTap: () => { Shell.notes = Shell.notes.filter(x => x !== n); if (n.app) Shell.open(n.app); } });
  },
  age(d) { const days = Math.floor(hoursSince((d || this.data()).born) / 24); return days < 1 ? 'Born today' : days === 1 ? '1 day together' : days + ' days together'; }
};

// Home Screen widget: tap to pet, hold to open the Pip app.
(orig => { Widgets.make = function (id) {
  if (id !== 'widget:pip') return orig.call(this, id);
  const w = h('div', { class: 'widget widget-pip', 'data-id': 'widget:pip' });
  const box = h('div');
  const name = h('div', { class: 'pip-name' });
  w.append(box, name);
  const draw = () => { Pip.draw(box); const d = Pip.data(); name.innerHTML = '<b>' + esc(d.name) + '</b>' + statDots(Pip.stats(d)); };
  draw();
  w.pipDraw = draw;
  press(w, () => { Pip.pet(box); setTimeout(draw, 60); }, () => Dialog.menu(Pip.data().name, null, [
    { label: 'Open ' + Pip.data().name, fn: () => Shell.open('pets:pip') },
    { label: 'Edit Home Screen', fn: () => Shell.setEditing(true) },
    { label: 'Remove from Home Screen', danger: true, fn: () => { S.home = S.home.map(p => p.filter(x => x !== 'widget:pip')); Store.save(); Shell.buildHome(); Shell.toast(Pip.data().name + ' is still in Rest'); } }
  ]));
  return w;
}; })(Widgets.make);
function statDots(s) {
  const dot = (v, cls, label) => '<span class="sd ' + cls + '" title="' + label + '"><i style="width:' + v + '%"></i></span>';
  return '<span class="stat-dots">' + dot(s.happy, 'h', 'Happy') + dot(s.full, 'f', 'Full') + dot(s.energy, 'e', 'Energy') + '</span>';
}
Pip.refresh = (orig => function () { orig.call(this); $$('.widget-pip').forEach(w => w.pipDraw && w.pipDraw()); $$('.pip-app').forEach(b => b.pipDraw && b.pipDraw()); })(Pip.refresh);

Apps.register({
  id: 'pets:pip', name: 'Pip', cat: 'Pets OS', glyph: 'paw', bg: 'linear-gradient(145deg,#ffcf7a,#ff9a6b)', keywords: 'pet companion dog cat bunny tamagotchi',
  open(w) {
    w.root(body => {
      const d = Pip.data();
      w.setTitle(d.name);
      const stage = h('div', { class: 'pip-stage' });
      const box = h('div', { class: 'pip-big' });
      stage.append(box);
      const bars = h('div', { class: 'card pip-bars' });
      const buttons = h('div', { class: 'pip-buttons' });
      let draw = () => {
        Pip.draw(box);
        const s = Pip.stats();
        bars.innerHTML = '';
        [['Happy', s.happy, 'var(--danger)', 'heart'], ['Full', s.full, 'var(--warn)', 'bone'], ['Energy', s.energy, 'var(--success)', 'zap']].forEach(([label, v, col, g]) => {
          bars.append(h('div', { class: 'row' }, h('span', { class: 'sq', style: { background: col }, html: icon(g) }),
            h('div', { class: 'grow' }, h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('span', { text: label }), h('span', { class: 'val', text: v + '%' })),
              h('div', { class: 'bar' }, h('i', { style: { width: v + '%', background: col } })))));
        });
      };
      stage.pipDraw = draw;
      stage.classList.add('pip-app');
      press(box, () => { Pip.pet(box); setTimeout(draw, 60); });
      const btn = (g, label, fn) => { const b = h('button', { class: 'btn secondary', html: icon(g) + '<span>' + label + '</span>' }); b.onclick = () => { fn(); setTimeout(draw, 60); }; return b; };
      buttons.append(
        btn('heart', 'Pet', () => Pip.pet(box)),
        btn('bone', 'Feed', () => Dialog.menu('Feed ' + Pip.data().name, null, ['Biscuit', 'Fish', 'Carrot', 'Berries'].map(t => ({ label: t, fn: () => { Pip.feed(box, t); draw(); } })))),
        btn('ball', 'Play', () => Pip.play(box)));
      body.append(stage, buttons, bars);
      const counts = h('span', { class: 'val' });
      const facts = h('div', { class: 'card' },
        h('div', { class: 'row' }, h('span', { class: 'grow', text: 'Together' }), h('span', { class: 'val', text: Pip.age(d) })),
        h('div', { class: 'row' }, h('span', { class: 'grow', text: 'Pets · meals · games' }), counts));
      const drawBars = draw;
      draw = () => { drawBars(); const dd = Pip.data(); counts.textContent = dd.pets + ' · ' + dd.meals + ' · ' + dd.plays; };
      stage.pipDraw = draw;
      body.append(h('div', { class: 'label', text: 'About ' + d.name }), facts);
      const look = h('div', { class: 'card' });
      const rename = h('div', { class: 'row' }, h('span', { class: 'grow', text: 'Name' }), h('span', { class: 'val', text: d.name }), h('span', { class: 'chev', html: icon('chevron-right') }));
      press(rename, async () => { const n = await Dialog.prompt('Name your pet', null, Pip.data().name, { max: 16 }); if (n && n.trim()) { const dd = Pip.data(); dd.name = n.trim(); Pip.save(dd); w.refresh(); Shell.buildHome(); } });
      const kinds = h('div', { class: 'seg', style: { margin: '10px 14px' } });
      Pip.kinds.forEach(k => { const b = h('button', { class: d.kind === k.id ? 'on' : '', text: k.name }); b.onclick = () => { const dd = Pip.data(); dd.kind = k.id; Pip.save(dd); w.refresh(); Pip.refresh(); }; kinds.append(b); });
      const swatches = h('div', { class: 'pip-swatches' });
      Pip.colours.forEach(([c, n]) => { const b = h('button', { 'aria-label': n, class: d.colour === c ? 'on' : '', style: { background: c } }); b.onclick = () => { const dd = Pip.data(); dd.colour = c; Pip.save(dd); w.refresh(); Pip.refresh(); }; swatches.append(b); });
      look.append(rename, kinds, swatches);
      body.append(h('div', { class: 'label', text: 'Look' }), look,
        h('p', { class: 'pip-help', text: d.name + ' gets sleepy when the battery is low or in Sleep mood, hungry if you forget to feed it, and perks up when a notification arrives. Tap ' + d.name + ' on the Home Screen to say hello.' }));
      draw();
    });
    w.onShow = () => w.refresh();
  }
});

// ================================================================ Pets Island
const Island = {
  el: null, until: 0, onTap: null,
  init() {
    if (!hasIsland) return;
    this.el = h('div', { id: 'island' }, h('div', { class: 'l' }), h('div', { class: 'm' }), h('div', { class: 'r' }));
    // The touch area reaches a little below the island: the screen under a camera cut-out doesn't
    // always report touches, so the island must work from its lower edge too.
    const hit = h('div', { id: 'island-hit' });
    $('#phone').append(this.el, hit);
    [this.el, hit].forEach(el => press(el, () => this.tap(), () => { Phone.vibrate(20); ClaricePanel.open(); }, 450));
    setInterval(() => this.update(), 1000);
    this.update();
  },
  // A short message that grows out of the island, then shrinks back.
  flash(o) {
    if (!this.el) return;
    const l = $('.l', this.el), m = $('.m', this.el), r = $('.r', this.el);
    l.innerHTML = ''; r.innerHTML = '';
    if (o.pip) { const b = h('div', { class: 'nobubble' }); Pip.draw(b, { bubble: false }); l.append(b); }
    else l.append(h('div', { class: 'ico', style: { background: o.colour || 'var(--accent)' }, html: icon(o.glyph || 'bell') }));
    m.innerHTML = '';
    this.el.className = 'big';
    // Text goes in once the island has grown: measured while small, WebKit clipped the title.
    clearTimeout(this._fill);
    this._fill = setTimeout(() => { m.innerHTML = '<b>' + esc(o.title || '') + '</b>' + (o.sub ? '<span>' + esc(o.sub) + '</span>' : ''); }, 260);
    this.until = Date.now() + (o.ms || 3000);
    this.onTap = o.onTap || null;
    clearTimeout(this._t);
    this._t = setTimeout(() => this.update(), (o.ms || 3000) + 20);
  },
  live() {
    const c = window.Clock && Clock.data(), t = c && c.timer;
    if (t) {
      const left = t.paused != null ? t.paused : t.end - Date.now();
      return { glyph: t.paused != null ? 'pause' : t.reminder ? 'bell' : 'timer', colour: '#ffb84d', text: Fmt.dur(Math.max(0, left)), open: () => { Shell.open('pets:clock'); Clock.show('timer'); } };
    }
    const a = window.Activities && Activities.current();
    if (a) return { glyph: 'heart', colour: '#ff5c63', text: Fmt.dur(Date.now() - a.start), open: () => Shell.open('pets:activities') };
    return null;
  },
  update() {
    if (!this.el || Date.now() < this.until) return;
    const live = this.live();
    const l = $('.l', this.el), m = $('.m', this.el), r = $('.r', this.el);
    m.innerHTML = '';
    if (live) {
      this.el.className = 'live';
      l.innerHTML = '<span style="color:' + live.colour + '">' + icon(live.glyph) + '</span>';
      r.textContent = live.text; r.style.color = live.colour;
      this.onTap = live.open;
    } else {
      this.el.className = 'idle';
      l.innerHTML = ''; r.textContent = '';
      this.onTap = null;
    }
  },
  tap() {
    if (Shell.locked) { Shell.unlock(); return; }
    const fn = this.onTap;
    if (Date.now() < this.until) { this.until = 0; this.update(); }
    if (fn) fn(); else ClaricePanel.open();
  }
};

// ================================================================ Clarice, everywhere
// Usage by hour so Clarice can suggest the app you usually open now.
const Usage = {
  data() { return Store.app('usage', {}); },
  note(id) {
    if (!id || id === 'pets:rest') return;
    const d = this.data(), hr = new Date().getHours();
    d[id] = d[id] || new Array(24).fill(0);
    d[id][hr]++;
    Store.setApp('usage', d);
  },
  suggest(n) {
    const d = this.data(), hr = new Date().getHours(), score = {};
    Object.keys(d).forEach(id => { const a = d[id]; score[id] = a[hr] * 3 + a[(hr + 23) % 24] + a[(hr + 1) % 24]; });
    S.recentApps.forEach((id, i) => { score[id] = (score[id] || 0) + Math.max(0, 2 - i * 0.3); });
    return Object.keys(score).filter(id => score[id] > 0 && Apps.get(id) && !Moods.hidden(id)).sort((a, b) => score[b] - score[a]).slice(0, n || 4);
  }
};
(orig => { Shell.open = function (id, fromEl) { Usage.note(id); return orig.call(this, id, fromEl); }; })(Shell.open);

// Things Clarice thinks you might want right now. Each has a button that does it.
Clarice.tips = function () {
  const out = [], hr = new Date().getHours(), s = Pip.stats(), d = Pip.data(), mood = S.mood || 'everyday';
  const live = Island.live();
  if (live) out.push({ text: (live.glyph === 'heart' ? 'Activity running: ' : 'Timer: ') + live.text + (live.glyph === 'heart' ? '' : ' left'), label: 'Open', fn: live.open });
  if (s.battery >= 0 && s.battery <= 20 && !s.charging && mood !== 'sleep') out.push({ text: 'Battery is at ' + s.battery + '%. Sleep mood keeps things quiet.', label: 'Sleep mood', fn: () => Moods.apply('sleep') });
  if ((hr >= 22 || hr < 5) && mood !== 'sleep') out.push({ text: 'It\'s getting late.', label: 'Start Sleep mood', fn: () => Moods.apply('sleep') });
  if (hr >= 7 && hr < 10 && mood === 'sleep') out.push({ text: 'Good morning' + (S.name ? ', ' + S.name : '') + '!', label: 'Everyday mood', fn: () => Moods.apply('everyday') });
  const day = new Date().getDay();
  if (day > 0 && day < 6 && hr >= 9 && hr < 17 && mood === 'everyday') out.push({ text: 'Working? Work mood hides the distractions.', label: 'Work mood', fn: () => Moods.apply('work') });
  const next = Calendar.next();
  if (next && /^Today/.test(next.when)) out.push({ text: next.title + ' · ' + next.when, label: 'Calendar', fn: () => Shell.open('pets:calendar') });
  if (s.full < 30 && !Pip.sleeping()) out.push({ text: d.name + ' is hungry.', label: 'Feed ' + d.name, fn: () => { Pip.feed(null, 'Biscuit'); } });
  const sug = Usage.suggest(1)[0];
  if (sug && out.length < 3) { const a = Apps.get(sug); out.push({ text: 'You often open ' + a.name + ' around now.', label: 'Open ' + a.name, fn: () => Shell.open(sug) }); }
  return out.slice(0, 3);
};

// New things Clarice understands. Anything else goes to the original Clarice.
(orig => { Clarice.answer = async function (raw) {
  const t = String(raw || '').trim(), q = t.toLowerCase().replace(/[?!.]+$/, '');
  const d = Pip.data(), pn = d.name.toLowerCase();
  let m;
  const moodWord = { everyday: 'everyday', normal: 'everyday', work: 'work', working: 'work', focus: 'work', chill: 'chill', relax: 'chill', relaxing: 'chill', sleep: 'sleep', bed: 'sleep', night: 'sleep' };
  if (/^(good ?night|night night|i'?m going to (sleep|bed)|bedtime)$/.test(q)) { Moods.apply('sleep'); return 'Good night' + (S.name ? ', ' + S.name : '') + '. Sleep mood is on and alerts are quiet. ' + d.name + ' is curling up too.'; }
  if (/^good morning$/.test(q)) { if (S.mood === 'sleep') Moods.apply('everyday'); const n = Calendar.next(); return 'Good morning' + (S.name ? ', ' + S.name : '') + '! ' + (n ? 'Next up: ' + n.title + ', ' + n.when + '.' : 'Nothing in your calendar yet.'); }
  if ((m = /^(?:(?:switch|change|go|set) (?:to |into )?|start |turn on )?(everyday|normal|work|working|focus|chill|relax|relaxing|sleep|bed|night) mood$/.exec(q)) || (m = /^mood (everyday|normal|work|chill|sleep)$/.exec(q)) || (m = /^(?:i'?m |time to )(work|chill|relax)(?:ing)?$/.exec(q))) {
    const id = moodWord[m[1]] || 'everyday'; Moods.apply(id); const mm = Moods.get(id);
    return mm.name + ' mood is on. ' + (Moods.conf(id).quiet ? 'Alerts are quiet.' : mm.text + '.');
  }
  if (/^(what|which) mood|^what'?s my mood/.test(q)) return 'You\'re in ' + Moods.current().name + ' mood. Say "chill mood", "work mood", "sleep mood" or "everyday mood" to change it.';
  if (new RegExp('^(feed|give .* to) (' + pn + '|pip|my pet|the pet)').test(q) || /^feed (him|her|it)$/.test(q)) { Pip.feed(null, 'Biscuit'); return d.name + ' had a biscuit and looks very pleased.'; }
  if (new RegExp('^(pet|stroke|cuddle|pat) (' + pn + '|pip|my pet|the pet)').test(q)) { Pip.pet(null); return d.name + ' wiggles happily. ♥'; }
  if (new RegExp('^play with (' + pn + '|pip|my pet|the pet)').test(q)) { Pip.play(null); return 'You throw the ball. ' + d.name + ' brings it straight back!'; }
  if (new RegExp('^(how is|how\'?s|check on) (' + pn + '|pip|my pet|the pet)').test(q)) {
    const s = Pip.stats(d);
    const feel = { sleep: 'asleep', tired: 'tired because the battery is low', hungry: 'hungry', sad: 'a bit lonely', excited: 'excited', happy: 'happy' }[Pip.mood()];
    return d.name + ' is ' + feel + '. Happy ' + s.happy + '%, full ' + s.full + '%, energy ' + s.energy + '%.';
  }
  if ((m = /^(?:rename|call) (?:pip|my pet|the pet|\S+) (?:to )?(.{1,16})$/.exec(t)) && new RegExp('^(rename|call) (' + pn + '|pip|my pet|the pet)', 'i').test(t)) { d.name = m[1].trim(); Pip.save(d); Shell.buildHome(); Pip.refresh(); return 'Done. Your pet is now called ' + d.name + '.'; }
  if (/^(what'?s|what is) (on )?(today|next|my day)|^(my day|next event|what'?s next|what do i have( today)?)$/.test(q)) { const n = Calendar.next(); return n ? 'Next: ' + n.title + ', ' + n.when + '.' : 'Nothing coming up in your calendar.'; }
  if ((m = /^remind me in (\d+)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hours?) (?:to )?(.+)$/.exec(q))) {
    const n = +m[1], u = m[2][0], sec = u === 's' ? n : u === 'h' ? n * 3600 : n * 60;
    const what = t.slice(t.toLowerCase().indexOf(m[3])).trim();
    Clock.startTimer(sec, what.charAt(0).toUpperCase() + what.slice(1), true);
    return 'OK, I\'ll remind you in ' + Fmt.dur(sec * 1000) + ' to ' + what + '.';
  }
  if ((m = /^(?:set |change )?(?:the )?wallpaper (?:to )?(.+)$/.exec(q))) {
    const wp = Wallpapers.list.find(x => x.name.toLowerCase() === m[1] || x.id === m[1].replace(/ /g, '-'));
    if (!wp) return 'Wallpapers: ' + Wallpapers.list.map(x => x.name).join(', ') + '.';
    S.wallpaper = wp.id; Store.save(); Wallpapers.apply(); return 'Wallpaper set to ' + wp.name + (Moods.conf(S.mood || 'everyday').wall ? '. Your mood shows its own wallpaper until you switch to Everyday.' : '.');
  }
  if (/^(suggest|what should i do|any ideas|ideas|tips)/.test(q)) { const tips = Clarice.tips(); return tips.length ? tips.map(x => '• ' + x.text).join('\n') : 'All quiet. Enjoy it!'; }
  if (/(what can you do|^help$|^commands$)/.test(q)) {
    const base = await orig.call(this, 'help');
    return base + '\n• chill mood / work mood / good night\n• how is ' + d.name + '? / feed ' + d.name + '\n• remind me in 10 minutes to stretch\n• what\'s next?\n• wallpaper aurora';
  }
  return orig.call(this, raw);
}; })(Clarice.answer);

// The Clarice panel drops out of the Pets Island (or the top of the screen) over whatever is open.
const ClaricePanel = {
  el: null,
  build() {
    this.el = h('div', { id: 'clarice-panel', class: 'hidden' });
    this.el.addEventListener('click', e => { if (e.target === this.el && Date.now() - this.at > 450) this.close(); });
    $('#phone').append(this.el);
  },
  open(text) {
    if (Shell.locked) { Shell.unlock(); return; }
    if (!this.el) this.build();
    Shell.closeSheets();
    this.at = Date.now();
    const card = h('div', { class: 'cp-card' });
    const head = h('div', { class: 'cp-head' }, h('img', { src: 'img/clarice-avatar.jpg', alt: '' }),
      h('div', { class: 'grow' }, h('b', { text: 'Clarice' }), h('span', { text: 'Ask, or tap a suggestion' })));
    const more = h('button', { class: 'cp-more', text: 'Chat' });
    more.onclick = () => { this.close(); Shell.open('pets:clarice'); };
    head.append(more);
    const answer = h('div', { class: 'cp-answer hidden' });
    const tips = h('div', { class: 'cp-tips' });
    Clarice.tips().forEach(tp => {
      const b = h('button', { class: 'cp-tip' }, h('span', { text: tp.text }), h('b', { text: tp.label }));
      b.onclick = () => { this.close(); tp.fn(); };
      tips.append(b);
    });
    const apps = h('div', { class: 'cp-apps' });
    Usage.suggest(4).forEach(id => {
      const a = Apps.get(id);
      const el = h('div', { class: 'app' }, Apps.tile(a), h('div', { class: 'name', text: a.short || a.name }));
      press(el, () => { this.close(); Shell.open(id); });
      apps.append(el);
    });
    const f = h('input', { class: 'field', placeholder: 'Ask Clarice', enterkeyhint: 'send', autocomplete: 'off' });
    const go = h('button', { class: 'btn', html: icon('send'), 'aria-label': 'Send' });
    const send = async () => {
      const v = f.value.trim(); if (!v) return;
      f.value = '';
      answer.classList.remove('hidden');
      answer.innerHTML = '<div class="me"></div><div class="her">…</div>';
      $('.me', answer).textContent = v;
      const reply = await Clarice.answer(v);
      const l = Clarice.log(); l.push({ who: 'me', text: v }, { who: 'clarice', text: reply }); Clarice.save(l);
      $('.her', answer).textContent = reply;
      tips.classList.add('hidden');
    };
    go.onclick = send;
    f.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    card.append(head, answer, tips, apps.children.length ? h('div', { class: 'cp-label', text: 'Suggested apps' }) : null, apps.children.length ? apps : null, h('div', { class: 'cp-ask' }, f, go));
    this.el.innerHTML = '';
    this.el.append(card);
    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el.classList.add('open'));
    if (text) { f.value = text; send(); }
    else setTimeout(() => f.focus(), 250);
  },
  close() {
    if (!this.el || this.el.classList.contains('hidden')) return false;
    this.el.classList.remove('open');
    const f = $('input', this.el); if (f) f.blur();
    setTimeout(() => this.el.classList.add('hidden'), 220);
    return true;
  },
  isOpen() { return !!this.el && !this.el.classList.contains('hidden'); }
};
// Back and Home close the panel first.
(orig => { Shell.back = function () { if (ClaricePanel.isOpen()) { ClaricePanel.close(); return true; } return orig.call(this); }; })(Shell.back);
(orig => { Shell.goHome = function (instant) { ClaricePanel.close(); return orig.call(this, instant); }; })(Shell.goHome);
(orig => { Shell.lock = function () { ClaricePanel.close(); const r = orig.call(this); LockExtras.render(); return r; }; })(Shell.lock);

// Rest: Clarice's suggestions on top, and Enter on a search with no app asks Clarice.
(orig => { Rest.render = function () {
  orig.call(this);
  const ids = Usage.suggest(4);
  if (!ids.length) return;
  const row = h('div', { class: 'rest-suggest' }, h('div', { class: 'cp-label', html: icon('sparkles') + ' Clarice suggests' }));
  const grid = h('div', { class: 'grid4' });
  ids.forEach(id => { const a = Apps.get(id); const el = h('div', { class: 'app' }, Apps.tile(a), h('div', { class: 'name', text: a.short || a.name })); press(el, () => Shell.open(id, el)); grid.append(el); });
  row.append(grid);
  const cats = $('#rest .cats');
  if (cats) cats.after(row);
  const field = $('#rest .search input');
  if (field) field.addEventListener('input', () => row.classList.toggle('hidden', !!field.value.trim()));
}; })(Rest.render);
Rest.noMatch = q => { Shell.closeSheets(); ClaricePanel.open(q); };

// Control Centre: a Mood tile and a Clarice tile.
(orig => { CC.render = function () {
  orig.call(this);
  const g = $('#cc .grid'); if (!g) return;
  const m = Moods.current();
  const mood = h('button', { class: 'cc-tile wide mood on', style: { background: 'linear-gradient(135deg,' + m.colour + ',' + m.colour2 + ')', color: '#fff' }, html: icon(m.glyph) + '<div><b>' + esc(m.name) + '</b>Mood · tap to change</div>' });
  press(mood, () => { const i = Moods.list.indexOf(m); Moods.apply(Moods.list[(i + 1) % Moods.list.length].id); CC.render(); }, () => { Shell.closeSheets(); Moods.picker(); });
  g.prepend(mood);
  if (!Shell.locked) {
    const c = h('button', { class: 'cc-tile wide', html: '<img src="img/clarice-avatar.jpg" alt="" style="width:30px;height:30px;border-radius:50%">' + '<div><b>Clarice</b>Ask anything</div>' });
    press(c, () => ClaricePanel.open());
    mood.after(c);
  }
}; })(CC.render);

// ================================================================ Lock screen: mood, small widgets, Pip
const LockExtras = {
  render() {
    const lock = $('#lock'); if (!lock) return;
    let info = $('#lock .lock-info');
    if (!info) { info = h('div', { class: 'lock-info' }); $('#lock .clock').after(info); }
    let pip = $('#lock .lock-pip');
    if (!pip) {
      pip = h('div', { class: 'lock-pip' });
      lock.append(pip);
      press(pip, () => { Pip.pet(pip); });
    }
    const m = Moods.current(), s = Pip.stats(), wx = Store.app('weather.last', null), next = Calendar.next();
    info.innerHTML = '';
    const chip = h('div', { class: 'lock-mood', html: icon(m.glyph) + '<span>' + esc(m.name) + '</span>' });
    info.append(chip);
    const ws = h('div', { class: 'lock-widgets' });
    if (s.battery >= 0) ws.append(h('div', { class: 'lw', html: '<div class="ring" style="--v:' + s.battery + '">' + icon(s.charging ? 'zap' : 'battery-full') + '</div><span>' + s.battery + '%</span>' }));
    if (wx) ws.append(h('div', { class: 'lw', html: '<div class="ring" style="--v:100">' + icon('cloud-sun') + '</div><span>' + Math.round(wx.temp) + '°</span>' }));
    if (next) ws.append(h('div', { class: 'lw wide', html: icon('calendar') + '<div><b>' + esc(next.title) + '</b><span>' + esc(next.when) + '</span></div>' }));
    if (ws.children.length) info.append(ws);
    Pip.draw(pip);
  }
};

// ================================================================ Home: search pill, Pip widget
const HomeExtras = {
  init() {
    const pill = h('div', { id: 'homepill' }, h('span', { class: 'q', html: icon('search') + '<span>Search</span>' }), h('span', { class: 'pd' }));
    $('#home').append(pill);
    press(pill, () => { Shell.openSheet('rest'); setTimeout(() => { const f = $('#rest .search input'); if (f) f.focus(); }, 80); }, () => { Phone.vibrate(20); ClaricePanel.open(); }, 450);
    const pages = $('#pages');
    let t = null;
    pages.addEventListener('scroll', () => {
      const n = $$('#pages .page').length;
      if (n < 2) return;
      pill.classList.add('dots');
      const pd = $('.pd', pill), i = Math.round(pages.scrollLeft / Math.max(1, pages.clientWidth));
      pd.innerHTML = ''; for (let k = 0; k < n; k++) pd.append(h('i', { class: k === i ? 'on' : '' }));
      clearTimeout(t); t = setTimeout(() => pill.classList.remove('dots'), 900);
    }, { passive: true });
  }
};
// Put Pip on page 1 (new and existing Home Screens), right after the Today widget.
(orig => { Shell.ensureHome = function () {
  const fresh = !S.home;
  orig.call(this);
  if (fresh || !S.addedPip) {
    S.addedPip = true;
    if (!S.home.some(p => p.indexOf('widget:pip') >= 0)) {
      const p = S.home[0], i = p.indexOf('widget:today');
      p.splice(i >= 0 ? i + 1 : 0, 0, 'widget:pip');
    }
    Store.save();
  }
}; })(Shell.ensureHome);

// ================================================================ start-up
(orig => { Shell.start = function () {
  // Apply the mood's colours before anything draws.
  const m = Moods.current();
  document.documentElement.style.setProperty('--accent', m.colour);
  document.documentElement.style.setProperty('--accent2', m.colour2);
  document.documentElement.setAttribute('data-mood', m.id);
  orig.call(this);
  HomeExtras.init();
  Island.init();
  LockExtras.render();
  setInterval(() => { Moods.autoTick(); }, 30000);
  setInterval(() => { Pip.refresh(); if (!$('#lock').classList.contains('gone')) LockExtras.render(); }, 60000);
  setTimeout(() => Moods.autoTick(), 1500);
  // First time with Pip: say hello once setup is done.
  const hello = () => {
    if (!S.setupDone) { setTimeout(hello, 2000); return; }
    if (S.pipHello) return;
    S.pipHello = true; Store.save();
    setTimeout(() => { Island.flash({ pip: true, title: 'Hi' + (S.name ? ' ' + S.name : '') + '! I\'m ' + Pip.data().name + '.', sub: 'Tap me on the Home Screen', ms: 4000 }); Pip.speak('Hello!', 4000); }, 900);
  };
  setTimeout(hello, 2500);
}; })(Shell.start);


// ================================================================ Setup on the Stephone
// Step 0 talks about the Stephone, and the last step (on iPhone: "Add to Home Screen") meets the pet.
(orig => { Setup.render = function () {
  if (!isStephone) return orig.call(this);
  if (this.step !== 3) {
    orig.call(this);
    const p = $('#setup p');
    if (this.step === 0 && p) p.textContent = 'This is your Stephone. Rest holds every app, Clarice helps you out, Pip keeps you company, and your notes, photos and plans stay on the phone.';
    return;
  }
  const box = $('#setup');
  box.innerHTML = '';
  const d = Pip.data();
  const dots = h('div', { class: 'step-dots' }, [0, 1, 2, 3].map(() => h('i', { class: 'on' })));
  const stage = h('div', { class: 'setup-pip' });
  const draw = () => Pip.draw(stage);
  const f = h('input', { class: 'field', placeholder: 'Pet name', value: d.name, maxlength: 16, autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', autocapitalize: 'words' });
  const kinds = h('div', { class: 'seg', style: { background: 'rgba(255,255,255,.1)' } });
  Pip.kinds.forEach(k => { const b = h('button', { class: d.kind === k.id ? 'on' : '', text: k.name }); b.onclick = () => { const dd = Pip.data(); dd.kind = k.id; Pip.save(dd); $$('button', kinds).forEach(x => x.classList.toggle('on', x === b)); draw(); }; kinds.append(b); });
  const sw = h('div', { class: 'pip-swatches', style: { padding: '0 0 12px', justifyContent: 'center' } });
  Pip.colours.forEach(([c, n]) => { const b = h('button', { 'aria-label': n, class: d.colour === c ? 'on' : '', style: { background: c } }); b.onclick = () => { const dd = Pip.data(); dd.colour = c; Pip.save(dd); $$('button', sw).forEach(x => x.classList.toggle('on', x === b)); draw(); }; sw.append(b); });
  const next = h('button', { class: 'btn block', text: 'Start using Pets OS' });
  box.append(dots, h('h1', { text: 'Meet your pet' }), h('p', { text: 'Your pet lives on the Home Screen. It sleeps when you do, gets hungry, and perks up when something arrives.' }), stage, kinds, sw, f, h('div', { class: 'grow' }), next);
  draw();
  next.onclick = () => {
    const dd = Pip.data(); dd.name = f.value.trim() || 'Pip'; dd.born = Date.now(); dd.fed = Date.now(); dd.petted = Date.now(); Pip.save(dd);
    S.setupDone = true; S.pipHello = false; Store.save();
    $('#setup').classList.add('hidden');
    Shell.buildHome(); LockExtras.render();
    Shell.toast('Welcome' + (S.name ? ', ' + S.name : '') + '!');
  };
}; })(Setup.render);

window.Moods = Moods; window.Pip = Pip; window.Island = Island; window.ClaricePanel = ClaricePanel; window.Usage = Usage;
