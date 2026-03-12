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

// Helper untuk mengambil nama artis dari berbagai kemungkinan struktur Spotify
const getArtistName = (track: any) => {
  if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
    return track.artists.map((a: any) => a.name).join(", ");
  }
  if (track.artist) return track.artist;
  if (track.artists && typeof track.artists === 'string') return track.artists;
  return "Unknown Artist";
};

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

// YouTube Download (RapidAPI)
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

// Spotify Playlist Info (DIOPTIMASI)
app.get("/api/spotify/playlist", async (req, res) => {
  try {
    const url = req.query.url as string;
    const tracks = await getTracks(url);
    const playlistDetails = await getDetails(url);

    const mappedTracks = tracks.map((track: any) => {
      // Coba ambil nama artis dengan lebih teliti
      const artist = getArtistName(track);
      
      // Ambil thumbnail (biasanya ada di album.images atau coverArt)
      const thumbnail = track.album?.images?.[0]?.url || 
                        track.coverArt?.sources?.[0]?.url || 
                        playlistDetails.preview?.image || "";

      return {
        title: track.name || track.title,
        artist: artist,
        thumbnail: thumbnail,
        duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : 0
      };
    });

    res.json({ 
      name: playlistDetails.preview?.title || "Spotify Playlist", 
      artwork_url: playlistDetails.preview?.image || "", 
      tracks: mappedTracks 
    });
  } catch (error) {
    console.error("Spotify Error:", error);
    res.status(500).json({ error: "Spotify fetch failed" });
  }
});

// SoundCloud/External Search & Download (Proxy)
app.get("/api/search/soundcloud", async (req, res) => {
  try {
    const response = await fetch(`https://api.siputzx.my.id/api/s/soundcloud?query=${encodeURIComponent(req.query.query as string)}`);
    res.json(await response.json());
  } catch (e) { res.status(500).json({error: "Failed"}); }
});

app.get("/api/download/external", async (req, res) => {
  try {
    const type = req.query.url?.toString().includes('spotify') ? 'spotify' : 'soundcloud';
    const response = await fetch(`https://api.siputzx.my.id/api/d/${type}?url=${encodeURIComponent(req.query.url as string)}`);
    res.json(await response.json());
  } catch (e) { res.status(500).json({error: "Failed"}); }
});

// History API
const getDb = () => {
  const Database = require("better-sqlite3");
  const db = new Database(process.env.VERCEL ? ':memory:' : 'history.db');
  db.exec(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, permalink_url TEXT, thumbnail TEXT, duration INTEGER, user TEXT, description TEXT, played_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  return db;
};

app.get("/api/history", (req, res) => {
  try { res.json(getDb().prepare('SELECT * FROM history ORDER BY played_at DESC LIMIT 50').all()); }
  catch (e) { res.json([]); }
});

app.post("/api/history", (req, res) => {
  try {
    const { title, url, permalink_url, thumbnail, duration, user, description } = req.body;
    getDb().prepare('INSERT INTO history (title, url, permalink_url, thumbnail, duration, user, description) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, url, permalink_url, thumbnail, duration, user, description);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Save failed" }); }
});

app.delete("/api/history", (req, res) => {
  try { getDb().prepare('DELETE FROM history').run(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: "Delete failed" }); }
});

export default app;
