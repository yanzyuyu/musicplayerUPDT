import yt from "youtube-search-api";

async function testPlaylist() {
  const playlistId = "PLgzTt0k8mXzEk586ze4BjvDXR7c-TUSnx";
  console.log(`🔍 Mengambil data playlist YouTube: ${playlistId}`);

  try {
    const results: any = await yt.GetPlaylistData(playlistId);
    console.log("✅ Berhasil mendapatkan data playlist!");
    
    if (results && results.items) {
      console.log(`Ditemukan ${results.items.length} lagu.`);
      results.items.slice(0, 5).forEach((item: any, idx: number) => {
        console.log(`${idx + 1}. ${item.title}`);
        console.log(`   ID: ${item.id}`);
        console.log(`   Thumbnail: ${item.thumbnail?.thumbnails?.[0]?.url}`);
      });
    } else {
      console.log("❌ Playlist kosong atau tidak ditemukan.");
    }
  } catch (e: any) {
    console.log("❌ Error:", e.message);
  }
}

testPlaylist();
