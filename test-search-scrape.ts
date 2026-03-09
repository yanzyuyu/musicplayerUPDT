import fetch from "node-fetch";
import spotify from "spotify-url-info";

async function findAndGetSpotifyData() {
  const query = "Duka Last Child";
  const { getPreview } = spotify(fetch as any);

  console.log(`🔍 Mencari Link Spotify untuk: ${query} via Bing...`);
  
  try {
    // 1. Cari di Bing: site:open.spotify.com "Duka Last Child"
    const searchUrl = `https://www.bing.com/search?q=site%3Aopen.spotify.com+%22${encodeURIComponent(query)}%22`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const html = await res.text();
    
    // 2. Extract link Spotify dari HTML (mencari pola https://open.spotify.com/track/xxxx)
    const match = html.match(/https:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/);

    if (match && match[0]) {
      const spotifyUrl = match[0];
      console.log(`✅ Link Spotify ditemukan: ${spotifyUrl}`);

      // 3. Ambil data detail menggunakan spotify-url-info
      console.log("🚀 Mengambil metadata lengkap...");
      const preview = await getPreview(spotifyUrl);
      
      console.log("\n--- HASIL AKHIR ---");
      console.log("Judul:", preview.title);
      console.log("Artist:", preview.artist);
      console.log("Cover:", preview.image);
      console.log("Link MP3 (30s):", preview.audio);
      console.log("Link Asli:", preview.link);
      
    } else {
      console.log("❌ Gagal menemukan link Spotify di hasil pencarian Bing.");
    }
  } catch (e: any) {
    console.log("❌ Error:", e.message);
  }
}

findAndGetSpotifyData();
