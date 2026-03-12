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

// 1. YouTube Search (Aman Pakai NPM)
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    const results = await yt.GetListByKeyword(query, false, 20);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "YouTube search failed" });
  }
});

// 2. YouTube Download (Gateway API - Solusi Anti-Blokir Vercel)
app.get("/api/download/youtube", async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).json({ error: "URL is required" });

    // Menggunakan Engine API yang stabil & punya proxy anti-bot
    const response = await fetch(`https://api.vreden.my.id/api/videodl?url=${encodeURIComponent(videoUrl)}`);
    const data = await response.json();

    if (data.status && data.result) {
      const audio = data.result.mp3 || data.result.audio;
      res.json({
        status: "ok",
        title: data.result.title || "YouTube Music",
        link: audio,
        duration: 0,
        thumbnail: data.result.thumbnail || "",
        user: "YouTube Music"
      });
    } else {
      // Fallback ke Siputzx jika Vreden gagal
      const resFallback = await fetch(`https://api.siputzx.my.id/api/d/youtube?url=${encodeURIComponent(videoUrl)}`);
      const dataFallback = await resFallback.json();
      const result = dataFallback.data || dataFallback;

      if (result && (result.url || result.link)) {
        res.json({
          status: "ok",
          title: result.title || "YouTube Audio",
          link: result.url || result.link,
          duration: result.duration || 0,
          thumbnail: result.thumbnail || result.image || "",
          user: result.user || "YouTube Music"
        });
      } else {
        throw new Error("Semua engine download sedang sibuk.");
      }
    }
  } catch (error: any) {
    console.error("Download Error:", error.message);
    res.status(500).json({ error: "Gagal mengambil link download.", details: error.message });
  }
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

export default app;
