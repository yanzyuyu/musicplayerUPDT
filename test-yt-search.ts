import yt from "youtube-search-api";

async function testYTSearch() {
  const query = "Duka Last Child Official Music Video";
  console.log(`🔍 Mencari di YouTube untuk: ${query}`);

  try {
    const results: any = await yt.GetListByKeyword(query, false, 5);
    console.log("✅ Berhasil mendapatkan hasil!");
    if (results && results.items) {
      results.items.forEach((item: any, idx: number) => {
        console.log(`${idx + 1}. ${item.title}`);
        console.log(`   ID: ${item.id}`);
        console.log(`   Link: https://www.youtube.com/watch?v=${item.id}`);
        console.log(`   Thumbnail: ${item.thumbnail?.thumbnails?.[0]?.url}`);
        console.log(`   Duration: ${item.lengthText || 'N/A'}`);
      });
    }
  } catch (e: any) {
    console.log("❌ Error:", e.message);
  }
}

testYTSearch();
