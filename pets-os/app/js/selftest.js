// Self-test: index.html?selftest=1 (or the "selftest" intent extra on the phone).
// Uses a scratch copy of the settings so the owner's data is put back afterwards.
'use strict';
const SelfTest = {
  async run() {
    const results = [];
    const ok = (name, cond, extra) => { results.push({ name, pass: !!cond, extra }); };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const saved = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); saved[k] = localStorage.getItem(k); }
    // Apps ask Android for permissions when they open; during the test nothing is asked or changed.
    if (onPhone) Phone.askPermission = () => setTimeout(() => PetsOS.native('permission'), 0);
    // Milo's Android browser would cover Pets OS and pause the test.
    if (onPhone) Phone.openUrl = () => {};
    try {
      // Calculator engine
      ok('calc precedence', Calc.evaluate('2+3×4') === 14);
      ok('calc brackets', Calc.evaluate('(2+3)×4') === 20);
      ok('calc percent', Calc.evaluate('50%') === 0.5);
      ok('calc power', Calc.evaluate('2^10') === 1024);
      ok('calc divide', Calc.evaluate('7÷2') === 3.5);
      let threw = false; try { Calc.evaluate('2+'); } catch (e) { threw = true; } ok('calc rejects bad input', threw);
      ok('calc no eval', (() => { try { Calc.evaluate('alert(1)'); return false; } catch (e) { return true; } })());

      // Start from an unlocked home screen whatever state the phone was in.
      Shell.finishUnlock(); Shell.goHome(true); $$('.dialog-bg').forEach(d => d.remove());

      // Setup flow
      ok('boot splash hidden', $('#boot').classList.contains('gone'));
      if (!S.setupDone) { Setup.step = 3; S.setupDone = true; Store.save(); $('#setup').classList.add('hidden'); }
      ok('setup can finish', S.setupDone);

      // Home screen
      Shell.buildHome();
      ok('home has pages', $$('#pages .page').length >= 1);
      ok('dock has Rest first', $('#dock .app') && $('#dock .app').getAttribute('data-id') === 'pets:rest');
      ok('today widget', !!$('.widget-today'));
      const builtins = Object.keys(Apps.builtin).filter(k => k.startsWith('pets:') && Apps.builtin[k].open);
      ok('pets apps registered', builtins.length >= 10, builtins.length);

      // Every Pets OS app opens and closes without errors
      const errors = [];
      const onErr = e => errors.push(String(e.message || e));
      window.addEventListener('error', onErr);
      for (const id of builtins) {
        try { Shell.open(id); await wait(60); ok('open ' + id, (onPhone && id === 'pets:milo' && !Apps.builtin['store:milo']) || (Shell.front() && Shell.front().id === id && Shell.front().body.children.length > 0)); Shell.goHome(true); await wait(30); }
        catch (e) { ok('open ' + id, false, e.message); }
      }
      ok('no window errors', !errors.length, errors.join('; '));

      // Back button closes a sub-screen, then the app
      Shell.open('pets:settings'); await wait(40);
      const sw = Shell.front();
      sw.push('About', b => b.append('x'));
      Shell.back(); ok('back pops sub-screen', !sw.stack.length && Shell.front() === sw);
      Shell.back(); await wait(260); ok('back closes app', !Shell.front());
      $('#pages').scrollLeft = 0; await wait(30);
      ok('back at home reports nothing to close', Shell.back() === false);
      // Back button on screen: a real click on it steps back
      Shell.open('pets:settings'); await wait(40);
      Shell.front().push('About', b => b.append('x'));
      Shell.front().backEl.click(); ok('on-screen back button works', !Shell.front().stack.length && Shell.front().titleEl.textContent === 'Settings');
      ok('back button hidden on first screen', Shell.front().backEl.classList.contains('hidden'));
      Shell.goHome(true); await wait(30);

      // The click that follows a tap which opened a new screen must not hit that screen
      {
        const host = h('div', { style: { position: 'fixed', left: 0, top: 0, width: '200px', height: '200px', zIndex: 999 } });
        document.body.append(host);
        let opened = 0, ghostHit = 0;
        press(host, () => { opened++; });
        host.addEventListener('click', () => { ghostHit++; });
        host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50 }));
        host.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 50, clientY: 50 }));
        // a synthetic click is not trusted, so check the guard directly: it was armed at this spot
        ok('tap arms the ghost-click guard', opened === 1 && ghost && Math.abs(ghost.x - 50) < 1);
        ghost = null;
        // a button inside a pressable row handles its own tap; the row does not act
        const btn = h('button', { text: 'Get' }); host.append(btn);
        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 60, clientY: 60 }));
        btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 60, clientY: 60 }));
        ok('button inside a row does not trigger the row', opened === 1);
        host.remove();
      }

      // Start-up & updates in Settings
      Settings.go('general'); await wait(60);
      const sb = Shell.front().body.textContent;
      ok('settings start-up row', isWeb || (sb.includes('Start with the phone') && sb.includes('Software Update')));
      const u = await Promise.race([Updates.check(), wait(15000).then(() => null)]);
      ok('update check answers', u && (u.error || u.versionCode > 0 || (u.signed && u.version) || (PLAY && u.state === 'store')), u && JSON.stringify(u).slice(0, 300));
      Settings.go(null); Shell.goHome(true); await wait(30);

      // Huawei apps are hidden, Camera and Gallery stay
      const keepAndroid = Apps.android;
      Apps.android = keepAndroid.concat([{ pkg: 'com.huawei.appmarket', label: 'AppGallery' }, { pkg: 'com.huawei.camera', label: 'Camera' }, { pkg: 'com.huawei.photos', label: 'Gallery' }]);
      Shell.setHideHuawei(true);
      const ids = Apps.all().map(a => a.id);
      ok('huawei apps hidden', ids.indexOf('android:com.huawei.appmarket') < 0);
      ok('huawei camera/gallery kept', ids.indexOf('android:com.huawei.camera') >= 0 && ids.indexOf('android:com.huawei.photos') >= 0);
      Shell.setHideHuawei(false);
      ok('huawei apps shown again', Apps.all().some(a => a.id === 'android:com.huawei.appmarket'));
      Apps.android = keepAndroid;
      ok('Burrow (files) on home', S.home.some(p => p.indexOf('pets:files') >= 0) && Apps.builtin['pets:files'].name === 'Burrow');
      ok('files sizes', Files.size(1536) === '1.5 KB' && Files.size(5 * 1024 * 1024) === '5.0 MB');
      Shell.open('pets:settings'); await wait(60);
      const st = Shell.front().body.textContent;
      ok('settings main groups', st.includes('Sounds & Haptics') && st.includes('Storage') && st.includes('General') && st.includes('Display & Text Size') && (isWeb ? !st.includes('Android') : st.includes('Wi-Fi')));
      Shell.goHome(true); await wait(30);

      // Sheets
      Shell.openSheet('rest'); ok('rest opens', $('#rest').classList.contains('open') && $$('#rest .all .app').length >= builtins.length);
      const f = $('#rest input'); f.value = 'pen'; f.dispatchEvent(new Event('input'));
      ok('rest search', $$('#rest .all .app').some(a => a.getAttribute('data-id') === 'pets:pen'));
      Shell.back(); ok('back closes rest', !$('#rest').classList.contains('open'));
      Shell.openSheet('cc'); ok('control centre', $$('#cc .cc-tile').length >= (isWeb ? 6 : 8)); Shell.closeSheets();
      Shell.openSheet('nc'); ok('notifications', !!$('#nc h2')); Shell.closeSheets();

      // Notifications
      const n = Shell.notify('Test', 'Hello', { app: 'pets:pen' });
      ok('notify adds', Shell.notes[0] === n);
      Shell.notes = [];

      // Passcode
      Shell.setPin('2468');
      ok('pin stored hashed', S.pin && S.pin !== '2468' && S.salt);
      Shell.lock(); ok('lock shows', Shell.locked && !$('#lock').classList.contains('gone'));
      Shell.unlock(); ok('pin pad shows', !$('#pin').classList.contains('hidden'));
      Shell.pinEntry = '1111'; Shell.checkPin(); ok('wrong pin refused', Shell.locked);
      Shell.pinEntry = '2468'; Shell.checkPin(); ok('right pin unlocks', !Shell.locked && $('#lock').classList.contains('gone'));
      // Locked: Control Centre has nothing that opens apps; dialogs are cancelled
      Shell.setPin('2468');
      let answered = 'pending';
      Dialog.confirm('Test?', null, 'OK').then(v => { answered = v; });
      Shell.lock(); await wait(20);
      ok('lock cancels dialogs', !$('.dialog-bg') && answered === false);
      Shell.openSheet('cc');
      const tiles = $$('#cc .cc-tile').map(t => t.textContent);
      ok('locked control centre is limited', !tiles.some(t => /Android|Settings|Timer|Calculator|Camera|Music|Airplane/.test(t)), tiles.join(','));
      Shell.closeSheets();
      Shell.openSheet('nc'); ok('no notifications sheet while locked', !$('#nc').classList.contains('open'));
      Shell.finishUnlock();
      Shell.openSheet('cc'); ok('unlocked control centre is full', $$('#cc .cc-tile').some(t => /Settings/.test(t.textContent))); Shell.closeSheets();
      // Reopening an app straight after going home keeps it visible
      Shell.open('pets:pen'); await wait(30); Shell.goHome(); await wait(50); Shell.open('pets:pen'); await wait(300);
      ok('quick reopen stays visible', Shell.front() && Shell.front().id === 'pets:pen' && !Shell.front().el.classList.contains('hidden'));
      Shell.goHome(true); await wait(30);
      Shell.setPin(null); ok('pin off', !S.pin);

      // Home Screen is horizontal only
      ok('home pages never scroll vertically', getComputedStyle($('#pages')).overflowY === 'hidden');
      $('#pages').scrollLeft = 0;
      $('#home').dispatchEvent(new MouseEvent('mousedown', { clientX: 200, clientY: 600, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: 200, clientY: 250 }));
      ok('swipe up on home opens nothing', !Shell.sheetOpen());
      Shell.home(); ok('home button on page 1 opens nothing', !Shell.sheetOpen());
      const keepHome = JSON.parse(JSON.stringify(S.home));
      S.home = [Array(80).fill('pets:pen')]; Shell.buildHome();
      const pagesBox = $('#pages').getBoundingClientRect();
      ok('full pages spill onto new pages', $$('#pages .page').length >= 2, $$('#pages .page').length);
      ok('every icon fits its page', $$('#pages .page .app').every(a => a.getBoundingClientRect().bottom <= pagesBox.bottom + 1));
      ok('no icon lost when spilling', S.home.reduce((n, p) => n + p.length, 0) === 80);
      S.home = keepHome; Store.save(); Shell.buildHome();

      // Settings that change real behaviour
      S.notifOff = ['pets:pen']; Shell.notes = [];
      Shell.notify('Muted', 'x', { app: 'pets:pen' });
      ok('per-app notifications off', !Shell.notes.length);
      S.notifOff = []; Shell.notify('Allowed', 'x', { app: 'pets:pen' });
      ok('per-app notifications on', Shell.notes.length === 1); Shell.notes = [];
      S.reduceMotion = true; Settings.applyMotion();
      ok('reduce motion applies', document.documentElement.classList.contains('reduce-motion'));
      S.reduceMotion = false; Settings.applyMotion();
      Shell.open('pets:settings'); await wait(60);
      const s2 = Shell.front().body.textContent;
      ok('settings has notifications + accessibility', s2.includes('Notifications') && s2.includes('Accessibility'));
      ok('settings wifi is honest', isWeb || /Wi-Fi(Opens|.*)(Connected|Not connected)/.test(s2));
      Shell.goHome(true); await wait(30);

      // O Store: signed catalogue, fingerprints, compatibility, install/update/uninstall
      ok('store version compare', PetStore.cmp('1.0.10', '1.0.9') === 1 && PetStore.cmp('1.0', '1.0.0') === 0);
      ok('store refuses newer Pets OS', /Needs Pets OS/.test(PetStore.incompatible({ minPets: '99.0' }) || ''));
      ok('store refuses other platforms', !!PetStore.incompatible({ platforms: [isWeb ? 'android' : 'web'] }));
      ok('store apps only from O Store', (() => { try { Apps.register({ id: 'store:sneaky', name: 'x', open() {} }); return false; } catch (e) { return !Apps.builtin['store:sneaky']; } })());
      const realFetch = window.fetch, realKey = PetStore.KEY;
      const enc = s => new TextEncoder().encode(s);
      const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      PetStore.KEY = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey))));
      const der = raw => { // r||s -> DER, as openssl writes it
        const int = b => { let i = 0; while (i < 31 && b[i] === 0) i++; b = b.slice(i); return b[0] & 0x80 ? [0x02, b.length + 1, 0, ...b] : [0x02, b.length, ...b]; };
        const r = int(raw.slice(0, 32)), s = int(raw.slice(32)); return new Uint8Array([0x30, r.length + s.length, ...r, ...s]);
      };
      const sign = async bytes => der(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, bytes)));
      const files = {};
      const pkg = v => `Apps.register({ id: 'store:hello', name: 'Hello', open(w) { w.root(b => b.append('Hello ${v}')); } });`;
      const publish = async (serial, apps, opts) => {
        const body = enc(JSON.stringify(Object.assign({ serial, expires: new Date(Date.now() + 864e5).toISOString(), apps }, opts || {})));
        files['catalog.json'] = body; files['catalog.sig'] = await sign(body);
      };
      const entry = async (v, build, code, extra) => { const b = enc(code); files['pkg/hello-' + v + '.js'] = b; return Object.assign({ id: 'hello', name: 'Hello', version: v, build, size: b.length, sha256: await PetStore.sha256(b), file: 'pkg/hello-' + v + '.js', summary: 'Test app' }, extra || {}); };
      window.fetch = async u => { const k = String(u).replace('https://store.test/', ''); return files[k] ? new Response(files[k]) : new Response('no', { status: 404 }); };
      Store.setApp('store.url', 'https://store.test/'); Store.setApp('store.serial', 0);
      try {
        await publish(5, [await entry('1.0', 1, pkg('one'))]);
        ok('store accepts signed list', !!(await PetStore.refresh()) && PetStore.catalog.apps.length === 1, PetStore.problem);
        let pct = 0; ok('store installs', await PetStore.install('hello', p => { pct = p; }) === 'installed' && pct === 1 && !!Apps.builtin['store:hello']);
        ok('installed app on Home Screen', S.home.some(p => p.indexOf('store:hello') >= 0));
        { // a second Get while the first download runs must fail loudly, not report success
          PetStore.busy.hello = 0.5; let m = '';
          try { await PetStore.install('hello'); } catch (e) { m = e.message; }
          delete PetStore.busy.hello;
          ok('store refuses a second download of the same app', /already downloading/.test(m), m);
        }
        Shell.open('store:hello'); await wait(40);
        ok('installed app opens', Shell.front() && Shell.front().body.textContent === 'Hello one'); Shell.goHome(true); await wait(30);
        Store.setApp('store:hello', { kept: 1 });
        const bad = await entry('2.0', 2, pkg('two')); bad.sha256 = '0'.repeat(64);
        await publish(6, [bad]); await PetStore.refresh();
        let msg = ''; try { await PetStore.install('hello'); } catch (e) { msg = e.message; }
        ok('store refuses tampered package', /fingerprint/.test(msg) && PetStore.installed.hello.version === '1.0', msg);
        await publish(7, [await entry('2.0', 2, 'Apps.register({ id: "pets:settings", name: "Fake", open() {} });')]); await PetStore.refresh();
        msg = ''; try { await PetStore.install('hello'); } catch (e) { msg = e.message; }
        ok('store refuses package that takes over another app', !!msg && Apps.builtin['pets:settings'].name !== 'Fake' && Apps.builtin['store:hello'], msg);
        await publish(8, [await entry('2.0', 2, pkg('two'))]); await PetStore.refresh();
        ok('store sees update', PetStore.state(PetStore.entry('hello')) === 'update');
        ok('store updates', await PetStore.install('hello') === 'updated' && PetStore.installed.hello.version === '2.0');
        files['catalog.sig'] = await sign(enc('something else'));
        ok('store refuses bad signature', !(await PetStore.refresh()) && /security check/.test(PetStore.problem));
        await publish(3, [await entry('2.0', 2, pkg('two'))]);
        ok('store refuses older list', !(await PetStore.refresh()) && /older/.test(PetStore.problem));
        await publish(9, [await entry('3.0', 3, pkg('three'), { minPets: '99.0' })], { expires: new Date(Date.now() - 1000).toISOString() });
        ok('store refuses expired list', !(await PetStore.refresh()) && /expired/.test(PetStore.problem));
        await publish(10, [await entry('3.0', 3, pkg('three'), { minPets: '99.0' })]); await PetStore.refresh();
        msg = ''; try { await PetStore.install('hello'); } catch (e) { msg = e.message; }
        ok('store refuses incompatible app', /Needs Pets OS/.test(msg) && PetStore.installed.hello.version === '2.0', msg);
        await PetStore.uninstall('hello', false);
        ok('uninstall keeps data when asked', !Apps.builtin['store:hello'] && !S.home.some(p => p.indexOf('store:hello') >= 0) && Store.app('store:hello', null));
        await publish(11, [await entry('2.0', 2, pkg('two'))]); await PetStore.refresh(); await PetStore.install('hello');
        await PetStore.uninstall('hello', true);
        ok('uninstall removes data when asked', Store.app('store:hello', null) == null && !PetStore.installed.hello);
        files['catalog.json'] = null;
        ok('store explains a missing app list', !(await PetStore.refresh()) && /wasn't found/.test(PetStore.problem), PetStore.problem);
        window.fetch = async () => { throw new TypeError('Failed to fetch'); };
        ok('store explains an unreachable server', !(await PetStore.refresh()) && /can't be reached|offline/.test(PetStore.problem), PetStore.problem);
      } finally {
        window.fetch = realFetch; PetStore.KEY = realKey; PetStore.catalog = null; PetStore.problem = null;
        if (PetStore.installed.hello) await PetStore.uninstall('hello', true);
      }

      // Milo: downloaded from O Store; its download takes the place of an old built-in Milo icon
      ok('Milo is listed once in Rest', Apps.all().filter(a => a.id === 'pets:milo' || a.id === 'store:milo').length === 1);
      {
        const keepHome = JSON.parse(JSON.stringify(S.home)), keepDock = S.dock.slice();
        S.home = S.home.map(p => p.filter(x => x !== 'store:milo' && x !== 'pets:milo')); S.dock = S.dock.filter(x => x !== 'store:milo' && x !== 'pets:milo');
        S.home[0].push('pets:milo'); PetStore.addToHome('store:milo');
        ok('Milo download replaces the old Milo icon', S.home.some(p => p.indexOf('store:milo') >= 0) && !S.home.some(p => p.indexOf('pets:milo') >= 0));
        S.home = keepHome; S.dock = keepDock; Store.save(); Shell.buildHome();
      }

      // Pen
      const note = Pen.add('Shopping\nmilk'); ok('pen add', Pen.load().notes.some(x => x.id === note.id));
      ok('pen title', Pen.title(note) === 'Shopping');

      // Clarice
      ok('clarice time', /^It's/.test(await Clarice.answer('what time is it')));
      ok('clarice sum', /= 14/.test(await Clarice.answer('what is 2 + 3 * 4')));
      ok('clarice percent', (await Clarice.answer("what's 18% of 240")).startsWith('43.2'));
      ok('clarice note', /Saved to Pocket Notes/.test(await Clarice.answer('note call mum')) && Pen.load().notes.some(x => x.text === 'call mum'));
      ok('passcode hash is SHA-256', Phone.sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      ok('clarice timer', /Timer set/.test(await Clarice.answer('set a timer for 2 minutes')) && Clock.data().timer && Clock.data().timer.total === 120000);
      ok('clarice activity', /Run started/.test(await Clarice.answer('start a run')) && Activities.current().name === 'Run');
      ok('clarice stop', /Run finished/.test(await Clarice.answer('stop the activity')) && !Activities.current());
      ok('clarice unknown', /didn't catch/.test(await Clarice.answer('blorp the wibble')));

      // Stephone: Moods
      const moodBefore = S.mood || 'everyday';
      Moods.apply('work', true);
      ok('mood work applied', S.mood === 'work' && document.documentElement.getAttribute('data-mood') === 'work');
      ok('mood hides apps', Moods.hidden('pets:moments') && !$('#home .app[data-id="pets:moments"]'));
      ok('mood keeps hidden apps in Rest', Apps.all().some(a => a.id === 'pets:moments'));
      ok('mood accent colour', getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() === Moods.get('work').colour);
      Moods.apply('sleep', true);
      const nBefore = Shell.notes.length, dndBefore = S.dnd;
      Shell.notify('Quiet test', 'x');
      ok('sleep mood keeps alerts quietly', Shell.notes.length === nBefore + 1 && S.dnd === dndBefore);
      ok('clarice sets mood', /Chill mood is on/.test(await Clarice.answer('chill mood')) && S.mood === 'chill');
      ok('clarice good night', /Sleep mood is on/.test(await Clarice.answer('good night')) && S.mood === 'sleep');
      ok('clarice which mood', /Sleep mood/.test(await Clarice.answer('what mood am i in')));
      Moods.apply('everyday', true);
      ok('everyday shows apps again', !Moods.hidden('pets:moments'));

      // Stephone: Pip
      const pipSaved = Store.app('pip', null);
      Store.setApp('pip', { name: 'Testy', kind: 'kitty', colour: '#3dd6a0', born: Date.now(), fed: Date.now() - 20 * 36e5, petted: Date.now(), happy: 80, pets: 0, meals: 0, plays: 0 });
      ok('pip gets hungry', Pip.stats().full < 30);
      const h0 = new Date().getHours();
      Pip.excitedUntil = 0;
      if (!(h0 >= 23 || h0 < 6) && !(S.mood === 'sleep')) ok('pip hungry mood', Pip.mood() === 'hungry' || (json(Phone.battery(), {}).level <= 15));
      ok('clarice feeds pip', /Testy had a biscuit/.test(await Clarice.answer('feed testy')) && Pip.stats().full > 95);
      ok('clarice checks pip', /^Testy is /.test(await Clarice.answer('how is testy')));
      Pip.pet(null); ok('pip counts pets', Pip.data().pets === 1);
      ok('pip svg draws', /<svg class="pip-svg/.test(Pip.svg('happy')) && /<svg/.test(Pip.svg('sleep')));
      ok('clarice renames pip', /now called Bean/.test(await Clarice.answer('rename testy to Bean')) && Pip.data().name === 'Bean');
      Shell.buildHome();
      ok('pip widget on home', !!$('#home .widget-pip'));
      if (pipSaved) Store.setApp('pip', pipSaved); else localStorage.removeItem('petsos.app.pip');

      // Stephone: Clarice everywhere
      ClaricePanel.open();
      ok('clarice panel opens', ClaricePanel.isOpen() && !!$('#clarice-panel .cp-ask input'));
      ok('back closes clarice panel', Shell.back() === true);
      await wait(260);
      ok('clarice panel closed', !ClaricePanel.isOpen());
      Shell.open('pets:calculator'); Shell.goHome(true); Shell.open('pets:calculator'); Shell.goHome(true);
      ok('usage suggests apps', Usage.suggest(4).indexOf('pets:calculator') >= 0);
      ok('clarice tips list', Array.isArray(Clarice.tips()));
      ok('clarice reminder', /remind you in 5:00 to stretch/.test(await Clarice.answer('remind me in 5 minutes to stretch')) && Clock.data().timer.reminder === true && Clock.data().timer.label === 'Stretch');
      ok('island live timer', !Island.el || (Island.until = 0, Island.update(), Island.el.className === 'live'));
      { const dd = Clock.data(); dd.timer = null; Clock.save(dd); }
      ok('clarice help lists moods', /chill mood/.test(await Clarice.answer('help')));
      Moods.apply(moodBefore, true);

      // Settings pages, search and preferences
      const prefsBefore = { textScale: S.textScale, boldText: S.boldText, easyRead: S.easyRead, theme: S.theme, themeAuto: S.themeAuto, hideLabels: S.hideLabels, previews: S.previews, haptics: S.haptics, claSpeak: S.claSpeak };
      { const errs = []; const onE = e => errs.push(String(e.message || e)); window.addEventListener('error', onE);
        for (const p of Object.keys(Settings.pages)) { try { Settings.go(p); await wait(20); ok('settings page ' + p, Shell.front().id === 'pets:settings' && Shell.front().titleEl.textContent === Settings.titles[p] && Shell.front().body.children.length > 0); } catch (e) { ok('settings page ' + p, false, e.message); } }
        window.removeEventListener('error', onE); ok('settings pages without errors', !errs.length, errs.join('; ')); }
      Settings.go(null); await wait(20);
      { const f = $('.set-search input', Shell.front().body); f.value = 'text size'; f.dispatchEvent(new Event('input'));
        ok('settings search finds text size', /Text Size/.test($('.set-results', Shell.front().body).textContent)); }
      Prefs.set('textScale', 1.35); ok('text size applies', getComputedStyle(document.documentElement).getPropertyValue('--ts').trim() === '1.35');
      Prefs.set('easyRead', true); ok('easier reading class', document.documentElement.classList.contains('easy-read'));
      Prefs.set('hideLabels', true); ok('hide app names class', document.documentElement.classList.contains('hide-labels'));
      ok('clarice bigger text', /Text is now 150%/.test(await Clarice.answer('bigger text')) && S.textScale === 1.5);
      ok('clarice smaller text', /Text is now 135%/.test(await Clarice.answer('smaller text')));
      ok('clarice opens settings page', /Opening Lock Screen/.test(await Clarice.answer('lock screen settings')));
      await wait(500); ok('clarice settings page shown', Shell.front() && Shell.front().titleEl.textContent === 'Lock Screen');
      S.previews = 'never'; ok('previews hidden', $('.x', Shell.noteCard({ id: 'p', title: 'Hi', text: 'secret', time: Date.now() }, false)).textContent === 'Notification');
      Object.assign(S, prefsBefore); Store.save(); Prefs.apply(); Shell.goHome(true); await wait(30);

      // Navigation: search finds settings and notes, edge swipe back, switcher previews
      Pen.add('Buy dog food for Pip');
      Shell.openSheet('rest'); { const f2 = $('#rest input'); f2.value = 'dog food'; f2.dispatchEvent(new Event('input')); }
      ok('search finds notes', /Buy dog food/.test($('#rest .all').textContent) && /Ask Clarice/.test($('#rest .all').textContent));
      { const f2 = $('#rest input'); f2.value = 'wallpaper'; f2.dispatchEvent(new Event('input')); }
      ok('search finds settings', $$('#rest .srow').some(r => /Wallpaper/.test(r.textContent)));
      Shell.closeSheets();
      Settings.go(null); await wait(40); Shell.front().push('About', b => b.append('x'));
      { const w = Shell.front(); EdgeBack.s = { x: 4, y: 300, w, id: 9, dx: 0 }; EdgeBack.s.dx = 40; const r1 = EdgeBack.end({ pointerId: 9, clientX: 44, clientY: 300 }); ok('short edge swipe stays', r1 === false && w.stack.length === 1, 'r=' + r1 + ' id=' + w.id + ' stack=' + w.stack.length);
        EdgeBack.s = { x: 4, y: 300, w, id: 9, dx: 150 }; const r2 = EdgeBack.end({ pointerId: 9, clientX: 154, clientY: 300 }); ok('edge swipe goes back', r2 === true && !w.stack.length && w.titleEl.textContent === 'Settings', 'r=' + r2 + ' stack=' + w.stack.length + ' t=' + w.titleEl.textContent); }
      Shell.recents(); ok('switcher shows previews', $$('#recents .rc-snap .win').length >= 1); Shell.goHome(true); await wait(30);

      // New features: Pip Walk, Time Capsule, Day Story
      PipWalk.start(25); ok('pip walk starts', !!PipWalk.current() && /walk/.test(Pip.say()));
      ok('island shows the walk', !Island.el || (Island.until = 0, Island.update(), Island.el.className === 'live' || !!Island.live()));
      { const d = PipWalk.data(); d.walk.end = Date.now() - 1; PipWalk.save(d); PipWalk.tick(); }
      ok('pip walk finishes', !PipWalk.current() && Shell.notes.some(n => /is home!/.test(n.title)));
      ok('clarice pip walk', /off on a 10-minute walk/.test(await Clarice.answer('pip walk 10')) && PipWalk.current().min === 10);
      ok('clarice stops walk', /is home after/.test(await Clarice.answer('stop the walk')) && !PipWalk.current());
      { const c = Capsule.add('Hello future me', Calendar.key(new Date(Date.now() + 2 * 864e5))); ok('capsule sealed', !Capsule.ready(c));
        const l = Capsule.list(); l[l.length - 1].openOn = Calendar.key(new Date(Date.now() - 864e5)); Capsule.save(l); Capsule.deliver();
        ok('capsule delivered', Shell.notes.some(n => /Time Capsule has arrived/.test(n.title)) && Capsule.list().some(x => x.delivered)); }
      Shell.open('pets:capsule'); await wait(60); ok('capsule app lists it', /Ready to open/.test(Shell.front().body.textContent)); Shell.goHome(true); await wait(30);
      ok('day story', /mood\./.test(await Clarice.answer('tell me about my day')));
      ok('capsule icon is HD', !!HD.has('pets:capsule'));

      // Round 2: Pip Guard, Wardrobe, Wind Down
      { const before = Shell.notes.length; PipGuard.tries = []; PipGuard.wrong(); PipGuard.wrong(); PipGuard.wrong();
        ok('pip guard barks', /WOOF/.test(Pip.say()));
        PipGuard.unlocked(); await wait(700);
        ok('pip guard reports tries', Shell.notes.some(n => n.title === 'Pip Guard' && /3 wrong passcode tries/.test(n.text)) && PipGuard.log()[0].tries === 3); }
      ok('clarice pip guard', /3 wrong tries/.test(await Clarice.answer('did anyone try to unlock my phone')));
      ok('wardrobe bow is free', Wardrobe.unlocked().some(i => i.id === 'bow'));
      Wardrobe.wear('bow'); ok('pip wears the bow', /ff5c7a/.test(Pip.svg('happy')));
      ok('clarice locked item', /still locked/.test(await Clarice.answer('put pip in the crown')));
      ok('clarice takes it off', /back to just being/.test(await Clarice.answer('take off hat')) && !Wardrobe.data().wearing);
      Wardrobe.visit(); ok('wardrobe streak counts today', Wardrobe.streak() >= 1);
      { const sv = [S.windDown, S.windGrey, S.mood]; Moods.apply('sleep', true); S.windGrey = true; WindDown.apply();
        ok('wind down in sleep mood', document.documentElement.classList.contains('wind-down') && document.documentElement.classList.contains('wind-grey'));
        S.windDown = false; WindDown.apply(); ok('wind down can be turned off', !document.documentElement.classList.contains('wind-down'));
        S.windDown = sv[0]; S.windGrey = sv[1]; Moods.apply(sv[2] || 'everyday', true); WindDown.apply(); }
      Settings.go('display'); await wait(40); ok('wind down settings', /Wind Down/.test(Shell.front().body.textContent)); Settings.go(null); Shell.goHome(true); await wait(30);

      // 1.2: default apps, the owner's apps, Phone, Contacts, Messages, Camera, Software Update
      ok('default calendar is Lenda', Defaults.get('calendar') === 'pets:lenda' && !!Apps.get('pets:lenda'));
            ok('About credits the creator', (() => { Shell.open('pets:settings'); Settings.go('about'); const ok_ = /Created by Fionn Mpho Mwaba/.test(Shell.front().body.textContent); Settings.go(null); Shell.goHome(true); return ok_; })());
      ok('Clarice knows who made Pets OS', /Fionn Mpho Mwaba/.test(await Clarice.answer('who made pets os')));
ok('default apps for photos, browser, mail, music, launcher, store', Defaults.get('photos') === 'pets:moments' && /milo/.test(Defaults.get('browser')) && Defaults.get('mail') === 'pets:stepmail' && Defaults.get('music') === 'pets:sonix' && Defaults.get('launcher') === 'pets:rest' && Defaults.get('store') === 'pets:ostore');
      { const sv = S.defaults; Defaults.set('calendar', 'pets:calendar'); ok('default can be changed', Defaults.get('calendar') === 'pets:calendar'); S.defaults = sv; Store.save(); }
      Shell.goHome(true); Defaults.open('music'); await wait(80); ok('Music opens Sonix', Shell.front() && Shell.front().id === 'pets:sonix' && !!Shell.front().frame); Shell.goHome(true); await wait(30);
      Defaults.open('mail'); await wait(80); ok('Mail opens StepMail', Shell.front() && Shell.front().id === 'pets:stepmail'); Shell.goHome(true); await wait(30);
      Defaults.open('calendar'); await wait(80); ok('Calendar opens Lenda', Shell.front() && Shell.front().id === 'pets:lenda'); Shell.goHome(true); await wait(30);
      Defaults.open('photos'); await wait(80); ok('Photos opens Moments', Shell.front() && Shell.front().id === 'pets:moments'); Shell.goHome(true); await wait(30);
      Defaults.open('launcher'); await wait(80); ok('Launcher opens Rest', $('#rest').classList.contains('open')); Shell.closeSheets();
      ok('dock has Phone, Messages, Camera', ['pets:phone', 'pets:messages', 'pets:camera'].every(id => S.dock.indexOf(id) >= 0));
      ok('clarice opens the default browser', /Opening Milo/.test(await Clarice.answer('open browser'))); await wait(500); Shell.goHome(true); await wait(30);
      { const c = Contacts.upsert({ id: 'st-c', name: 'Selftest Person', numbers: ['07700 900999'], email: '', fav: true });
        ok('contacts create', Contacts.own().some(x => x.id === 'st-c'));
        ok('contacts search', Contacts.find('selftest').id === 'st-c' && Contacts.byNumber('+44 7700 900999').id === 'st-c');
        c.name = 'Selftest Renamed'; Contacts.upsert(c); ok('contacts edit', Contacts.get('st-c').name === 'Selftest Renamed');
        Contacts.remove('st-c'); ok('contacts delete', !Contacts.get('st-c')); }
      Shell.open('pets:phone'); await wait(80); ok('phone keypad', $$('.kp button', Shell.front().el).length === 12 && !!$('.kp-call', Shell.front().el)); Shell.goHome(true); await wait(30);
      { const m = await MessagesApp.send('07700900111', 'selftest text'); ok('messages keeps the conversation', (MessagesApp.data()['07700900111'] || []).some(x => x.text === 'selftest text') && !!m.status); }
      Shell.open('pets:camera'); await wait(150); ok('camera opens with a shutter', !!$('.cam-shutter', Shell.front().el)); Shell.goHome(true); await wait(60);
      { const before = (await Moments.all()).length; const c = document.createElement('canvas'); c.width = 8; c.height = 8;
        const fakeVideo = { videoWidth: 8, videoHeight: 8 }; const orig = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function () {};
        const rec = await CameraApp.capture(fakeVideo); CanvasRenderingContext2D.prototype.drawImage = orig;
        ok('camera saves the photo to Moments', rec && (await Moments.all()).length === before + 1); if (rec) await Moments.del(rec.id); }
      ok('update screen states', (() => { SU.set({ state: 'downloading', done: 5, total: 10 }); return SU.st.state === 'downloading'; })()); SU.set({ state: 'idle', done: 0, total: 0, error: null });
      ok('signed manifest check exists', typeof PetStore.verify === 'function' && (!onPhone || typeof Phone.updateCheck === 'function'));

      // Calendar
      const today = Calendar.key(new Date());
      Calendar.save([{ id: 'x', title: 'Dentist', date: today, time: '23:59' }]);
      ok('calendar next', Calendar.next() && Calendar.next().title === 'Dentist');

      // Timer fires
      const d = Clock.data(); d.timer = { end: Date.now() - 1, total: 1000, label: 'Tea', paused: null }; Clock.save(d);
      Clock.tick(); ok('timer notifies', Shell.notes.some(x => /Tea finished/.test(x.title)) && !Clock.data().timer);
      window.removeEventListener('error', onErr);
      if (window.SuiteTest) await SuiteTest.run(ok, wait);
    } catch (e) {
      ok('selftest crashed', false, e.stack || e.message);
    } finally {
      if (onPhone) { Phone.askPermission = undefined; Phone.openUrl = undefined; }
      localStorage.clear();
      for (const k in saved) localStorage.setItem(k, saved[k]);
    }
    const pass = results.filter(r => r.pass).length;
    const lines = results.map(r => (r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.extra != null && !r.pass ? ' (' + r.extra + ')' : ''));
    lines.forEach(l => Phone.log('SELFTEST ' + l));
    Phone.log('SELFTEST RESULT ' + pass + '/' + results.length);
    window.SELFTEST = { pass, total: results.length, lines };
    document.title = 'SELFTEST ' + pass + '/' + results.length;
    if (isWeb && location.hostname === 'localhost') fetch('/__selftest', { method: 'POST', body: lines.join('\n') + '\nRESULT ' + pass + '/' + results.length }).catch(() => {});
    return window.SELFTEST;
  }
};
if (new URLSearchParams(location.search).has('selftest')) {
  const go = () => { if ($('#boot').classList.contains('gone')) SelfTest.run(); else setTimeout(go, 100); };
  setTimeout(go, 300);
}

// Screenshots on the iPhone simulator (no way to tap there): index.html?show=home|rest|cc|<app id>, localhost only.
(() => {
  const show = new URLSearchParams(location.search).get('show');
  if (!show || !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  const go = () => {
    if (!$('#boot').classList.contains('gone')) { setTimeout(go, 100); return; }
    if (!S.setupDone) { S.name = 'Fionn'; S.setupDone = true; Store.save(); $('#setup').classList.add('hidden'); }
    Shell.finishUnlock();
    if (show === 'rest' || show === 'cc' || show === 'nc') Shell.openSheet(show);
    else if (show !== 'home') Shell.open('pets:' + show);
  };
  go();
})();
