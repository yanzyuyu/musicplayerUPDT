import fetch from "node-fetch";

async function findSpotifyLink() {
  const query = "Duka Last Child";
  console.log(`🔍 Mencari link Spotify untuk: ${query}`);

  // Kita coba beberapa provider pencarian publik yang memberikan link Spotify
  const searchEndpoints = [
    `https://api.maher-zubair.tech/search/spotify?q=${encodeURIComponent(query)}`,
    `https://api.siputzx.my.id/api/s/spotify?query=${encodeURIComponent(query)}`
  ];

  for (const url of searchEndpoints) {
    try {
      console.log(`Testing ${url}...`);
      const res = await fetch(url);
      const data: any = await res.json();

      if (data.status && data.data && data.data.length > 0) {
        console.log("✅ Berhasil menemukan hasil!");
        const firstResult = data.data[0];
        console.log("\n--- HASIL PENCARIAN ---");
        console.log("Judul:", firstResult.title || firstResult.name);
        console.log("Artist:", firstResult.artist || firstResult.artists?.[0]?.name);
        console.log("Link Spotify:", firstResult.url || firstResult.external_urls?.spotify);
        return;
      } else {
        console.log("❌ Tidak ada hasil atau API sedang error.");
      }
    } catch (e: any) {
      console.log("❌ Error:", e.message);
    }
    console.log("---");
  }
}

findSpotifyLink();
