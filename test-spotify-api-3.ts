import fetch from "node-fetch";

async function testSpotify3() {
  const query = "duka last child";
  const endpoints = [
    `https://api.paxsenix.biz.id/api/search/spotify?q=${encodeURIComponent(query)}`,
    `https://api.vreden.my.id/api/search/spotify?query=${encodeURIComponent(query)}`,
    `https://api.betabotz.eu.org/api/search/spotify?query=${encodeURIComponent(query)}&apikey=free`,
    `https://api.siputzx.my.id/api/s/spotify?query=${encodeURIComponent(query)}`
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

testSpotify3();
