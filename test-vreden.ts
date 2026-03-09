import fetch from "node-fetch";

async function testVreden() {
  const query = "duka last child";
  const url = `https://api.vreden.my.id/api/spotify-search?query=${encodeURIComponent(query)}`;
  
  try {
    console.log(`Testing ${url}...`);
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log(`Data: ${JSON.stringify(data).substring(0, 500)}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

testVreden();
