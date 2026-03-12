import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fetch from "node-fetch";
import "dotenv/config";
import yt from "youtube-search-api";
import spotifyUrlInfo from "spotify-url-info";

const { getDetails, getTracks } = spotifyUrlInfo(fetch);

// Inisialisasi Database secara aman untuk Vercel
let db: any = null;
const isVercel = process.env.VERCEL === '1';

async function initDb() {
  if (db) return db;
  try {
    const Database = (await import("better-sqlite3")).default;
    // Di Vercel, gunakan folder /tmp yang diizinkan untuk menulis, 
    // atau gunakan :memory: agar tidak crash
    const dbPath = isVercel ? ':memory:' : 'history.db';
    db = new Database(dbPath);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        permalink_url TEXT,
        thumbnail TEXT,
        duration INTEGER,
        user TEXT,
        description TEXT,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log(`Database initialized at ${dbPath}`);
    return db;
  } catch (e) {
    console.error("Database initialization failed, history features will be disabled:", e);
    return null;
  }
}

const app = express();
app.use(express.json());

// API routes
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    if (!query) return res.status(400).json({ error: "Query is required" });
    
    // Gunakan youtube-search-api
    const results = await yt.GetListByKeyword(query, false, 20);
    res.json(results);
  } catch (error) {
    console.error("YouTube search error:", error);
    res.status(500).json({ error: "Failed to fetch from YouTube", details: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/spotify/playlist", async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const tracks = await getTracks(url);
    const playlistDetails = await getDetails(url);

    const mappedTracks = tracks.map(track => ({
      title: track.name,
      artist: track.artists?.map(a => a.name).join(", ") || "Unknown Artist",
      thumbnail: track.album?.images?.[0]?.url || "",
      duration: Math.floor(track.duration_ms / 1000)
    }));

    res.json({
      name: playlistDetails.preview.title || "Spotify Playlist",
      artwork_url: playlistDetails.preview.image || "",
      tracks: mappedTracks
    });
  } catch (error) {
    console.error("Spotify playlist error:", error);
    res.status(500).json({ error: "Failed to fetch Spotify playlist. Make sure it is public." });
  }
});

app.get("/api/history", async (req, res) => {
  try {
    const database = await initDb();
    if (!database) return res.json([]);
    const history = database.prepare('SELECT * FROM history ORDER BY played_at DESC LIMIT 50').all();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.post("/api/history", async (req, res) => {
  try {
    const database = await initDb();
    if (!database) return res.json({ success: false, message: "Database disabled" });
    
    const { title, url, permalink_url, thumbnail, duration, user, description } = req.body;
    const stmt = database.prepare('INSERT INTO history (title, url, permalink_url, thumbnail, duration, user, description) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(title, url, permalink_url, thumbnail, duration, user, description);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: "Failed to save history" });
  }
});

// Start logic (hanya untuk lokal)
if (!isVercel) {
  const PORT = 3000;
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then(vite => {
    app.use(vite.middlewares);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

// Export for Vercel
export default app;
