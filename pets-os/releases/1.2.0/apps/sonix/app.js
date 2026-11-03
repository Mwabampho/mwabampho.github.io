// Sonix 2.0.0 for Windows and Linux. A port of the Mac SwiftUI app (ContentView, Router,
// PlayerEngine, UserLibrary and the Home/Search/Library/Studio/Collaborations screens).
import { catalogue, mmss, compact, artwork } from "./catalogue.js";
import { StudioAudioEngine } from "./studio.js";
import { icon } from "./icons.js";

const sb = window.shouldbe;
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- UserLibrary (same keys as the Mac's UserDefaults) ----------
const KEYS = { liked: "sonix.library.likedTrackIDs", saved: "sonix.library.savedAlbumIDs", followed: "sonix.library.followedArtistIDs", recent: "sonix.library.recentlyPlayedTrackIDs" };
const library = {
  liked: new Set(), saved: new Set(), followed: new Set(), recent: [],
  async load() {
    this.liked = new Set((await sb.store.get(KEYS.liked)) || []);
    this.saved = new Set((await sb.store.get(KEYS.saved)) || []);
    this.followed = new Set((await sb.store.get(KEYS.followed)) || []);
    this.recent = (await sb.store.get(KEYS.recent)) || [];
  },
  isLiked: (id) => library.liked.has(id),
  isAlbumSaved: (id) => library.saved.has(id),
  isFollowing: (id) => library.followed.has(id),
  async toggle(setName, key, id) {
    const s = this[setName];
    s.has(id) ? s.delete(id) : s.add(id);
    await sb.store.set(key, [...s]);
    changed();
  },
  toggleLike(id) { return this.toggle("liked", KEYS.liked, id); },
  toggleSaveAlbum(id) { return this.toggle("saved", KEYS.saved, id); },
  toggleFollow(id) { return this.toggle("followed", KEYS.followed, id); },
  async recordPlay(id) {
    this.recent = [id, ...this.recent.filter((x) => x !== id)].slice(0, 30);
    await sb.store.set(KEYS.recent, this.recent);
  },
};

// ---------- PlayerEngine ----------
const player = {
  el: new Audio(),
  currentTrack: null, isPlaying: false, currentTime: 0, duration: 0,
  queue: [], currentIndex: null, shuffleEnabled: false, repeatMode: "off", loadError: null, originalQueue: [],
  play(track, queue) {
    const q = queue && queue.length ? queue : [track];
    this.originalQueue = q;
    this.queue = this.shuffleEnabled ? shuffledKeepingFirst(q, track) : q;
    this.currentIndex = Math.max(0, this.queue.findIndex((t) => t.id === track.id));
    return this.loadAndPlay(track);
  },
  playAll(tracks, start) { if (tracks.length) return this.play(start || tracks[0], tracks); },
  shufflePlay(tracks) {
    if (!tracks.length) return;
    this.shuffleEnabled = true;
    this.originalQueue = tracks;
    this.queue = shuffle([...tracks]);
    this.currentIndex = 0;
    return this.loadAndPlay(this.queue[0]);
  },
  togglePlayPause() {
    if (!this.currentTrack || this.loadError) return;
    if (this.isPlaying) { this.el.pause(); this.isPlaying = false; } else { this.el.play().catch(() => {}); this.isPlaying = true; }
    playerChanged();
  },
  seek(t) { if (!this.currentTrack) return; const c = Math.max(0, Math.min(t, this.duration || 0)); this.el.currentTime = c; this.currentTime = c; playerChanged(); },
  next() { this.advance(false); },
  previous() {
    if (this.currentIndex == null) return;
    if (this.currentTime > 3) { this.seek(0); return; }
    const i = this.currentIndex - 1;
    if (i >= 0) { this.currentIndex = i; this.loadAndPlay(this.queue[i]); }
    else if (this.repeatMode === "all" && this.queue.length) { this.currentIndex = this.queue.length - 1; this.loadAndPlay(this.queue[this.currentIndex]); }
    else this.seek(0);
  },
  toggleShuffle() {
    this.shuffleEnabled = !this.shuffleEnabled;
    const cur = this.currentTrack;
    if (cur) {
      this.queue = this.shuffleEnabled ? shuffledKeepingFirst(this.originalQueue, cur) : this.originalQueue;
      this.currentIndex = Math.max(0, this.queue.findIndex((t) => t.id === cur.id));
    }
    playerChanged();
  },
  cycleRepeatMode() { this.repeatMode = { off: "all", all: "one", one: "off" }[this.repeatMode]; playerChanged(); },
  advance(auto) {
    if (this.currentIndex == null || !this.queue.length) return;
    if (auto && this.repeatMode === "one") { this.el.currentTime = 0; this.el.play().catch(() => {}); this.isPlaying = true; playerChanged(); return; }
    const i = this.currentIndex + 1;
    if (i < this.queue.length) { this.currentIndex = i; this.loadAndPlay(this.queue[i]); }
    else if (this.repeatMode === "all") { this.currentIndex = 0; this.loadAndPlay(this.queue[0]); }
    else { this.isPlaying = false; playerChanged(); }
  },
  async loadAndPlay(track) {
    this.currentTrack = track;
    this.currentTime = 0;
    this.loadError = null;
    this.el.src = `audio/${track.audioFileName}`;
    playerChanged();
    try {
      await this.el.play();
      this.duration = this.el.duration || track.duration;
      this.isPlaying = true;
      await library.recordPlay(track.id);
    } catch (e) {
      this.duration = track.duration;
      this.isPlaying = false;
      this.loadError = `Playback failed: ${e.message || e}`;
    }
    changed();
  },
};
player.el.preload = "auto";
player.el.addEventListener("ended", () => player.advance(true));
player.el.addEventListener("loadedmetadata", () => { player.duration = player.el.duration; playerChanged(); });
player.el.addEventListener("error", () => {
  if (!player.currentTrack) return;
  player.isPlaying = false;
  player.loadError = `“${player.currentTrack.title}” is unavailable — the audio file is missing from the bundle.`;
  changed();
});
setInterval(() => { if (player.isPlaying) { player.currentTime = player.el.currentTime; updateProgress(); } }, 250);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const shuffledKeepingFirst = (tracks, first) => [first, ...shuffle(tracks.filter((t) => t.id !== first.id))];

// ---------- Router ----------
const router = {
  selection: "home", path: [],
  select(s) { if (s !== this.selection) this.path = []; this.selection = s; changed(); $("#detail").scrollTop = 0; },
  push(r) { const last = this.path[this.path.length - 1]; if (last && last.kind === r.kind && last.id === r.id) return; this.path.push(r); changed(); $("#detail").scrollTop = 0; },
  pop() { this.path.pop(); changed(); },
};

const studio = new StudioAudioEngine(() => renderStudioStatus());
let projectName = "Untitled Project";
let selectedTool = "Beat Maker";
let drafted = new Set();
let settings = { autoUpdate: true, highQualityAudio: true, betaFeatures: false };

// ---------- Shared view pieces ----------
const grad = (st) => `linear-gradient(135deg, ${st.colors.join(", ")})`;
const art = (st, size, radius = 12, scale = 0.34) =>
  `<div class="art" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${grad(st)};font-size:${Math.round(size * scale)}px" aria-hidden="true">${esc(st.glyph)}</div>`;
const circleArt = (st, size, scale = 0.34) => art(st, size, size / 2, scale).replace('class="art"', 'class="art circle"');
const verified = () => `<span class="seal" title="Verified">${icon("seal")}</span>`;
const explicitBadge = (small) => `<span class="explicit${small ? " small" : ""}" title="Explicit">E</span>`;

function trackRow(t, { index, showArtwork = true, showAlbum = false, queue = [] } = {}) {
  const cur = player.currentTrack?.id === t.id;
  const ctx = encodeURIComponent(JSON.stringify(queue.map((x) => x.id)));
  return `<div class="track-row${cur ? " current" : ""}" role="button" tabindex="0" data-act="play" data-id="${t.id}" data-queue="${ctx}" aria-label="Play ${esc(t.title)}">
    ${index != null ? `<span class="idx">${cur && player.isPlaying ? `<span class="purple">${icon("speaker")}</span>` : index}</span>` : ""}
    ${showArtwork ? art(t.artwork, 42, 6) : ""}
    <div class="tmeta"><div class="ttitle">${esc(t.title)}${t.isExplicit ? explicitBadge(true) : ""}</div>
      <div class="sub">${esc(showAlbum ? `${t.artistName} • ${t.albumTitle}` : t.artistName)}</div></div>
    <span class="sub mono">${mmss(t.duration)}</span>
    <button class="icon-btn heart${library.isLiked(t.id) ? " on" : ""}" data-act="like" data-id="${t.id}" aria-label="${library.isLiked(t.id) ? "Remove from Liked Songs" : "Add to Liked Songs"}">${icon(library.isLiked(t.id) ? "heartFill" : "heart")}</button>
    <button class="icon-btn" data-act="track-menu" data-id="${t.id}" aria-label="More">${icon("ellipsis")}</button>
  </div>`;
}

const shelf = (title, inner) => `<section class="shelf"><h2>${esc(title)}</h2><div class="shelf-row">${inner}</div></section>`;
const artistCard = (a, w = 140) => `<button class="card" style="width:${w}px" data-act="artist" data-id="${a.id}">
  ${circleArt(a.artwork, w)}<div class="card-title center">${esc(a.name)}${a.isVerified ? verified() : ""}</div><div class="sub center">${esc(a.genres[0] || "Artist")}</div></button>`;
const albumCard = (al, w = 150) => `<div class="card" style="width:${w}px" role="button" tabindex="0" data-act="album" data-id="${al.id}">
  <div class="art-wrap">${art(al.artwork, w)}<button class="play-badge" data-act="play-album" data-id="${al.id}" aria-label="Play ${esc(al.title)}">${icon("playCircle")}</button></div>
  <div class="card-title">${esc(al.title)}</div><div class="sub">${esc(al.type)} • ${esc(al.artistName)}</div></div>`;
const playlistCard = (p, w = 150) => `<div class="card" style="width:${w}px" role="button" tabindex="0" data-act="playlist" data-id="${p.id}">
  <div class="art-wrap">${art(p.artwork, w)}<button class="play-badge" data-act="play-playlist" data-id="${p.id}" aria-label="Play ${esc(p.title)}">${icon("playCircle")}</button></div>
  <div class="card-title two">${esc(p.title)}</div><div class="sub">${esc(p.creator)}</div></div>`;
const trackTile = (t, queue) => `<button class="card" style="width:140px" data-act="play" data-id="${t.id}" data-queue="${encodeURIComponent(JSON.stringify(queue.map((x) => x.id)))}">
  ${art(t.artwork, 140)}<div class="card-title">${esc(t.title)}</div><div class="sub">${esc(t.artistName)}</div></button>`;
const notFound = (title, message) => `<div class="unavailable">${icon("warn")}<h3>${esc(title)}</h3><p class="sub">${esc(message)}</p></div>`;
const playButtons = (act, id, disabled) => `<div class="controls"><button class="btn prominent" data-act="${act}" data-id="${id}" ${disabled ? "disabled" : ""}>${icon("play")} Play</button>
  <button class="btn" data-act="${act}-shuffle" data-id="${id}" aria-label="Shuffle" ${disabled ? "disabled" : ""}>${icon("shuffle")}</button>`;

// ---------- Screens ----------
function homeView() {
  const recent = library.recent.map(catalogue.track).filter(Boolean);
  const popular = [...catalogue.artists].sort((a, b) => b.monthlyListeners - a.monthlyListeners);
  const releases = [...catalogue.albums].sort((a, b) => b.releaseDate - a.releaseDate);
  const followed = catalogue.artists.filter((a) => library.isFollowing(a.id));
  const pool = new Set((followed.length ? followed : catalogue.artists).map((a) => a.id));
  const recommended = [...catalogue.tracks.filter((t) => pool.has(t.artistID)), ...catalogue.tracks.filter((t) => !pool.has(t.artistID))].slice(0, 10);
  const h = new Date().getHours();
  const greeting = h >= 5 && h < 12 ? "Good Morning" : h >= 12 && h < 18 ? "Good Afternoon" : "Good Evening";
  return { title: "Home", html: `<div class="page">
    <header class="hero-head"><h1 class="rounded">${greeting}</h1><p class="sub">Pick up where you left off, or find something new.</p></header>
    ${recent.length ? shelf("Continue Listening", recent.slice(0, 10).map((t) => trackTile(t, recent)).join("")) : ""}
    ${followed.length ? shelf("Your Artists", followed.map((a) => artistCard(a)).join("")) : ""}
    ${shelf("Popular Artists", popular.map((a) => artistCard(a)).join(""))}
    ${shelf("New Releases", releases.map((a) => albumCard(a)).join(""))}
    ${shelf("Recommended For You", recommended.map((t) => trackTile(t, recommended)).join(""))}
    ${shelf("Made For You", catalogue.playlists.map((p) => playlistCard(p)).join(""))}
  </div>` };
}

let searchQuery = "";
function searchResultsHTML() {
  if (!searchQuery.trim()) {
    const genres = [...new Set(catalogue.artists.flatMap((a) => a.genres))].sort();
    return `<h2>Browse Genres</h2><div class="genre-grid">${genres.map((g) => `<button class="genre" style="background:${grad(artwork(g, ""))}" data-act="genre" data-id="${esc(g)}">${esc(g)}</button>`).join("")}</div>`;
  }
  const r = catalogue.search(searchQuery);
  if (!r.artists.length && !r.albums.length && !r.tracks.length && !r.playlists.length)
    return `<div class="unavailable">${icon("search")}<h3>No results for “${esc(searchQuery)}”</h3><p class="sub">Try a different artist, song, album, or playlist name.</p></div>`;
  return `${r.artists.length ? `<h3 class="sec">Artists</h3><div class="shelf-row">${r.artists.map((a) => artistCard(a)).join("")}</div>` : ""}
    ${r.tracks.length ? `<h3 class="sec">Songs</h3><div class="rows">${r.tracks.map((t) => trackRow(t, { showAlbum: true, queue: r.tracks })).join("")}</div>` : ""}
    ${r.albums.length ? `<h3 class="sec">Albums</h3><div class="shelf-row">${r.albums.map((a) => albumCard(a)).join("")}</div>` : ""}
    ${r.playlists.length ? `<h3 class="sec">Playlists</h3><div class="shelf-row">${r.playlists.map((p) => playlistCard(p)).join("")}</div>` : ""}`;
}
function searchView() {
  return { title: "Search", html: `<div class="page">
    <div class="search-field">${icon("search")}<input id="search" type="search" placeholder="Artists, songs, albums, or playlists" value="${esc(searchQuery)}" aria-label="Search">
    ${searchQuery ? `<button class="icon-btn" data-act="clear-search" aria-label="Clear">${icon("xmark")}</button>` : ""}</div>
    <div id="search-results">${searchResultsHTML()}</div></div>` };
}

function libraryView() {
  const liked = [...library.liked].map(catalogue.track).filter(Boolean).sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
  const saved = catalogue.albums.filter((a) => library.isAlbumSaved(a.id));
  const followed = catalogue.artists.filter((a) => library.isFollowing(a.id));
  const recent = library.recent.map(catalogue.track).filter(Boolean);
  const section = (title, empty, emptyText, inner) => `<section class="shelf"><h2>${title}</h2>${empty ? `<p class="sub">${emptyText}</p>` : inner}</section>`;
  return { title: "Library", html: `<div class="page">
    <h1 class="rounded">Your Library</h1>
    <section class="panel" id="liked-songs"><div class="row-head"><h2>Liked Songs</h2>
      ${liked.length ? `<span class="grow"></span><button class="btn prominent" data-act="play-liked">${icon("play")} Play</button><button class="btn" data-act="shuffle-liked" aria-label="Shuffle">${icon("shuffle")}</button>` : ""}</div>
      ${liked.length ? `<div class="rows">${liked.map((t, i) => trackRow(t, { index: i + 1, showAlbum: true, queue: liked })).join("")}</div>` : `<p class="sub">Songs you like will show up here. Tap the heart on any song to save it.</p>`}
    </section>
    ${section("Followed Artists", !followed.length, "Artists you follow will show up here.", `<div class="shelf-row">${followed.map((a) => artistCard(a)).join("")}</div>`)}
    ${section("Saved Albums", !saved.length, "Albums you save will show up here.", `<div class="shelf-row">${saved.map((a) => albumCard(a)).join("")}</div>`)}
    ${section("Playlists", false, "", `<div class="shelf-row">${catalogue.playlists.map((p) => playlistCard(p)).join("")}</div>`)}
    ${section("Recently Played", !recent.length, "Songs you play will show up here.", `<div class="rows">${recent.map((t) => trackRow(t, { showAlbum: true, queue: recent })).join("")}</div>`)}
  </div>` };
}

function studioView() {
  const tracks = ["Drums", "Bass", "Melody", "Vocals", "FX"];
  const tools = ["Beat Maker", "Vocal Recorder", "Mix & Master", "Collab Session"];
  const bars = (ti) => Array.from({ length: 18 }, (_, b) => `<i style="height:${8 + ((b * 7 + ti * 5) % 30)}px"></i>`).join("");
  return { title: "Studio", studio: true, html: `<div class="page studio">
    <div class="studio-head"><div><h1 class="rounded heavy">ARTIST STUDIO</h1><p class="sub">Create, record, arrange and save your work locally.</p></div>
      <input id="project-name" class="field" placeholder="Project name" aria-label="Project name" value="${esc(projectName)}"></div>
    <div class="segmented" role="radiogroup" aria-label="Tool">${tools.map((t) => `<button role="radio" aria-checked="${t === selectedTool}" class="${t === selectedTool ? "on" : ""}" data-act="tool" data-id="${esc(t)}">${esc(t)}</button>`).join("")}</div>
    <div class="timeline">${tracks.map((n, i) => `<div class="tl-row"><span class="tl-name">${n}</span><div class="tl-lane"><div class="clip" style="width:${(0.48 + i * 0.08) * 100}%"><div class="bars">${bars(i)}</div></div></div></div>`).join("")}</div>
    <div class="studio-actions">
      <button class="btn" id="record-btn" data-act="record" title="Ctrl+R">${studio.isRecording ? "Stop Recording" : "Record Vocal"}</button>
      <button class="btn" id="play-take-btn" data-act="play-take">Play Last Take</button>
      <button class="btn" data-act="reveal">Reveal Recordings</button>
      <span class="grow"></span>
      <span id="studio-status" class="sub small" role="status">${esc(studio.status)}</span>
      <button class="btn prominent" id="save-project-btn" data-act="save-project">Save Project</button>
    </div></div>` };
}

const COLLAB_ARTISTS = [
  ["Central Cee", "UK", "Drill / Hip Hop"], ["Digger D", "UK", "Drill / Hip Hop"], ["H", "UK", "Rap"],
  ["T-Sean", "Zambia", "Afrobeat / Zed Music"], ["Chanda Na Kay", "Zambia", "Zed Music / Hip Hop"], ["Yo Maps", "Zambia", "Afro Pop / Zed Music"],
];
function collaborationsView() {
  const ini = (n) => n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
  return { title: "Collaborations", html: `<div class="page"><div class="collab-grid">${COLLAB_ARTISTS.map(([name, region, genre]) => `<div class="panel collab">
    <div class="collab-art"><span>${esc(ini(name))}</span></div>
    <h3>${esc(name)}</h3><p class="sub">${esc(region)} • ${esc(genre)}</p>
    <p class="sub small">Public profile • collaboration/revenue participation activates only after artist or authorised representative acceptance.</p>
    <button class="btn prominent" data-act="draft" data-id="${esc(name)}" ${drafted.has(name) ? "disabled" : ""}>${drafted.has(name) ? "Invite Drafted" : "Prepare Collaboration Invite"}</button>
  </div>`).join("")}</div></div>` };
}

function artistView(id) {
  const a = catalogue.artist(id);
  if (!a) return { title: "", html: notFound("Artist Not Found", "This artist is no longer in the Sonix catalogue.") };
  const popular = catalogue.popularTracks(id, 10);
  const all = catalogue.albumsForArtist(id);
  const albums = all.filter((x) => x.type !== "Single"), singles = all.filter((x) => x.type === "Single");
  return { title: a.name, html: `<div class="page">
    <div class="detail-head center-v">${circleArt(a.artwork, 140, 0.4)}<div>
      <div class="big-title"><span class="rounded heavy" style="font-size:32px">${esc(a.name)}</span>${a.isVerified ? verified() : ""}</div>
      <p class="sub">${esc(a.origin)} • ${esc(a.genres.join(", "))}</p>
      <p class="sub small">${compact(a.monthlyListeners)} monthly listeners • ${compact(a.followers)} followers</p></div></div>
    ${playButtons("play-artist", id, !popular.length)}<button class="btn" data-act="follow" data-id="${id}">${library.isFollowing(id) ? "Following" : "Follow"}</button></div>
    ${popular.length ? `<section><h2>Popular</h2><div class="rows">${popular.map((t, i) => trackRow(t, { index: i + 1, queue: popular })).join("")}</div></section>` : ""}
    ${albums.length ? shelf("Albums & EPs", albums.map((x) => albumCard(x)).join("")) : ""}
    ${singles.length ? shelf("Singles", singles.map((x) => albumCard(x)).join("")) : ""}
    <section><h2>About</h2><p class="sub">${esc(a.bio)}</p><div class="chips">${a.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join("")}</div></section>
  </div>` };
}

const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
function albumView(id) {
  const al = catalogue.album(id);
  if (!al) return { title: "", html: notFound("Album Not Found", "This album is no longer in the Sonix catalogue.") };
  const tracks = catalogue.tracksForAlbum(id);
  return { title: al.title, html: `<div class="page">
    <div class="detail-head">${art(al.artwork, 160)}<div>
      <div class="kicker">${esc(al.type.toUpperCase())}</div><div class="rounded heavy" style="font-size:28px">${esc(al.title)}</div>
      <button class="link purple" data-act="artist" data-id="${al.artistID}">${esc(al.artistName)}</button>
      <p class="sub small">${al.releaseDate.getFullYear()} • ${tracks.length} songs</p></div></div>
    ${playButtons("play-album", id, !tracks.length)}
      <button class="btn" data-act="save-album" data-id="${id}" aria-label="${library.isAlbumSaved(id) ? "Remove from Library" : "Save to Library"}">${icon(library.isAlbumSaved(id) ? "checkCircle" : "plusCircle")}</button>
      <button class="icon-btn" data-act="album-menu" data-id="${id}" aria-label="More">${icon("ellipsisCircle")}</button></div>
    <div class="rows">${tracks.map((t, i) => trackRow(t, { index: i + 1, showArtwork: false, queue: tracks })).join("")}</div>
    <div><p class="sub">${esc(al.description)}</p><p class="sub small">${fmtDate(al.releaseDate)} • ${esc(al.label)}</p></div>
  </div>` };
}

function playlistView(id) {
  const p = catalogue.playlists.find((x) => x.id === id);
  if (!p) return { title: "", html: notFound("Playlist Not Found", "This playlist is no longer available.") };
  const tracks = catalogue.tracksForPlaylist(id);
  return { title: p.title, html: `<div class="page">
    <div class="detail-head">${art(p.artwork, 160)}<div>
      <div class="kicker">${p.isEditorial ? "SONIX PLAYLIST" : "PLAYLIST"}</div><div class="rounded heavy" style="font-size:26px">${esc(p.title)}</div>
      <p class="sub">${esc(p.description)}</p><p class="sub small">${esc(p.creator)} • ${tracks.length} songs</p></div></div>
    ${playButtons("play-playlist", id, !tracks.length)}</div>
    <div class="rows">${tracks.map((t, i) => trackRow(t, { index: i + 1, showAlbum: true, queue: tracks })).join("")}</div>
  </div>` };
}

// ---------- Rendering ----------
function currentView() {
  const r = router.path[router.path.length - 1];
  if (r) return r.kind === "artist" ? artistView(r.id) : r.kind === "album" ? albumView(r.id) : playlistView(r.id);
  return { home: homeView, search: searchView, library: libraryView, studio: studioView, collaborations: collaborationsView }[router.selection]();
}

function render() {
  const v = currentView();
  document.querySelectorAll(".side-item").forEach((b) => {
    const on = b.dataset.id === router.selection;
    b.classList.toggle("on", on);
    b.setAttribute("aria-current", on ? "page" : "false");
  });
  $("#nav-title").textContent = v.title;
  $("#back").hidden = router.path.length === 0;
  const focusSearch = document.activeElement?.id === "search";
  $("#detail-inner").innerHTML = v.html;
  $("#detail").classList.toggle("studio-bg", !!v.studio);
  if (focusSearch) { const s = $("#search"); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
  renderMini();
  if (!$("#now-playing").hidden) renderNowPlaying();
}
function changed() { render(); }
function playerChanged() { renderMini(); if (!$("#now-playing").hidden) renderNowPlaying(); }
function renderStudioStatus() {
  const s = $("#studio-status");
  if (s) s.textContent = studio.status;
  const b = $("#record-btn");
  if (b) b.textContent = studio.isRecording ? "Stop Recording" : "Record Vocal";
}

function renderMini() {
  const t = player.currentTrack;
  const bar = $("#mini");
  bar.hidden = !t;
  if (!t) return;
  bar.innerHTML = `<div class="progress"><div id="mini-fill" style="width:${frac() * 100}%"></div></div>
    <div class="mini-row"><button class="mini-open" data-act="open-np" aria-label="Open Now Playing">${art(t.artwork, 44, 6)}
      <span class="tmeta"><span class="ttitle" id="mini-title">${esc(t.title)}</span><span class="sub">${esc(t.artistName)}</span></span></button>
      <button class="icon-btn heart${library.isLiked(t.id) ? " on" : ""}" data-act="like" data-id="${t.id}" aria-label="Like">${icon(library.isLiked(t.id) ? "heartFill" : "heart")}</button>
      <div class="transport"><button class="icon-btn" data-act="prev" aria-label="Previous">${icon("backward")}</button>
      <button class="icon-btn big" id="mini-toggle" data-act="toggle" aria-label="${player.isPlaying ? "Pause" : "Play"}">${icon(player.isPlaying ? "pause" : "play")}</button>
      <button class="icon-btn" data-act="next" aria-label="Next">${icon("forward")}</button></div></div>`;
}
const frac = () => (player.duration > 0 ? Math.min(1, player.currentTime / player.duration) : 0);
let scrubbing = false;
function updateProgress() {
  const f = $("#mini-fill");
  if (f) f.style.width = `${frac() * 100}%`;
  const s = $("#np-slider");
  if (s && !scrubbing) { s.max = Math.max(player.duration, 1); s.value = player.currentTime; $("#np-cur").textContent = mmss(player.currentTime); $("#np-dur").textContent = mmss(player.duration); }
}

function renderNowPlaying() {
  const t = player.currentTrack;
  const body = $("#np-body");
  if (!t) {
    body.innerHTML = `<div class="unavailable">${icon("note")}<h3>Nothing Playing</h3><p class="sub">Choose a song from Home, Search, or an artist page.</p></div>`;
    return;
  }
  body.innerHTML = `<div class="np">
    <div class="np-art">${art(t.artwork, 320, 20)}</div>
    <div class="np-title"><span class="rounded heavy" style="font-size:24px">${esc(t.title)}</span>${t.isExplicit ? explicitBadge() : ""}</div>
    <button class="link sub np-artist" data-act="np-artist" data-id="${t.artistID}">${esc(t.artistName)}</button>
    ${player.loadError ? `<p class="np-error">${esc(player.loadError)}</p>` : ""}
    <div class="np-progress"><input id="np-slider" type="range" min="0" step="0.01" max="${Math.max(player.duration, 1)}" value="${player.currentTime}" aria-label="Position">
      <div class="np-times sub mono"><span id="np-cur">${mmss(player.currentTime)}</span><span id="np-dur">${mmss(player.duration)}</span></div></div>
    <div class="np-transport">
      <button class="icon-btn${player.shuffleEnabled ? " purple" : ""}" data-act="np-shuffle" aria-label="Shuffle" aria-pressed="${player.shuffleEnabled}">${icon("shuffle")}</button>
      <button class="icon-btn mid" data-act="prev" aria-label="Previous">${icon("backward")}</button>
      <button class="icon-btn huge" data-act="toggle" aria-label="${player.isPlaying ? "Pause" : "Play"}">${icon(player.isPlaying ? "pauseCircle" : "playCircle")}</button>
      <button class="icon-btn mid" data-act="next" aria-label="Next">${icon("forward")}</button>
      <button class="icon-btn${player.repeatMode !== "off" ? " purple" : ""}" data-act="repeat" aria-label="Repeat ${player.repeatMode}">${icon(player.repeatMode === "one" ? "repeat1" : "repeat")}</button>
    </div>
    <div class="np-secondary"><button class="icon-btn heart${library.isLiked(t.id) ? " on" : ""}" data-act="like" data-id="${t.id}" aria-label="Like">${icon(library.isLiked(t.id) ? "heartFill" : "heart")}</button>
      <span class="grow"></span><button class="link sub small" data-act="np-album" data-id="${t.albumID}">${icon("stack")} Go to Album</button></div>
  </div>`;
}
function openNowPlaying() { $("#now-playing").hidden = false; renderNowPlaying(); $("#np-close").focus(); }
function closeNowPlaying() { $("#now-playing").hidden = true; }

// ---------- Menus ----------
function showMenu(anchor, items) {
  closeMenu();
  const m = document.createElement("div");
  m.className = "menu";
  m.setAttribute("role", "menu");
  m.innerHTML = items.map((it, i) => `<button role="menuitem" data-i="${i}">${esc(it[0])}</button>`).join("");
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  m.style.top = `${Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8)}px`;
  m.style.left = `${Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8))}px`;
  m.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; closeMenu(); items[+b.dataset.i][1](); });
  m.querySelector("button")?.focus();
}
function closeMenu() { document.querySelector(".menu")?.remove(); }

