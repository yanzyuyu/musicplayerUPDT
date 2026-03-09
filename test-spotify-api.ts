import fetch from "node-fetch";

async function testSpotify() {
  const query = "duka last child";
  const endpoints = [
    `https://api.vreden.my.id/api/spotify?query=${encodeURIComponent(query)}`,
    `https://api.vyturex.com/spotify/search?query=${encodeURIComponent(query)}`,
    `https://api.botcahx.eu.org/api/search/spotify?query=${encodeURIComponent(query)}&apikey=trial`,
    `https://api.betabotz.eu.org/api/search/spotify?query=${encodeURIComponent(query)}&apikey=beta`
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

testSpotify();
