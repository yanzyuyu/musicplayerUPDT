import fetch from "node-fetch";

async function testSpotify2() {
  const query = "duka last child";
  const endpoints = [
    `https://spotifyapi.caliphdev.com/api/search/tracks?q=${encodeURIComponent(query)}`,
    `https://api.vreden.my.id/api/spotify-search?query=${encodeURIComponent(query)}`,
    `https://api.btch.bz/api/search/spotify?text=${encodeURIComponent(query)}`,
    `https://api.vyturex.com/spotify/search?query=${encodeURIComponent(query)}`
  ];

  for (const url of endpoints) {
    try {
      console.log(`Testing ${url}...`);
      const res = await fetch(url);
      console.log(`Status: ${res.status}`);
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        console.log(`Success! Data preview: ${JSON.stringify(data).substring(0, 300)}`);
      } catch (e) {
        console.log(`Response is not JSON: ${text.substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
    console.log("---");
  }
}

testSpotify2();
