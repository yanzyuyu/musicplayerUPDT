import fetch from "node-fetch";

async function testPublicDL() {
  const url = "https://www.youtube.com/watch?v=8zwz2fVgfVM";
  const downloadUrl = `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`;
  
  try {
    console.log(`Testing ${downloadUrl}...`);
    const res = await fetch(downloadUrl);
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log(`Data: ${JSON.stringify(data).substring(0, 500)}`);
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

testPublicDL();
