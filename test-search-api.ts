import fetch from "node-fetch";

async function test() {
  const query = "duka";
  const endpoints = [
    `https://api.siputzx.my.id/api/s/soundcloud?query=${query}`,
    `https://api.vyturex.com/soundcloud/search?query=${query}`,
    `https://api.betabotz.eu.org/api/search/soundcloud?query=${query}`,
    `https://api.botcahx.live/api/search/soundcloud?query=${query}`,
  ];

  for (const url of endpoints) {
    try {
      console.log(`Testing ${url}...`);
      const res = await fetch(url);
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Success! Data preview: ${JSON.stringify(data).substring(0, 200)}`);
      } else {
        console.log(`Failed: ${res.statusText}`);
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
    console.log("---");
  }
}

test();
