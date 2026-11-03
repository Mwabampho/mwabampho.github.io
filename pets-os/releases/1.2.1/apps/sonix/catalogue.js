// The Sonix catalogue: 8 real independent releases (free licences, streamed from the Internet
// Archive with the artists' own covers), Apple Music's UK Top Songs as 30-second previews,
// Cactic Gee's profile with three bundled clips, and 4 playlists.

// SwiftUI system colours (dark appearance) used by ArtworkStyle.palette.
const C = {
  purple: "#bf5af2", blue: "#0a84ff", black: "#000000", pink: "#ff375f", orange: "#ff9f0a",
  red: "#ff453a", cyan: "#64d2ff", indigo: "#5e5ce6", green: "#30d158", teal: "#40c8e0",
  yellow: "#ffd60a", mint: "#66d4cf",
};
const PALETTE = [
  [C.purple, C.blue, C.black], [C.pink, C.purple, C.black], [C.orange, C.red, C.black],
  [C.cyan, C.blue, C.black], [C.indigo, C.purple, C.black], [C.green, C.teal, C.black],
  [C.yellow, C.orange, C.black], [C.red, C.pink, C.black], [C.mint, C.cyan, C.black],
  [C.teal, C.indigo, C.black],
];

// FNV-1a 64-bit, same as the Mac, so every artist gets the same colours there and here.
export function artwork(seed, glyph) {
  let h = 0xcbf29ce484222325n;
  for (const b of new TextEncoder().encode(seed)) h = ((h ^ BigInt(b)) * 0x100000001b3n) & 0xffffffffffffffffn;
  return { colors: PALETTE[Number(h % BigInt(PALETTE.length))], glyph };
}

const initials = (name) => name.split(" ").filter(Boolean).slice(0, 2).map((w) => [...w][0]).join("");

// Real releases (tools/build_releases.py): albums the artists published under free licences, streamed
// from the Internet Archive with their own cover art; plus Apple Music's UK chart as 30-second previews.
import { RELEASES } from "./releases.js";
import { CHART } from "./charts.js";

const cover = (id, image, glyph) => ({ ...artwork(id, glyph), image });

function build() {
  const artists = [], albums = [], tracks = [];
  for (const r of RELEASES) {
    const id = `artist-${r.id}`, albumID = `${r.id}-album`;
    const art = cover(albumID, r.cover, initials(r.title));
    const releaseDate = new Date(r.date.length === 4 ? `${r.date}-01-01` : r.date);
    artists.push({ id, name: r.artist, origin: "Independent", genres: r.genres, isVerified: false, licence: r.licence, source: r.source,
      bio: `${r.artist} released “${r.title}” in ${releaseDate.getFullYear()} and chose to share it freely under ${r.licence}. Streamed from the Internet Archive.`,
      artwork: cover(id, r.cover, initials(r.artist)) });
    const credits = { composer: r.artist, producer: r.artist, copyright: `℗ ${releaseDate.getFullYear()} ${r.artist} · ${r.licence}` };
    const ids = r.tracks.map((t) => {
      const tid = `${r.id}-${t.n}`;
      tracks.push({ id: tid, title: t.title, artistID: id, artistName: r.artist, albumID, albumTitle: r.title, trackNumber: t.n, duration: t.duration,
        audioURL: t.url, genre: r.genres[0], releaseDate, isExplicit: false, credits, artwork: art });
      return tid;
    });
    albums.push({ id: albumID, title: r.title, artistID: id, artistName: r.artist, type: ids.length >= 7 ? "Album" : "EP", releaseDate,
      label: `${r.licence} · Internet Archive`, licence: r.licence, licenceURL: r.licenceURL, source: r.source,
      description: `By ${r.artist}. Free to share under ${r.licence}: the artist allows anyone to play and share it with credit.`, trackIDs: ids, artwork: art });
  }

  // Cactic Gee (the app owner's own artist profile).
  const cid = "artist-cactic-gee";
  const cart = artwork(cid, "CG");
  artists.push({ id: cid, name: "Cactic Gee", origin: "Zambia", genres: ["Hip Hop", "Afrobeats"],
    bio: "Cactic Gee is an independent artist on Sonix blending sharp hip hop songwriting with warm, bass-driven Afrobeat-influenced production.",
    isVerified: true, artwork: cart });
  const cdate = new Date(2026, 2, 1);
  const ccred = { composer: "Cactic Gee", producer: "Cactic Gee", copyright: "℗ 2026 Cactic Gee" };
  const ct = (id, title, albumID, albumTitle, n, duration, file, genre, isExplicit) => ({ id, title, artistID: cid, artistName: "Cactic Gee", albumID, albumTitle, trackNumber: n, duration, audioFileName: file, genre, releaseDate: cdate, isExplicit, credits: ccred, artwork: cart });
  const single = ct("cactic-skyline-freestyle", "Skyline Freestyle", "cactic-single-release", "Skyline Freestyle", 1, 10.4, "cactic-1.wav", "Hip Hop", true);
  const a1 = ct("cactic-copperbelt-nights", "Copperbelt Nights", "cactic-album", "Copperbelt Nights", 1, 9.0, "cactic-2.wav", "Afrobeats", false);
  const a2 = ct("cactic-higher", "Higher", "cactic-album", "Copperbelt Nights", 2, 10.4, "cactic-3.wav", "Afrobeats", false);
  tracks.push(single, a1, a2);
  albums.push({ id: "cactic-single-release", title: "Skyline Freestyle", artistID: cid, artistName: "Cactic Gee", type: "Single", releaseDate: cdate, label: "Independent", description: "Debut freestyle single from Cactic Gee.", trackIDs: [single.id], artwork: cart });
  albums.push({ id: "cactic-album", title: "Copperbelt Nights", artistID: cid, artistName: "Cactic Gee", type: "EP", releaseDate: cdate, label: "Independent", description: "A two-track introduction to Cactic Gee's sound.", trackIDs: [a1.id, a2.id], artwork: cart });

  const ids = (aid, limit) => tracks.filter((t) => t.artistID === aid).slice(0, limit).map((t) => t.id);
  const pick = (r, n) => `${r}-${n}`;
  const playlists = [
    { id: "pl-sonix-spotlight", title: "Sonix Pulse: Independent Resonance", description: "Real releases from independent artists who share their music freely.", creator: "Sonix Editorial", isEditorial: true,
      trackIDs: [pick("josh-woodward", 1), pick("broke-for-free", 1), pick("jahzzar", 7), pick("freak-fandango", 3), pick("loyalty-freak", 1)], artwork: artwork("pl-spotlight", "✦") },
    { id: "pl-late-night", title: "Late Night Resonance", description: "Cinematic electronics and late-night beats.", creator: "Sonix Curators", isEditorial: true,
      trackIDs: [pick("kai-engel", 2), pick("broke-for-free", 6), pick("rolemusic", 4), pick("loyalty-freak", 3), pick("kai-engel", 7)], artwork: artwork("pl-late-night", "☽") },
    { id: "pl-deep-focus", title: "Deep Focus", description: "Calm, instrumental music for concentrating.", creator: "Sonix Sound Lab", isEditorial: true,
      trackIDs: [pick("kai-engel", 1), pick("rolemusic", 1), pick("komiku", 5), pick("broke-for-free", 3), pick("kai-engel", 6)], artwork: artwork("pl-deep-focus", "◈") },
    { id: "pl-new-and-next", title: "New & Next", description: "Cactic Gee alongside fresh independent picks.", creator: "Sonix Editorial", isEditorial: true,
      trackIDs: [single.id, a1.id, pick("komiku", 1), pick("jahzzar", 1)], artwork: cart },
  ].map((p) => ({ ...p, trackIDs: p.trackIDs.filter((t) => tracks.some((x) => x.id === t)) }));
  return { artists, albums, tracks, playlists };
}

