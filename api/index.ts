import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import yt from "youtube-search-api";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);
const spotifyUrlInfo = require("spotify-url-info");
const ytdl = require("@distube/ytdl-core");
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

// YouTube Search
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    const results = await yt.GetListByKeyword(query, false, 20);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "YouTube search failed" });
  }
});

// SoundCloud Search
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

// YouTube Download (Dengan Error Logging yang lebih baik)
app.get("/api/download/youtube", async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).json({ error: "URL is required" });

    // Coba ambil info video
    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      }
    });

    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'highestaudio', 
      filter: 'audioonly' 
    });

    if (!format || !format.url) {
      throw new Error("No suitable audio format found");
    }

    res.json({
      status: "ok",
      title: info.videoDetails.title,
      link: format.url,
      duration: parseInt(info.videoDetails.lengthSeconds),
      thumbnail: info.videoDetails.thumbnails[0].url,
      user: info.videoDetails.author.name
    });
  } catch (error: any) {
    console.error("YTDL Error:", error.message);
    
    // Jika Vercel diblokir YouTube, berikan pesan yang lebih jelas
    if (error.message.includes('confirm you’re not a bot') || error.message.includes('403')) {
      return res.status(500).json({ 
        error: "YouTube memblokir request dari server (Bot Detection).", 
        details: "Server Vercel sering terkena rate limit YouTube. Coba lagi nanti atau gunakan link lain.",
        type: "BOT_DETECTION"
      });
    }

    res.status(500).json({ 
      error: "Gagal mengambil link download.", 
      message: error.message 
    });
  }
});

// SoundCloud/Spotify Download
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

// Spotify Playlist Info
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

// History API
app.get("/api/history", async (req, res) => {
  const database = await initDb();
  if (!database) return res.json([]);
  res.json(database.prepare('SELECT * FROM history ORDER BY played_at DESC LIMIT 50').all());
});

app.post("/api/history", async (req, res) => {
  const database = await initDb();
  if (!database) return res.json({ success: false });
  const { title, url, permalink_url, thumbnail, duration, user, description } = req.body;
  database.prepare('INSERT INTO history (title, url, permalink_url, thumbnail, duration, user, description) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, url, permalink_url, thumbnail, duration, user, description);
  res.json({ success: true });
});

export default app;
