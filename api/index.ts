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

// Database helper (In-memory for Vercel, File for Local)
const getDb = () => {
  const Database = require("better-sqlite3");
  const db = new Database(process.env.VERCEL ? ':memory:' : 'history.db');
  db.exec(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    title TEXT NOT NULL, 
    url TEXT NOT NULL, 
    permalink_url TEXT, 
    thumbnail TEXT, 
    duration INTEGER, 
    user TEXT, 
    description TEXT, 
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  return db;
};

// 1. YouTube Search
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    const results = await yt.GetListByKeyword(query, false, 20);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "YouTube search failed" });
  }
});

// 2. YouTube Download (RapidAPI)
app.get("/api/download/youtube", async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).json({ error: "URL is required" });
    const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop();
    
    const response = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY || 'de35706886msh5b5e7598b2a83ebp1c7f95jsn29054b6da879',
        'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
      }
    });
    const data = await response.json();
    if (data.status === 'ok') {
      res.json({ status: "ok", title: data.title, link: data.link, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, user: "YouTube Music" });
    } else throw new Error(data.msg || "RapidAPI failed");
  } catch (error: any) {
    res.status(500).json({ error: "Gagal mengambil link download.", details: error.message });
  }
});

// 3. External (SoundCloud/Spotify) Download
app.get("/api/download/external", async (req, res) => {
  try {
    const url = req.query.url as string;
    const type = url.includes('spotify') ? 'spotify' : 'soundcloud';
    const response = await fetch(`https://api.siputzx.my.id/api/d/${type}?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "External download failed" });
  }
});

// 4. SoundCloud Search
app.get("/api/search/soundcloud", async (req, res) => {
  try {
    const query = req.query.query as string;
    const response = await fetch(`https://api.siputzx.my.id/api/s/soundcloud?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "SoundCloud search failed" });
  }
});

// 5. Spotify Playlist Info
app.get("/api/spotify/playlist", async (req, res) => {
  try {
    const url = req.query.url as string;
    const tracks = await getTracks(url);
    const playlistDetails = await getDetails(url);
    const mappedTracks = tracks.map((track: any) => ({
      title: track.name,
      artist: track.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
      thumbnail: track.album?.images?.[0]?.url || "",
      duration: Math.floor(track.duration_ms / 1000)
    }));
    res.json({ name: playlistDetails.preview.title, artwork_url: playlistDetails.preview.image, tracks: mappedTracks });
  } catch (error) {
    res.status(500).json({ error: "Spotify fetch failed" });
  }
});

// 6. History API (GET, POST, DELETE)
app.get("/api/history", (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM history ORDER BY played_at DESC LIMIT 50').all();
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

app.post("/api/history", (req, res) => {
  try {
    const db = getDb();
    const { title, url, permalink_url, thumbnail, duration, user, description } = req.body;
    db.prepare('INSERT INTO history (title, url, permalink_url, thumbnail, duration, user, description) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(title, url, permalink_url, thumbnail, duration, user, description);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Save failed" });
  }
});

app.delete("/api/history", (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM history').run();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Delete failed" });
  }
});

export default app;
