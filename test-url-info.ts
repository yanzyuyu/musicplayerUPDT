import fetch from "node-fetch";
import spotify from "spotify-url-info";

async function testFullData() {
  const { getPreview, getData } = spotify(fetch as any);

  const trackUrl = "https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8";
  console.log(`🚀 Mengambil data lengkap dari: ${trackUrl}`);

  try {
    // getPreview: Data ringkas (biasanya untuk UI cepat)
    const preview = await getPreview(trackUrl);
    console.log("\n--- PREVIEW DATA ---");
    console.log(JSON.stringify(preview, null, 2));

    // getData: Data sangat lengkap (mirip API resmi tapi lewat scraping)
    const data = await getData(trackUrl);
    console.log("\n--- FULL DATA (Keys Only) ---");
    console.log("Keys tersedia:", Object.keys(data));
    console.log("Lagu:", data.name);
    console.log("Link Spotify:", data.external_urls?.spotify); // Link asli lagu
    console.log("ID Lagu:", data.id);
    console.log("Preview MP3 (30s):", data.preview_url); // Biasanya ada jika Spotify menyediakan preview
    
  } catch (e: any) {
    console.log("❌ Error:", e.message);
  }
}

testFullData();
