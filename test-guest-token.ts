import fetch from "node-fetch";

async function getGuestToken() {
  console.log("🚀 Mengambil Guest Token dari Spotify Web Player...");
  try {
    // Spotify Web Player menggunakan endpoint ini untuk mendapatkan token sementara
    const res = await fetch("https://open.spotify.com/get_access_token?reason=transport&productType=web_player", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://open.spotify.com/search"
      }
    });

    const data: any = await res.json();
    if (data.accessToken) {
      console.log("✅ Berhasil mendapatkan Access Token!");
      return data.accessToken;
    } else {
      console.log("❌ Gagal mendapatkan token:", data);
      return null;
    }
  } catch (e: any) {
    console.log("❌ Error saat ambil token:", e.message);
    return null;
  }
}

async function searchWithGuestToken() {
  const token = await getGuestToken();
  if (!token) return;

  const query = "Duka Last Child";
  console.log(`🔍 Mencari lagu "${query}" menggunakan Guest Token...`);

  try {
    const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data: any = await res.json();
    if (data.tracks && data.tracks.items.length > 0) {
      console.log("\n--- HASIL PENCARIAN (RESMI) ---");
      data.tracks.items.forEach((track: any, idx: number) => {
        console.log(`${idx + 1}. ${track.name} - ${track.artists.map((a: any) => a.name).join(", ")}`);
        console.log(`   Link: ${track.external_urls.spotify}`);
      });
    } else {
      console.log("❌ Tidak ada hasil pencarian.");
      console.log("Response:", JSON.stringify(data, null, 2));
    }
  } catch (e: any) {
    console.log("❌ Error saat search:", e.message);
  }
}

searchWithGuestToken();
