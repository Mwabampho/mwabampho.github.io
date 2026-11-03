// The Sonix catalogue, ported from the Mac app's Models/MusicCatalogue.swift and
// MusicModels.swift: 8 demo artists (one bundled synth clip each, as an album with two
// mixes plus a radio-edit single), Cactic Gee's profile with three clips, and 4 playlists.

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

const ROSTER = [
  ["artist-1", "Ari Vale", "@arivale", "Bristol, UK", ["Synthwave", "Electronic"],
    "Ari Vale blends 80s analog synth textures with modern UK bass architecture, crafting emotive nightscapes and driving highway rhythms from an analog studio in Bristol.",
    148520, 42100, "Neon Nights", "Electric City", "Album", 2026, "Sonix Independent Sound Recordings", "track-1.wav", "Synthwave"],
  ["artist-2", "Mila Rose", "@milarose", "London, UK", ["Neo-Soul", "Indie R&B"],
    "Mila Rose is a London-based singer, composer and multi-instrumentalist whose intimate vocals float over lush, tape-saturated harmonies and organic drum grooves.",
    215400, 68900, "Afterglow", "Velvet Skies", "Album", 2026, "Acoustic Meridian Records", "track-2.wav", "Neo-Soul"],
  ["artist-3", "Kairo", "@kairo_sound", "Manchester, UK", ["Industrial Techno", "Cyberpunk"],
    "Kairo crafts relentless, industrial-grade electronics built for cavernous warehouse sound systems and late-night highway sprints.",
    92300, 24700, "Midnight Run", "No Sleep", "EP", 2026, "Subterranean Frequency Lab", "track-3.wav", "Cyberpunk"],
  ["artist-4", "Nova Rey", "@novarey", "Berlin, Germany", ["Indie Electronic", "Dream Pop"],
    "Berlin-based Nova Rey merges delicate dream-pop melodies with crystal-clear modular sound design and widescreen stereo fields.",
    178900, 51200, "Skyline", "High Above", "Album", 2026, "Prism Wave Audio", "track-4.wav", "Indie Electronic"],
  ["artist-5", "Elio", "@eliomusic", "Edinburgh, UK", ["Downtempo", "Lo-Fi Chill"],
    "Subtle acoustic guitars, dusty vinyl chops and deep sub frequencies form the cinematic world of Scottish producer Elio.",
    64100, 18400, "Slow Motion", "Frames", "EP", 2026, "Dust & Tape Collective", "track-5.wav", "Lo-Fi Chill"],
  ["artist-6", "Vanta", "@vantarecords", "Stockholm, Sweden", ["Dark Ambient", "Glitch"],
    "Exploring silence, subterranean rumble and microscopic acoustic textures, Vanta creates deep sonic environments for focus and meditation.",
    112000, 39500, "No Signal", "Offline", "Single", 2026, "Void Space Recordings", "track-6.wav", "Dark Ambient"],
  ["artist-7", "Luna K", "@lunak_official", "Brighton, UK", ["Nu-Disco", "Funk"],
    "Infectious analog slap bass, sparkling Rhodes keys and seaside sunset optimism — Luna K brings warmth and euphoria to the dance floor.",
    310500, 94200, "Ocean Drive", "Coastline", "Album", 2026, "Solar Flare Music", "track-7.wav", "Nu-Disco"],
  ["artist-8", "Sena", "@senasound", "Tokyo, Japan", ["Ambient", "Future Beats"],
    "Combining traditional East Asian acoustic instruments with modular frequency modulation and spatial audio reverbs.",
    84300, 21900, "Gravity", "Orbit", "EP", 2026, "Zero Gravity Sonic Arts", "track-8.wav", "Ambient"],
];

