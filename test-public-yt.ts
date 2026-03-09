import fetch from "node-fetch";

async function testPublicYT() {
  const query = "duka last child";
  const url = `https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(query)}`;
  
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

testPublicYT();
