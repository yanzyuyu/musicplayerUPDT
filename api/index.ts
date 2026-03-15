import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import ytSearchApi from "youtube-search-api";
import { createRequire } from "module";
import ytdl from "@distube/ytdl-core";

const require = createRequire(import.meta.url);
const spotifyUrlInfo = require("spotify-url-info");
const { getDetails, getTracks } = spotifyUrlInfo(fetch);

const app = express();
app.use(express.json());

// Cookies yang Anda berikan (Hardcoded as fallback)
const DEFAULT_COOKIES = [{"domain":".youtube.com","expirationDate":1792988950.767228,"hostOnly":false,"httpOnly":true,"name":"LOGIN_INFO","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"AFmmF2swRQIgPS3tWSAREOck0POuMywnX19AcHmBcTvepOxrFOkz_J4CIQDPoHunHUrIvuMLREh4Y8OeIZQH7dxn425PVXL6k2cz_Q:QUQ3MjNmeHdGRldtX3dnTEZjQlphdjBJN1VJUkp4TFV3OVdEa2RQRHhZSVFzTlZIQm5pNGk5Qkx1N0drMU5VMk5CSnRDZkZGVjlEcTd1R0JrY0pMc2c0T0haOUZpUHJJOEdlcEhhUlV5TmRNVEp3Tlhsc0hrV0RsTHZWNFB6QXY1TGN5ODVycG9WZk9Vb0tOTy1fejAtSXdXVWJETENzRkVn"},{"domain":".youtube.com","expirationDate":1791641058.644713,"hostOnly":false,"httpOnly":true,"name":"__Secure-1PSIDTS","path":"/","sameSite":"unspecified","secure":true,"session":false,"storeId":"0","value":"sidts-CjQBmkD5S4w47WITAXJhrp3F61EKcvI2lYIW2lHtewEpoLqASOHkgzcPQod1whJfew_Aef-LEAA"},{"domain":".youtube.com","expirationDate":1791641058.645,"hostOnly":false,"httpOnly":true,"name":"__Secure-3PSIDTS","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"sidts-CjQBmkD5S4w47WITAXJhrp3F61EKcvI2lYIW2lHtewEpoLqASOHkgzcPQod1whJfew_Aef-LEAA"},{"domain":".youtube.com","expirationDate":1806748794.894248,"hostOnly":false,"httpOnly":true,"name":"HSID","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"Awr_kE6WI5bThDwVS"},{"domain":".youtube.com","expirationDate":1806748794.894395,"hostOnly":false,"httpOnly":true,"name":"SSID","path":"/","sameSite":"unspecified","secure":true,"session":false,"storeId":"0","value":"AMrHRK7HmyZ1z1F2s"},{"domain":".youtube.com","expirationDate":1806748794.894465,"hostOnly":false,"httpOnly":false,"name":"APISID","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"a9UA-OrTLxhDMh4e/A4Kr1aeweU9KMhLcQ"},{"domain":".youtube.com","expirationDate":1806748794.894546,"hostOnly":false,"httpOnly":false,"name":"SAPISID","path":"/","sameSite":"unspecified","secure":true,"session":false,"storeId":"0","value":"nASl22Zbi2aNfs-s/AnI5fSXlievSILYzq"},{"domain":".youtube.com","expirationDate":1806748794.894611,"hostOnly":false,"httpOnly":false,"name":"__Secure-1PAPISID","path":"/","sameSite":"unspecified","secure":true,"session":false,"storeId":"0","value":"nASl22Zbi2aNfs-s/AnI5fSXlievSILYzq"},{"domain":".youtube.com","expirationDate":1806748794.894681,"hostOnly":false,"httpOnly":false,"name":"__Secure-3PAPISID","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"nASl22Zbi2aNfs-s/AnI5fSXlievSILYzq"},{"domain":".youtube.com","expirationDate":1778204268.024667,"hostOnly":false,"httpOnly":true,"name":"NID","path":"/","sameSite":"unspecified","secure":true,"session":false,"storeId":"0","value":"526=s_n1CdyoUOJrt-YXWnlW4VY5OLjMXBQFv0huAZ40XcL4G6fLlmfQJ4fAseiyGcUTh9JjFaYcM07_CCwmvvU5CdgI_GbQQR8bAZzSUmxj4rUIMdWBLsTXCL8udp7uyyxgH4oQkjbbtwezxRQtQzY0bz2kJuj8Tv4ef7vQ_4bN_TriTu-n_HxIxuFxCLGyJY2IfWCjgSFJsm7a9Jf1T7k2-DQgN1c"},{"domain":".youtube.com","expirationDate":1806748794.895109,"hostOnly":false,"httpOnly":false,"name":"SID","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"g.a0007Qg4kGyGTfQiPCXx-Talp7wEp7r_VLb6qNWtiw9kM9Qa1ezvzEz-SYZc6Ng8wfSDk1tcxAACgYKAS8SARESFQHGX2Mi_JK5cVuB4n3lf3gpR14AURoVAUF8yKqKyglL2OiNx8yRdL9KXJFe0076"},{"domain":".youtube.com","expirationDate":1806748794.895189,"hostOnly":false,"httpOnly":true,"name":"__Secure-1PSID","path":"/","sameSite":"unspecified","secure":true,"session":false,"storeId":"0","value":"g.a0007Qg4kGyGTfQiPCXx-Talp7wEp7r_VLb6qNWtiw9kM9Qa1ezv6746XW0LpTIMdtSHzzyy_QACgYKAbQSARESFQHGX2MieWZsPdnBY3Lpy069ogcGNBoVAUF8yKqnW8xwM5YI-wtjJ4CMGO9I0076"},{"domain":".youtube.com","expirationDate":1806748794.89526,"hostOnly":false,"httpOnly":true,"name":"__Secure-3PSID","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"g.a0007Qg4kGyGTfQiPCXx-Talp7wEp7r_VLb6qNWtiw9kM9Qa1ezvtB6VUZ9wnFRLmQaCpGngZQACgYKAYMSARESFQHGX2Mi73tfXuYYxuSUu217hPxfQRoVAUF8yKofB6g_flJVYx1vsojI4XKp0076"},{"domain":".youtube.com","expirationDate":1808102783.065043,"hostOnly":false,"httpOnly":false,"name":"PREF","path":"/","sameSite":"unspecified","secure":true,"session":false,"storeId":"0","value":"f4=4000000&f6=40000000&tz=Asia.Jakarta&f7=150&f5=20000"},{"domain":".youtube.com","expirationDate":1805078789.292374,"hostOnly":false,"httpOnly":false,"name":"SIDCC","path":"/","sameSite":"unspecified","secure":false,"session":false,"storeId":"0","value":"AKEyXzUyOgI11TrkdX-J2Q9hup86lf_nGKLbxtGStesGAAn3BM0Ux2Stb1iXgHs-DAEOff9RYQ"},{"domain":".youtube.com","expirationDate":1805078789.292508,"hostOnly":false,"httpOnly":true,"name":"__Secure-1PSIDCC","path":"/","sameSite":"unspecified","secure":true,"session":false,"storeId":"0","value":"AKEyXzUHn_IXsEZpfYfsXttSgOg5xepjWfLKf6rGqeFLqb9CfGXqEcXpvxjlkghva2Hn87IBm8A"},{"domain":".youtube.com","expirationDate":1805078789.292625,"hostOnly":false,"httpOnly":true,"name":"__Secure-3PSIDCC","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"AKEyXzXsYaGDQuz6CkbneUZc-e1HEfpFABNoLVqRFholhlqVpi-hbDXOyK25sJp2BJtWgVn2mXM"},{"domain":".youtube.com","expirationDate":1789094789.291877,"hostOnly":false,"httpOnly":true,"name":"VISITOR_INFO1_LIVE","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"KHt_pJm4dCU"},{"domain":".youtube.com","expirationDate":1789094789.29212,"hostOnly":false,"httpOnly":true,"name":"VISITOR_PRIVACY_METADATA","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"CgJJRBIEGgAgbQ%3D%3D"},{"domain":".youtube.com","expirationDate":1789094777.706383,"hostOnly":false,"httpOnly":true,"name":"__Secure-YNID","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"16.YT=ZHJhPrepoEduo0saPaoq8QnT0ktj46yCE2xnCHmQnqJnyu7VsErnz0HD2P0xVi9b0Zj7KSJmdHodivf5BRMciT3JhjKtZwaAHrLzWP9oOT-49KYEdp91brsvAJpS7zL18shKEentQgAo0WJqytXlI5nIJLswx0kbGsPG3PZbyz3Ty3zeBn6jlv567ph_hy_l6265IRHu3E2UPT8t-PM-Z6Wk4vts2r_YkkXgRA8niVzBAK6b7sp57y-OtzO15h5iUdkJJidf8qO5rzaYja072SQxr0bGHO5NG81eIqw708AQpwzn8oap945mcb6TNwy0ySN4XgMhbjnWbcgZg89dGw"},{"domain":".youtube.com","hostOnly":false,"httpOnly":true,"name":"YSC","path":"/","sameSite":"no_restriction","secure":true,"session":true,"storeId":"0","value":"C5O70q9Kboo"},{"domain":".youtube.com","expirationDate":1789094777.710016,"hostOnly":false,"httpOnly":true,"name":"__Secure-ROLLOUT_TOKEN","path":"/","sameSite":"no_restriction","secure":true,"session":false,"storeId":"0","value":"CPf4wJ2gwe3nTBDN5IamgumPAxjx9vrZ8aCTAw%3D%3D"}];

// Helper Artist
const getArtistName = (track: any) => {
  try {
    if (track.artists && Array.isArray(track.artists) && track.artists.length > 0) {
      return track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(", ");
    }
    if (track.artist) return typeof track.artist === 'string' ? track.artist : track.artist.name;
    if (track.track?.artists) return track.track.artists.map((a: any) => a.name).join(", ");
  } catch (e) {}
  return "";
};

// 1. Metadata Search
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

// 2. YouTube Search
app.get("/api/search/youtube", async (req, res) => {
  try {
    const query = req.query.query as string;
    const musicOnlyQuery = `${query} music official`;
    const results = await ytSearchApi.GetListByKeyword(musicOnlyQuery, false, 20);
    res.json(results);
  } catch (error) { res.status(500).json({ error: "YouTube search failed" }); }
});

// 3. YouTube Download (SUPER STABLE - Hardcoded Cookies)
app.get("/api/download/youtube", async (req, res) => {
  try {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).json({ error: "URL is required" });
    const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('/').pop();

    // Gunakan Cookies JSON yang diberikan user
    const agent = ytdl.createAgent(DEFAULT_COOKIES);
    console.log("Agent diinisialisasi dengan hardcoded cookies");

    const info = await ytdl.getInfo(videoUrl, { agent } as any);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });

    if (format && format.url) {
      return res.json({ 
        status: "ok", 
        title: info.videoDetails.title, 
        link: format.url, 
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, 
        user: "YouTube Music" 
      });
    }

    throw new Error("Format audio tidak ditemukan");
  } catch (error: any) {
    console.error("YTDL Error:", error.message);
    res.status(500).json({ 
      error: "Download failed", 
      message: error.message,
      tip: "Cookies mungkin sudah expired. Silakan berikan JSON cookies baru."
    });
  }
});

// 4. Spotify Playlist Info
app.get("/api/spotify/playlist", async (req, res) => {
  try {
    const url = req.query.url as string;
    const tracks = await getTracks(url);
    const details = await getDetails(url);
    const mapped = tracks.map((t: any) => ({
      title: t.name || t.title,
      artist: getArtistName(t),
      thumbnail: t.album?.images?.[0]?.url || details.preview?.image || "",
      duration: Math.floor(t.duration_ms / 1000)
    }));
    res.json({ name: details.preview?.title || "Spotify Playlist", artwork_url: details.preview?.image || "", tracks: mapped });
  } catch (error) { res.status(500).json({ error: "Spotify fetch failed" }); }
});

// 5. Spotify Trending
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

// 6. External & History
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