const data = build();
// Apple Music chart songs: 30-second previews, official cover art, links to the full song on Apple Music.
const chartTrack = (c) => ({ id: `apple-${c.id}`, appleID: c.id, title: c.title, artistID: null, artistName: c.artist, albumID: null, albumTitle: c.album,
  trackNumber: c.position, chartPosition: c.position, duration: 30, audioURL: c.preview, isPreview: true, appleURL: c.appleURL, artistURL: c.artistURL, albumURL: c.albumURL,
  genre: c.genre, releaseDate: new Date(c.released || Date.now()), isExplicit: c.explicit, credits: { copyright: "Preview courtesy of Apple Music" },
  artwork: cover(`apple-${c.id}`, c.artwork, initials(c.title)) });
const chart = { title: CHART.title, source: CHART.source, updated: CHART.updated, tracks: CHART.songs.map(chartTrack) };
const byID = (list) => new Map(list.map((x) => [x.id, x]));
const A = byID(data.artists), AL = byID(data.albums), T = byID([...data.tracks, ...chart.tracks]);

// Refresh the chart's preview links and cover art from Apple (they can change); the bundled snapshot is the fallback.
export async function refreshChart() {
  const ids = chart.tracks.map((t) => t.appleID).join(",");
  const r = await fetch(`https://itunes.apple.com/lookup?country=${CHART.country}&id=${ids}`);
  if (!r.ok) throw new Error(`Apple Music lookup failed (${r.status})`);
  for (const L of (await r.json()).results || []) {
    const t = T.get(`apple-${L.trackId}`);
    if (!t || !L.previewUrl) continue;
    t.audioURL = L.previewUrl;
    t.artwork.image = String(L.artworkUrl100 || "").replace(/\/\d+x\d+bb\./, "/600x600bb.") || t.artwork.image;
  }
  return chart;
}

export const catalogue = {
  ...data,
  chart,
  artist: (id) => A.get(id),
  album: (id) => AL.get(id),
  track: (id) => T.get(id),
  albumsForArtist: (aid) => data.albums.filter((a) => a.artistID === aid).sort((x, y) => y.releaseDate - x.releaseDate),
  tracksForAlbum: (id) => (AL.get(id)?.trackIDs || []).map((t) => T.get(t)).filter(Boolean),
  popularTracks: (aid, limit = 5) => data.tracks.filter((t) => t.artistID === aid).slice(0, limit),
  tracksForPlaylist: (id) => (data.playlists.find((p) => p.id === id)?.trackIDs || []).map((t) => T.get(t)).filter(Boolean),
  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return { artists: [], albums: [], tracks: [], playlists: [] };
    return {
      artists: data.artists.filter((a) => a.name.toLowerCase().includes(q) || a.genres.some((g) => g.toLowerCase().includes(q))),
      albums: data.albums.filter((a) => a.title.toLowerCase().includes(q) || a.artistName.toLowerCase().includes(q)),
      tracks: [...data.tracks, ...chart.tracks].filter((t) => t.title.toLowerCase().includes(q) || t.artistName.toLowerCase().includes(q) || (t.isPreview && t.albumTitle.toLowerCase().includes(q))),
      playlists: data.playlists.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    };
  },
};

export const mmss = (s) => {
  const t = Math.round(s || 0);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
export const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
