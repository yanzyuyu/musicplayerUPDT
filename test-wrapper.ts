import spotifySearch from "spotify-search-wrapper";

async function test() {
  console.log("🚀 Testing spotify-search-wrapper...");
  try {
    const tracks: any = await spotifySearch.searchTrack("Never Gonna Give You Up");
    if (tracks && tracks.length > 0) {
      console.log("✅ Success! Found:", tracks.length, "tracks.");
      console.log("ID:", tracks[0].id);
      console.log("Name:", tracks[0].name);
      console.log("Artist:", tracks[0].artists[0].name);
      console.log("External URL:", tracks[0].external_urls?.spotify || "Not found");
    } else {
      console.log("❌ No tracks found.");
    }
  } catch (e: any) {
    console.log("❌ Error:", e.message);
  }
}

test();
