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

// 2. YouTube Download (Triple Engine Gateway)
app.get("/api/download/youtube", async (req, res) => {
  const videoUrl = req.query.url as string;
  if (!videoUrl) return res.status(400).json({ error: "URL is required" });

  // Engine 1: BTCH (Sangat Stabil)
  try {
    const res1 = await fetch(`https://api.btch.rf.gd/api/download/ytmp3?url=${encodeURIComponent(videoUrl)}`);
    const data1 = await res1.json();
    if (data1.status && data1.result && data1.result.url) {
      return res.json({
        status: "ok",
        title: data1.result.title || "YouTube Music",
        link: data1.result.url,
        thumbnail: data1.result.thumb || "",
        user: "YouTube Music"
      });
    }
  } catch (e) {}

  // Engine 2: Vreden
  try {
    const res2 = await fetch(`https://api.vreden.my.id/api/videodl?url=${encodeURIComponent(videoUrl)}`);
    const data2 = await res2.json();
    if (data2.status && data2.result) {
      return res.json({
        status: "ok",
        title: data2.result.title,
        link: data2.result.mp3 || data2.result.audio,
        thumbnail: data2.result.thumbnail || "",
        user: "YouTube Music"
      });
    }
  } catch (e) {}

  // Engine 3: Siputzx (Fallback terakhir)
  try {
    const res3 = await fetch(`https://api.siputzx.my.id/api/d/youtube?url=${encodeURIComponent(videoUrl)}`);
    const data3 = await res3.json();
    const result = data3.data || data3;
    if (result && (result.url || result.link)) {
      return res.json({
        status: "ok",
        title: result.title || "YouTube Audio",
        link: result.url || result.link,
        thumbnail: result.thumbnail || result.image || "",
        user: "YouTube Music"
      });
    }
  } catch (e) {}

  res.status(500).json({ error: "Maaf, semua server download sedang sibuk. Coba beberapa saat lagi." });
});

// 3. Spotify/SoundCloud Download
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

// 6. History API
app.get("/api/history", async (req, res) => {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(process.env.VERCEL ? ':memory:' : 'history.db');
    db.exec(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, permalink_url TEXT, thumbnail TEXT, duration INTEGER, user TEXT, description TEXT, played_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    const rows = db.prepare('SELECT * FROM history ORDER BY played_at DESC LIMIT 50').all();
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

app.post("/api/history", async (req, res) => {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(process.env.VERCEL ? ':memory:' : 'history.db');
    db.exec(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, permalink_url TEXT, thumbnail TEXT, duration INTEGER, user TEXT, description TEXT, played_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    const { title, url, permalink_url, thumbnail, duration, user, description } = req.body;
    db.prepare('INSERT INTO history (title, url, permalink_url, thumbnail, duration, user, description) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, url, permalink_url, thumbnail, duration, user, description);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Save history failed" });
  }
});

export default app;
