import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import yt from "youtube-search-api";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const spotifyUrlInfo = require("spotify-url-info");
const { getDetails, getTracks } = spotifyUrlInfo(fetch);

let db: any = null;
const isVercel = process.env.VERCEL === '1';

async function initDb() {
  if (db) return db;
  try {
    const Database = require("better-sqlite3");
    const dbPath = isVercel ? ':memory:' : 'history.db';
    db = new Database(dbPath);
    db.exec(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, permalink_url TEXT, thumbnail TEXT, duration INTEGER, user TEXT, description TEXT, played_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    return db;
  } catch (e) {
    return null;
  }
}

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

// 2. YouTube Download (Proxy)
app.get("/api/download/youtube", async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).json({ error: "URL is required" });

    const response = await fetch(`https://api.siputzx.my.id/api/d/youtube?url=${encodeURIComponent(videoUrl)}`);
    const data = await response.json();

    // Siputzx kadang mengembalikan data di data.data atau langsung di data
    const result = data.data || data;

    if (result && (result.url || result.link)) {
      res.json({
        status: "ok",
        title: result.title || "Unknown Title",
        link: result.url || result.link,
        duration: result.duration || 0,
        thumbnail: result.thumbnail || result.image || "",
        user: result.user || "YouTube Music"
      });
    } else {
      console.error("Siputzx Response:", JSON.stringify(data));
      throw new Error("Invalid response structure from proxy");
    }
  } catch (error: any) {
    console.error("Internal Download Error:", error.message);
    res.status(500).json({ error: "Gagal mengambil link download.", details: error.message });
  }
});

// 3. Spotify/SoundCloud Download (Proxy)
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

// 4. SoundCloud Search (Proxy)
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

// 6. History API ( SQLite)
app.get("/api/history", async (req, res) => {
  const database = await initDb();
  if (!database) return res.json([]);
  try {
    const rows = database.prepare('SELECT * FROM history ORDER BY played_at DESC LIMIT 50').all();
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

app.post("/api/history", async (req, res) => {
  const database = await initDb();
  if (!database) return res.json({ success: false });
  try {
    const { title, url, permalink_url, thumbnail, duration, user, description } = req.body;
    database.prepare('INSERT INTO history (title, url, permalink_url, thumbnail, duration, user, description) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, url, permalink_url, thumbnail, duration, user, description);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Save history failed" });
  }
});

app.delete("/api/history", async (req, res) => {
  const database = await initDb();
  if (!database) return res.json({ success: false });
  try {
    database.prepare('DELETE FROM history').run();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Clear history failed" });
  }
});

export default app;
