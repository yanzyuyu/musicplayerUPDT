import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import yt from "youtube-search-api";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const spotifyUrlInfo = require("spotify-url-info");
const ytdl = require("@distube/ytdl-core");
const { getDetails, getTracks } = spotifyUrlInfo(fetch);

const app = express();
app.use(express.json());

// YouTube Search (NPM youtube-search-api)
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    const results = await yt.GetListByKeyword(query, false, 20);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "YouTube search failed" });
  }
});

// YouTube Download (Pakai NPM @distube/ytdl-core dengan Android Spoofing)
app.get("/api/download/youtube", async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).json({ error: "URL is required" });

    // Mencoba pakai NPM ytdl dengan spoofing User-Agent Android
    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: {
        headers: {
          'User-Agent': 'com.google.android.youtube/19.05.36 (Linux; U; Android 11; en_US; Pixel 4) gzip',
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': '19.05.36'
        }
      }
    });

    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'highestaudio', 
      filter: 'audioonly' 
    });

    if (format && format.url) {
      return res.json({
        status: "ok",
        title: info.videoDetails.title,
        link: format.url,
        duration: parseInt(info.videoDetails.lengthSeconds),
        thumbnail: info.videoDetails.thumbnails[0].url,
        user: info.videoDetails.author.name
      });
    }

    throw new Error("No format found");
  } catch (error: any) {
    console.error("YTDL Error:", error.message);
    
    // FALLBACK: Jika NPM ytdl diblokir YouTube, kita lempar ke Proxy yang lebih sakti
    // Saya perbaiki endpoint-nya agar tidak 404 lagi
    try {
      const response = await fetch(`https://api.siputzx.my.id/api/d/youtube?url=${encodeURIComponent(req.query.url as string)}`);
      const data = await response.json();
      const result = data.data || data;

      if (result && (result.url || result.link)) {
        return res.json({
          status: "ok",
          title: result.title || "YouTube Audio",
          link: result.url || result.link,
          duration: result.duration || 0,
          thumbnail: result.thumbnail || result.image || "",
          user: result.user || "YouTube Music"
        });
      }
    } catch (fallbackError) {
      console.error("Fallback failed too");
    }

    res.status(500).json({ error: "Gagal mengambil link download.", details: error.message });
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

export default app;