// ---------- Settings ----------
function openSettings() {
  const d = $("#settings");
  $("#set-version").textContent = "Current version: 2.0.0";
  $("#set-hq").checked = settings.highQualityAudio;
  $("#set-beta").checked = settings.betaFeatures;
  d.hidden = false;
  $("#settings-close").focus();
}

// ---------- Events ----------
const queueFrom = (el) => { try { return JSON.parse(decodeURIComponent(el.dataset.queue || "")).map(catalogue.track).filter(Boolean); } catch { return []; } };
async function act(el, e) {
  const id = el.dataset.id;
  switch (el.dataset.act) {
    case "nav": closeNowPlaying(); return router.select(id);
    case "back": return router.pop();
    case "settings": return openSettings();
    case "artist": return router.push({ kind: "artist", id });
    case "album": return router.push({ kind: "album", id });
    case "playlist": return router.push({ kind: "playlist", id });
    case "play": { const t = catalogue.track(id); return player.play(t, queueFrom(el)); }
    case "play-album": return player.playAll(catalogue.tracksForAlbum(id));
    case "play-album-shuffle": return player.shufflePlay(catalogue.tracksForAlbum(id));
    case "play-playlist": return player.playAll(catalogue.tracksForPlaylist(id));
    case "play-playlist-shuffle": return player.shufflePlay(catalogue.tracksForPlaylist(id));
    case "play-artist": return player.playAll(catalogue.popularTracks(id, 10));
    case "play-artist-shuffle": return player.shufflePlay(catalogue.popularTracks(id, 10));
    case "play-liked": case "shuffle-liked": {
      const liked = [...library.liked].map(catalogue.track).filter(Boolean).sort((a, b) => (a.title < b.title ? -1 : 1));
      return el.dataset.act === "play-liked" ? player.playAll(liked) : player.shufflePlay(liked);
    }
    case "like": return library.toggleLike(id);
    case "follow": return library.toggleFollow(id);
    case "save-album": return library.toggleSaveAlbum(id);
    case "track-menu": {
      const t = catalogue.track(id);
      return showMenu(el, [[library.isLiked(id) ? "Remove from Liked Songs" : "Add to Liked Songs", () => library.toggleLike(id)], ["Go to Artist", () => router.push({ kind: "artist", id: t.artistID })], ["Go to Album", () => router.push({ kind: "album", id: t.albumID })]]);
    }
    case "album-menu": {
      const al = catalogue.album(id);
      return showMenu(el, [["Go to Artist", () => router.push({ kind: "artist", id: al.artistID })], [library.isAlbumSaved(id) ? "Remove from Library" : "Save to Library", () => library.toggleSaveAlbum(id)]]);
    }
    case "genre": searchQuery = id; return render();
    case "clear-search": searchQuery = ""; return render();
    case "toggle": return player.togglePlayPause();
    case "prev": return player.previous();
    case "next": return player.next();
    case "np-shuffle": return player.toggleShuffle();
    case "repeat": return player.cycleRepeatMode();
    case "open-np": return openNowPlaying();
    case "np-artist": router.push({ kind: "artist", id }); return closeNowPlaying();
    case "np-album": router.push({ kind: "album", id }); return closeNowPlaying();
    case "tool": selectedTool = id; return render();
    case "record": return studio.toggleRecord();
    case "play-take": return studio.playLastTake();
    case "reveal": return studio.revealRecordings();
    case "save-project": studio.lastProjectPath = await studio.saveProject(projectName); return;
    case "draft": drafted.add(id); await sb.store.set("sonix.collab.draftedInvites", [...drafted]); return render();
  }
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu")) closeMenu();
  const el = e.target.closest("[data-act]");
  if (el && !el.disabled) { e.stopPropagation(); act(el, e); }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { if (document.querySelector(".menu")) closeMenu(); else if (!$("#settings").hidden) $("#settings").hidden = true; else if (!$("#now-playing").hidden) closeNowPlaying(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r" && router.selection === "studio" && !router.path.length) { e.preventDefault(); studio.toggleRecord(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === ",") { e.preventDefault(); openSettings(); return; }
  const el = e.target.closest?.("[data-act][role=button]");
  if (el && (e.key === "Enter" || e.key === " ") && e.target === el) { e.preventDefault(); act(el, e); }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    searchQuery = e.target.value;
    $("#search-results").innerHTML = searchResultsHTML();
    const field = $(".search-field");
    const has = !!field.querySelector("[data-act=clear-search]");
    if (!!searchQuery !== has) render();
  } else if (e.target.id === "project-name") projectName = e.target.value;
  else if (e.target.id === "np-slider") { scrubbing = true; $("#np-cur").textContent = mmss(+e.target.value); }
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "np-slider") { player.seek(+e.target.value); scrubbing = false; }
  else if (e.target.id === "set-hq") { settings.highQualityAudio = e.target.checked; await sb.store.set("sonics.highQualityAudio", settings.highQualityAudio); }
  else if (e.target.id === "set-beta") { settings.betaFeatures = e.target.checked; await sb.store.set("sonics.betaFeatures", settings.betaFeatures); }
});
$("#np-close").addEventListener("click", closeNowPlaying);
$("#settings-close").addEventListener("click", () => ($("#settings").hidden = true));
$("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") $("#settings").hidden = true; });
$("#open-site").addEventListener("click", () => sb.openExternal("https://shouldbe.media/apps/sonix"));

// ---------- Start ----------
await library.load();
drafted = new Set((await sb.store.get("sonix.collab.draftedInvites")) || []);
for (const k of ["highQualityAudio", "betaFeatures"]) { const v = await sb.store.get(`sonics.${k}`); if (typeof v === "boolean") settings[k] = v; }
render();

// Handles for the self-test (selftest.js) — the same objects the UI uses.
window.sonix = { catalogue, library, player, router, studio, render, openNowPlaying, closeNowPlaying };
document.body.dataset.ready = "1";
