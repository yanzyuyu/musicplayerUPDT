import fetch from "node-fetch";

async function test() {
  try {
    const endpoints = [
      'https://api.vreden.my.id/api/scdl?url=https://soundcloud.com/alanwalker/faded',
      'https://api.vreden.my.id/api/soundcloud?url=https://soundcloud.com/alanwalker/faded',
      'https://api.vreden.my.id/api/soundcloud?link=https://soundcloud.com/alanwalker/faded',
      'https://api.vreden.my.id/api/downloader/soundcloud?url=https://soundcloud.com/alanwalker/faded',
      'https://api.alyachan.dev/api/soundcloud?url=https://soundcloud.com/alanwalker/faded',
      'https://api.lolhuman.xyz/api/soundcloud?url=https://soundcloud.com/alanwalker/faded',
      'https://api.akuari.my.id/downloader/soundcloud?link=https://soundcloud.com/alanwalker/faded',
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        const text = await res.text();
        console.log("URL:", url);
        console.log("Status:", res.status);
        console.log("Body:", text.substring(0, 100));
        console.log("---");
      } catch (e) {
        console.log("URL:", url, "Error:", e.message);
      }
    }
  } catch (e) {
    console.error(e);
  }
}
test();
