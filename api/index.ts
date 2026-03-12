import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import yt from "youtube-search-api";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const spotifyUrlInfo = require("spotify-url-info");
const { getDetails, getTracks } = spotifyUrlInfo(fetch);

const app = express();
app.use(express.json());

// Helper Artist - Jauh lebih kuat untuk menghindari "Unknown"
const getArtistName = (track: any) => {
  try {
    if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
      return track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(", ");
    }
    if (track.artist) return typeof track.artist === 'string' ? track.artist : track.artist.name;
    if (track.track?.artists) return track.track.artists.map((a: any) => a.name).join(", ");
  } catch (e) {}
  return "";
};

// 1. Metadata Search (iTunes)
app.get("/api/search/metadata", async (req, res) => {
  try {
    const query = req.query.query as string;
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
    const data = await response.json();
    const suggestions = data.results.map((item: any) => ({
      title: item.trackName, artist: item.artistName, artwork: item.artworkUrl100.replace('100x100bb', '600x600bb'), album: item.collectionName
    }));
    res.json(suggestions.filter((v:any, i:any, a:any) => a.findIndex((t:any) => (t.artist === v.artist)) === i));
  } catch (error) { res.status(500).json({ error: "Metadata search failed" }); }
});

// 2. YouTube Search (Hanya Musik)
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    const musicOnlyQuery = `${query} music official`;
    const results = await yt.GetListByKeyword(musicOnlyQuery, false, 20);
    res.json(results);
  } catch (error) { res.status(500).json({ error: "YouTube search failed" }); }
});

// 3. YouTube Download (RapidAPI)
app.get("/api/download/youtube", async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop();
    const response = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
      headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY || 'de35706886msh5b5e7598b2a83ebp1c7f95jsn29054b6da879', 'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com' }
    });
    const data = await response.json();
    if (data.status === 'ok') res.json({ status: "ok", title: data.title, link: data.link, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, user: "YouTube Music" });
    else throw new Error("Failed");
  } catch (error: any) { res.status(500).json({ error: "Failed" }); }
});

// 4. Spotify Playlist Info (DIOPTIMASI)
app.get("/api/spotify/playlist", async (req, res) => {
  try {
    const url = req.query.url as string;
    const tracks = await getTracks(url);
    const details = await getDetails(url);
    const mapped = tracks.map((t: any) => ({
      title: t.name || t.title,
      artist: getArtistName(t), // Jauh lebih akurat sekarang
      thumbnail: t.album?.images?.[0]?.url || t.coverArt?.sources?.[0]?.url || details.preview?.image || "",
      duration: Math.floor(t.duration_ms / 1000)
    }));
    res.json({ name: details.preview?.title || "Spotify Playlist", artwork_url: details.preview?.image || "", tracks: mapped });
  } catch (error) { res.status(500).json({ error: "Spotify fetch failed" }); }
});

// 5. Spotify Trending (Dibuat super stabil via YT)
app.get("/api/spotify/trending", async (req, res) => {
  try {
    const results = await yt.GetListByKeyword("Spotify Top Hits Indonesia 2024 official music", false, 25);
    const mapped = (results.items || []).map((t: any) => ({
      title: t.title, artist: t.channelTitle || "YouTube Music", thumbnail: t.thumbnail?.thumbnails?.[0]?.url || "",
      permalink_url: `https://www.youtube.com/watch?v=${t.id}`, id: t.id
    }));
    res.json(mapped);
  } catch (error) { res.status(500).json({ error: "Failed" }); }
});

// 6. External & History
app.get("/api/search/soundcloud", async (req, res) => {
  try { const response = await fetch(`https://api.siputzx.my.id/api/s/soundcloud?query=${encodeURIComponent(req.query.query as string)}`); res.json(await response.json()); } catch (e) { res.status(500).json({error: "Failed"}); }
});
app.get("/api/download/external", async (req, res) => {
  try { const type = req.query.url?.toString().includes('spotify') ? 'spotify' : 'soundcloud'; const response = await fetch(`https://api.siputzx.my.id/api/d/${type}?url=${encodeURIComponent(req.query.url as string)}`); res.json(await response.json()); } catch (e) { res.status(500).json({error: "Failed"}); }
});
const getDb = () => {
  const Database = require("better-sqlite3");
  const db = new Database(process.env.VERCEL ? ':memory:' : 'history.db');
  db.exec(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, permalink_url TEXT, thumbnail TEXT, duration INTEGER, user TEXT, description TEXT, played_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  return db;
};
app.get("/api/history", (req, res) => { try { res.json(getDb().prepare('SELECT * FROM history ORDER BY played_at DESC LIMIT 50').all()); } catch (e) { res.json([]); } });
app.post("/api/history", (req, res) => { try { const { title, url, permalink_url, thumbnail, duration, user, description } = req.body; getDb().prepare('INSERT INTO history (title, url, permalink_url, thumbnail, duration, user, description) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, url, permalink_url, thumbnail, duration, user, description); res.json({ success: true }); } catch (e) { res.status(500).json({ error: "Failed" }); } });

export default app;
