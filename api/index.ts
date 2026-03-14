import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import ytSearchApi from "youtube-search-api";
import { createRequire } from "module";

// Force bundle untuk Vercel
import "yt-search";
import "cheerio";
import "axios";
import "form-data";

const require = createRequire(import.meta.url);
const spotifyUrlInfo = require("spotify-url-info");
const { getDetails, getTracks } = spotifyUrlInfo(fetch);

const app = express();
app.use(express.json());

// Helper Fetch dengan Timeout
const fetchWithTimeout = async (url: string, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// 3. YouTube Download (SUPER ROBUST - 4 LAYERS)
app.get("/api/download/youtube", async (req, res) => {
  const videoUrl = req.query.url as string;
  if (!videoUrl) return res.status(400).json({ error: "URL is required" });
  const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop();

  const sources = [
    {
      name: "Botcahx",
      url: `https://api.botcahx.eu.org/api/dowloader/ytmp3?url=${encodeURIComponent(videoUrl)}&apikey=yanzbotz`,
      parse: (d: any) => d.status && d.result ? { link: d.result.url || d.result.mp3, title: d.result.title } : null
    },
    {
      name: "Vreden",
      url: `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`,
      parse: (d: any) => d.status === 200 && d.result ? { link: d.result.download, title: d.result.title } : null
    },
    {
      name: "Agatz",
      url: `https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(videoUrl)}`,
      parse: (d: any) => (d.status === 200 || d.data) ? { link: d.data.mp3 || d.data.url, title: d.data.title } : null
    },
    {
      name: "DarkYasiya (Library)",
      type: "library",
      exec: async () => {
        const { ytmp3 } = require("@dark-yasiya/yt-dl.js");
        const d = await ytmp3(videoUrl);
        return (d && d.status && d.download) ? { link: d.download.url, title: d.result?.title } : null;
      }
    }
  ];

  for (const source of sources) {
    try {
      console.log(`Mencoba sumber: ${source.name}`);
      let result = null;
      
      if (source.type === "library") {
        result = await source.exec!();
      } else {
        const response = await fetchWithTimeout(source.url!);
        const data = await response.json();
        result = source.parse!(data);
      }

      if (result && result.link) {
        return res.json({ 
          status: "ok", 
          title: result.title || "YouTube Audio", 
          link: result.link, 
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, 
          user: "SoundStream" 
        });
      }
    } catch (e: any) {
      console.error(`Sumber ${source.name} gagal: ${e.message}`);
    }
  }

  res.status(500).json({ error: "Semua jalur download sedang macet. YouTube sedang memperketat keamanan. Coba lagi nanti." });
});

// ... (Sisa API lainnya tetap sama)
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
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    const musicOnlyQuery = `${query} music official`;
    const results = await ytSearchApi.GetListByKeyword(musicOnlyQuery, false, 20);
    res.json(results);
  } catch (error) { res.status(500).json({ error: "YouTube search failed" }); }
});
app.get("/api/spotify/playlist", async (req, res) => {
  try {
    const url = req.query.url as string;
    const tracks = await getTracks(url);
    const details = await getDetails(url);
    const mapped = tracks.map((t: any) => ({
      title: t.name || t.title,
      artist: t.artists?.map((a:any) => a.name).join(", ") || "",
      thumbnail: t.album?.images?.[0]?.url || details.preview?.image || "",
      duration: Math.floor(t.duration_ms / 1000)
    }));
    res.json({ name: details.preview?.title || "Spotify Playlist", artwork_url: details.preview?.image || "", tracks: mapped });
  } catch (error) { res.status(500).json({ error: "Spotify fetch failed" }); }
});
app.get("/api/spotify/trending", async (req, res) => {
  try {
    const results = await ytSearchApi.GetListByKeyword("Spotify Top Hits Indonesia 2024 official music", false, 25);
    const mapped = (results.items || []).map((t: any) => ({
      title: t.title, artist: t.channelTitle || "YouTube Music", thumbnail: t.thumbnail?.thumbnails?.[0]?.url || "",
      permalink_url: `https://www.youtube.com/watch?v=${t.id}`, id: t.id
    }));
    res.json(mapped);
  } catch (error) { res.status(500).json({ error: "Failed" }); }
});
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