function build() {
  const artists = [], albums = [], tracks = [];
  for (const [id, name, handle, origin, genres, bio, listeners, followers, trackTitle, albumTitle, albumType, year, label, audioFile, genre] of ROSTER) {
    artists.push({ id, name, handle, origin, genres, bio, isVerified: true, monthlyListeners: listeners, followers, artwork: artwork(id, initials(name)) });
    const releaseDate = new Date(year, 1, 14);
    const albumArt = artwork(id + "-album", initials(albumTitle));
    const credits = { composer: name, producer: name, copyright: `℗ ${year} ${label}` };
    const albumID = `${id}-album`, singleID = `${id}-single-release`;
    const mk = (tid, title, number, aid, atitle) => ({ id: tid, title, artistID: id, artistName: name, albumID: aid, albumTitle: atitle, trackNumber: number, duration: 12, audioFileName: audioFile, genre, releaseDate, isExplicit: false, credits, artwork: albumArt });
    tracks.push(mk(`${id}-orig`, trackTitle, 1, albumID, albumTitle));
    tracks.push(mk(`${id}-alt`, `${trackTitle} (Slowed + Reverb)`, 2, albumID, albumTitle));
    tracks.push(mk(`${id}-single`, `${trackTitle} (Radio Edit)`, 1, singleID, `${trackTitle} (Radio Edit)`));
    albums.push({ id: albumID, title: albumTitle, artistID: id, artistName: name, type: albumType, releaseDate, label, description: `Original release from ${name}, remastered for Sonix.`, trackIDs: [`${id}-orig`, `${id}-alt`], artwork: albumArt });
    albums.push({ id: singleID, title: `${trackTitle} (Radio Edit)`, artistID: id, artistName: name, type: "Single", releaseDate, label, description: `Radio edit single from ${name}.`, trackIDs: [`${id}-single`], artwork: albumArt });
  }

  // Cactic Gee (the app owner's own artist profile).
  const cid = "artist-cactic-gee";
  const cart = artwork(cid, "CG");
  artists.push({ id: cid, name: "Cactic Gee", handle: "@cacticgee", origin: "Zambia", genres: ["Hip Hop", "Afrobeats"],
    bio: "Cactic Gee is an independent artist on Sonix blending sharp hip hop songwriting with warm, bass-driven Afrobeat-influenced production.",
    isVerified: true, monthlyListeners: 8400, followers: 2150, artwork: cart });
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
  const playlists = [
    { id: "pl-sonix-spotlight", title: "Sonix Pulse: Independent Resonance", description: "The definitive sound of independent creators on Sonix, curated weekly.", creator: "Sonix Editorial", isEditorial: true,
      trackIDs: [...ids("artist-1", 1), ...ids("artist-2", 1), ...ids("artist-7", 1)], artwork: artwork("pl-spotlight", "✦") },
    { id: "pl-late-night", title: "Late Night Cyber Resonance", description: "Hypnotic synth bass, dark highway rhythms and futuristic club electronics.", creator: "Sonix Curators", isEditorial: true,
      trackIDs: [...ids("artist-3", 1), ...ids("artist-1", 1), ...ids("artist-6", 1)], artwork: artwork("pl-late-night", "☽") },
    { id: "pl-deep-focus", title: "Deep Acoustic Focus", description: "Minimal textures, downtempo tape loops and binaural ambience for creative flow.", creator: "Sonix Sound Lab", isEditorial: true,
      trackIDs: [...ids("artist-5", 1), ...ids("artist-6", 1), ...ids("artist-8", 1)], artwork: artwork("pl-deep-focus", "◈") },
    { id: "pl-new-and-next", title: "New & Next", description: "Fresh releases and rising independent artists you should hear first.", creator: "Sonix Editorial", isEditorial: true,
      trackIDs: [single.id, a1.id, ...ids("artist-4", 1)], artwork: cart },
  ];
  return { artists, albums, tracks, playlists };
}

const data = build();
const byID = (list) => new Map(list.map((x) => [x.id, x]));
const A = byID(data.artists), AL = byID(data.albums), T = byID(data.tracks);

export const catalogue = {
  ...data,
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
      tracks: data.tracks.filter((t) => t.title.toLowerCase().includes(q) || t.artistName.toLowerCase().includes(q)),
      playlists: data.playlists.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    };
  },
};

export const mmss = (s) => {
  const t = Math.round(s || 0);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
export const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
