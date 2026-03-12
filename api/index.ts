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

// 1. Metadata Search (Tantangan: Cari tahu lagu siapa saja ini)
app.get("/api/search/metadata", async (req, res) => {
  try {
    const query = req.query.query as string;
    if (!query) return res.status(400).json({ error: "Query is required" });

    // Menggunakan iTunes Search API (Gratis, Akurat, No Key)
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`);
    const data = await response.json();

    // Mengelompokkan berdasarkan Judul & Artis yang unik
    const suggestions = data.results.map((item: any) => ({
      title: item.trackName,
      artist: item.artistName,
      artwork: item.artworkUrl100.replace('100x100bb', '600x600bb'),
      album: item.collectionName
    }));

    // Filter duplikat (artis yang sama untuk lagu yang sama)
    const uniqueSuggestions = suggestions.filter((v:any, i:any, a:any) => 
      a.findIndex((t:any) => (t.artist === v.artist)) === i
    );

    res.json(uniqueSuggestions);
  } catch (error) {
    res.status(500).json({ error: "Metadata search failed" });
  }
});

// 2. YouTube Search (Tetap ada untuk tahap kedua)
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    const musicOnlyQuery = `${query} music official`;
    const results = await yt.GetListByKeyword(musicOnlyQuery, false, 20);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "YouTube search failed" });
  }
});

// (Sisanya: Trending, Download, Playlist, History tetap sama)
app.get("/api/spotify/trending", async (req, res) => {
  try {
    const results = await yt.GetListByKeyword("Spotify Top Hits Indonesia 2024 official music", false, 20);
    const mapped = (results.items || []).map((t: any) => ({
      title: t.title, artist: t.channelTitle || "YouTube Music", thumbnail: t.thumbnail?.thumbnails?.[0]?.url || "",
      permalink_url: `https://www.youtube.com/watch?v=${t.id}`, id: t.id
    }));
    res.json(mapped);
  } catch (error) { res.status(500).json({ error: "Failed" }); }
});

app.get("/api/download/youtube", async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop();
    const response = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
      headers: { 'x-rapidapi-key': process.env.RAPIDAPI_KEY || 'de35706886msh5b5e7598b2a83ebp1c7f95jsn29054b6da879', 'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com' }
    });
    const data = await response.json();
    if (data.status === 'ok') res.json({ status: "ok", title: data.title, link: data.link, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` });
    else throw new Error("Failed");
  } catch (error: any) { res.status(500).json({ error: "Failed" }); }
});

app.get("/api/spotify/playlist", async (req, res) => {
  try {
    const url = req.query.url as string;
    const tracks = await getTracks(url);
    const details = await getDetails(url);
    const mapped = tracks.map((t: any) => ({ title: t.name, artist: t.artists?.map((a:any)=>a.name).join(", ") || "Unknown", thumbnail: t.album?.images?.[0]?.url || "", duration: Math.floor(t.duration_ms / 1000) }));
    res.json({ name: details.preview?.title, artwork_url: details.preview?.image, tracks: mapped });
  } catch (error) { res.status(500).json({ error: "Failed" }); }
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
