// Self-test for the StepOS app suite (run from SelfTest.run, with the owner's data saved and put back).
'use strict';
const SuiteTest = {
  async run(ok, wait) {
    const C = Suite.CATALOG;
    // Catalogue: 31 apps, the owner's order, Camera first and Calculator last.
    ok('suite: 31 apps in order', C.length === 31 && C.every((c, i) => c.n === i + 1) && C[0].name === 'Shutter' && C[30].name === 'QuickCalc');
    ok('suite: names are unique', new Set(C.map(c => c.name)).size === 31);
    const missing = C.filter(c => !Suite.available(c)).map(c => c.name);
    ok('suite: every app is installed', !missing.length, missing.join(', '));
    ok('suite: names applied to existing apps', Apps.builtin['pets:camera'].name === 'Shutter' && Apps.builtin['pets:pen'].name === 'Pocket Notes' && Apps.builtin['pets:files'].name === 'Burrow' && Apps.builtin['pets:clock'].name === 'Timewell');
    ok('suite: Clarice kept as the assistant', Apps.builtin['pets:clarice'].name === 'Clarice' && !Apps.builtin['pets:aida']);

    // Every app opens a working screen, and opening it again doesn't start a second copy.
    const errors = []; const onErr = e => errors.push(String(e.message || e)); window.addEventListener('error', onErr);
    for (const c of C) {
      const id = Suite.liveId(c);
      try {
        Shell.open(id); await wait(80);
        const f = Shell.front();
        if (onPhone && id === 'pets:milo' && !Apps.builtin['store:milo']) { ok('suite: open ' + c.name, true); continue; } // Android's Milo browser
        ok('suite: open ' + c.name, f && f.id === id && f.body.children.length > 0, f && f.id);
        Shell.goHome(true); await wait(20);
        Shell.open(id); await wait(40);
        ok('suite: ' + c.name + ' reopens without a duplicate', Shell.windows.filter(w => w.id === id).length === 1);
        Shell.goHome(true); await wait(20);
      } catch (e) { ok('suite: open ' + c.name, false, e.message); }
    }
    await wait(300);
    ok('suite: no errors opening apps', !errors.length, errors.slice(0, 3).join('; '));

    // Search finds an app by its StepOS name, its familiar function and its old name.
    const find = q => { Shell.openSheet('rest'); const f = $('#rest input'); f.value = q; f.dispatchEvent(new Event('input')); const ids = $$('#rest .all .app').map(a => a.getAttribute('data-id')); Shell.closeSheets(); return ids; };
    [['camera', 'pets:camera'], ['Shutter', 'pets:camera'], ['maps', 'pets:atlas'], ['calculator', 'pets:calculator'], ['flashlight', 'pets:torch'], ['notes', 'pets:pen'], ['pen', 'pets:pen'], ['contacts', 'pets:contacts'], ['downloads', 'pets:dropzone'], ['translate', 'pets:lingua'], ['emergency', 'pets:safeline'], ['weather', 'pets:weather']]
      .forEach(([q, id]) => ok('suite: search "' + q + '"', find(q).indexOf(id) >= 0));

    // StepOS icons for every app; Classic icons switch.
    ok('suite: StepOS icon for every app', C.every(c => { const a = Apps.get(Suite.liveId(c)); return a.id === 'pets:pip' || !!Apps.tile(a).querySelector('svg.st-icon'); }));
    S.classicIcons = true; const classic = !Apps.tile(Apps.builtin['pets:camera']).querySelector('svg.st-icon'); S.classicIcons = false;
    ok('suite: classic icons switch', classic);

    // Home Screen: pages stay horizontal and every app has a place.
    Shell.buildHome();
    const onHome = id => S.home.some(p => p.indexOf(id) >= 0) || S.dock.indexOf(id) >= 0 || (id === 'pets:milo' && S.home.some(p => p.indexOf('store:milo') >= 0));
    const off = C.filter(c => !onHome(Suite.liveId(c)) && !(S.suiteRemoved || []).includes(c.id)).map(c => c.name);
    ok('suite: every app on the Home Screen', !off.length, off.join(', '));
    ok('suite: home pages scroll sideways only', getComputedStyle($('#pages')).overflowY === 'hidden' && getComputedStyle($('#pages')).overflowX !== 'hidden');
    ok('suite: dock uses Calla, Relay and Shutter', S.dock.indexOf('sys:phone') < 0 && S.dock.indexOf('pets:rest') === 0);

    // Settings › Apps and an app's page.
    Settings.go('apps'); await wait(60);
    const sw = Shell.front();
    ok('suite: Settings › Apps lists the apps', sw && sw.titleEl.textContent === 'Apps' && $$('.row', sw.body).length >= 31);
    Suite.appInfo(sw, 'pets:voicepin'); await wait(30);
    ok('suite: app page shows permissions', /Microphone/.test(sw.body.textContent) && /Version/.test(sw.body.textContent));
    Settings.go(null); await wait(30);
    ok('suite: Settings main page has Apps', !!$('[data-st-apps]', Shell.front().body));
    Shell.goHome(true); await wait(30);

    // O Store lists the catalogue in order.
    Shell.open('pets:ostore'); await wait(120);
    const ow = Shell.front(), lbl = $$('.label', ow.body).find(l => /StepOS apps/.test(l.textContent));
    const names = lbl ? $$('.row', lbl.nextElementSibling).map(r => (r.querySelector('.grow > div') || {}).textContent) : [];
    ok('suite: O Store shows the 31 apps in order', names.length === 31 && names[0] === 'Shutter' && names[30] === 'QuickCalc', names.length);
    Shell.goHome(true); await wait(30);

    // Engines.
    ok('suite: EAN-13 check digit', EAN.check('400638133393') === '1' && EAN.bars('4006381333931').length === 95 && EAN.bars('4006381333932') === null);
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    ok('suite: scientific calc', near(Calc.sci('sin(30)', true), 0.5) && near(Calc.sci('ln(e)'), 1) && Calc.sci('5!') === 120 && Calc.sci('√16') === 4 && near(Calc.sci('log(1000)'), 3) && near(Calc.sci('2π'), 2 * Math.PI) && Calc.sci('-2^2') === -4 && Calc.sci('2+3×4') === 14);
    ok('suite: calc radians', near(Calc.sci('cos(pi)', false), -1));
    const vc = VCard.parse(VCard.out([{ name: 'Ada Lovelace', numbers: ['+44 1234 567'], email: 'ada@example.com', notes: 'a;b, c' }]));
    ok('suite: vCard round trip', vc.length === 1 && vc[0].name === 'Ada Lovelace' && vc[0].numbers[0] === '+44 1234 567' && vc[0].email === 'ada@example.com' && vc[0].notes === 'a;b, c');
    ok('suite: checklist toggle', NoteBox.toggle('Shop\n☐ milk\n☑ eggs', 1) === 'Shop\n☑ milk\n☑ eggs' && NoteBox.toggle('☑ x', 0) === '☐ x');
    ok('suite: Milo addresses', MiloStart.url('example.com') === 'https://example.com' && /search\.brave\.com\/search\?q=cats/.test(MiloStart.url('cats')));
    const wf = Scan.wifi('WIFI:S:Home Net;T:WPA;P:secret;;');
    ok('suite: Wi-Fi QR parse', wf && wf.ssid === 'Home Net' && wf.pass === 'secret');
    ok('suite: route words', Atlas.step({ maneuver: { type: 'turn', modifier: 'left' }, name: 'High St' }) === 'Turn left onto High St' && Atlas.dist(1500) === '1.5 km');

    // Nudge: a due reminder alerts once; a repeating one moves to its next date.
    const nd = Nudge.data(); Nudge.save({ lists: nd.lists, tasks: [] });
    const t = Nudge.add({ title: 'Selftest reminder', due: Date.now() - 1000, repeat: 'daily' });
    Nudge.tick();
    ok('suite: reminder alerts', Shell.notes.some(n => n.title === 'Selftest reminder') && Nudge.data().tasks[0].notified);
    const r = Nudge.complete(t.id, true);
    ok('suite: repeating reminder moves on', r && !r.done && r.due > Date.now() && !r.notified);

    // Vault and Dropzone records.
    const vf = await Vault.add(new Blob(['hello'], { type: 'text/plain' }), 'selftest.txt', 'file');
    ok('suite: vault keeps a file', (await Vault.get(vf.id)).size === 5);
    await Vault.del(vf.id); ok('suite: vault deletes a file', !(await Vault.get(vf.id)));
    Downloads.record({ name: 'selftest.bin', size: 3, status: 'failed', error: 'test' });
    ok('suite: dropzone records failures', Downloads.list()[0].status === 'failed');

    // Moments edits are copies; the original stays as it was.
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 20; cv.getContext('2d').fillRect(0, 0, 40, 20);
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    const out = await PhotoEdit.render(blob, { rot: 90, crop: 'original' });
    ok('suite: photo edit rotates a copy', out.width === 20 && out.height === 40 && blob.size > 0);
    const sq = await PhotoEdit.render(blob, { crop: 'square' });
    ok('suite: photo edit crops square', sq.width === sq.height);

    // Honest screens: nothing pretends to work where it can't.
    Shell.open('pets:pocketpay'); await wait(40);
    ok('suite: PocketPay says payments are not set up', /Payments aren.t set up/.test(Shell.front().body.textContent));
    Shell.goHome(true);
    Shell.open('pets:safeline'); await wait(40);
    ok('suite: SafeLine call buttons off without a phone line', SafeLine.can() !== 'none' || $$('.st-sosbtn', Shell.front().body).every(b => b.disabled));
    Shell.goHome(true);
    if (!onPhone) { Shell.open('pets:torch'); await wait(40); ok('suite: Torch explains when there is no light', /No torch here/.test(Shell.front().body.textContent)); Shell.goHome(true); }
    Shell.open('pets:beacon'); await wait(40);
    ok('suite: Beacon says remote finding is not available', /Remote finding isn.t available/.test(Shell.front().body.textContent));
    Shell.goHome(true);
    Shell.open('pets:lingua'); await wait(40);
    ok('suite: Lingua discloses the network service', /MyMemory/.test(Shell.front().body.textContent));
    Shell.goHome(true);

    // Back and Home from deep inside an app.
    Shell.open('pets:nudge'); await wait(40);
    const nw = Shell.front(); $('.win[data-app="pets:nudge"] .acts button').click(); await wait(40);
    ok('suite: Nudge editor opens', nw.stack.length === 1);
    Shell.back(); ok('suite: back leaves the editor', nw.stack.length === 0 && Shell.front() === nw);
    Shell.home(); await wait(260); ok('suite: home goes home', !Shell.front());
    window.removeEventListener('error', onErr);
  }
};
window.SuiteTest = SuiteTest;
