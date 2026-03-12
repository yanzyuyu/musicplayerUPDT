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

// 1. YouTube Search (Tetap Pakai youtube-search-api - Masih Aman)
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    const results = await yt.GetListByKeyword(query, false, 20);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "YouTube search failed" });
  }
});

// 2. YouTube Download (Diarahkan ke Proxy Handal di Backend)
app.get("/api/download/youtube", async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).json({ error: "URL is required" });

    // Kita gunakan Siputzx sebagai proxy di backend agar tidak terkena blokir bot YouTube di Vercel
    // Ini rahasia dapur backend, frontend tidak akan tahu.
    const response = await fetch(`https://api.siputzx.my.id/api/d/youtube?url=${encodeURIComponent(videoUrl)}`);
    const data = await response.json();

    if (data.status && data.data) {
      res.json({
        status: "ok",
        title: data.data.title,
        link: data.data.url || data.data.link,
        duration: data.data.duration || 0,
        thumbnail: data.data.thumbnail || data.data.image,
        user: data.data.user || "YouTube Music"
      });
    } else {
      throw new Error("Failed to get link from internal proxy");
    }
  } catch (error: any) {
    console.error("Internal Download Error:", error.message);
    res.status(500).json({ error: "Gagal mengambil link download via server." });
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

export default app;
