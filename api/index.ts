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

// 1. YouTube Search (NPM)
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    const results = await yt.GetListByKeyword(query, false, 20);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "YouTube search failed" });
  }
});

// 2. YouTube Download (Diarahkan ke RapidAPI via Backend)
app.get("/api/download/youtube", async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).json({ error: "URL is required" });

    // Ekstrak Video ID
    const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop();
    
    if (!videoId) throw new Error("Invalid YouTube URL");

    const response = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY || 'de35706886msh5b5e7598b2a83ebp1c7f95jsn29054b6da879',
        'x-rapidapi-host': 'youtube-mp36.p.rapidapi.com'
      }
    });

    const data = await response.json();

    if (data && data.status === 'ok') {
      res.json({
        status: "ok",
        title: data.title,
        link: data.link,
        duration: data.duration || 0,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        user: "YouTube Music"
      });
    } else {
      throw new Error(data.msg || "RapidAPI failed to process video");
    }
  } catch (error: any) {
    console.error("RapidAPI Download Error:", error.message);
    res.status(500).json({ error: "Gagal mengambil link download.", details: error.message });
  }
});

// 3. SoundCloud/Spotify Download (Proxy)
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

// 6. History API (SQLite in-memory for Vercel)
app.get("/api/history", async (req, res) => {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, permalink_url TEXT, thumbnail TEXT, duration INTEGER, user TEXT, description TEXT, played_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    const rows = db.prepare('SELECT * FROM history ORDER BY played_at DESC LIMIT 50').all();
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

export default app;
