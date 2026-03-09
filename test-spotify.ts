import 'dotenv/config';
import fetch from 'node-fetch';

async function testSpotifyConnection() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌ Error: SPOTIFY_CLIENT_ID atau SPOTIFY_CLIENT_SECRET tidak ditemukan di .env');
    return;
  }

  console.log('🚀 Mencoba mendapatkan Access Token Spotify...');

  try {
    // 1. Get Access Token
    const authRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });

    const authData: any = await authRes.json();

    if (!authRes.ok) {
      console.error('❌ Gagal mendapatkan token:', authData);
      return;
    }

    const token = authData.access_token;
    console.log('✅ Token Berhasil Didapat:', token.substring(0, 20) + '...');

    // 2. Test Search API
    console.log('🔍 Mencoba mencari lagu "Duka"...');
    const searchRes = await fetch('https://api.spotify.com/v1/search?q=duka&type=track&limit=1', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const searchData: any = await searchRes.json();

    if (searchRes.ok && searchData.tracks.items.length > 0) {
      const track = searchData.tracks.items[0];
      console.log('✅ Koneksi Berhasil!');
      console.log('🎵 Hasil Pencarian:');
      console.log(`   - Judul: ${track.name}`);
      console.log(`   - Artist: ${track.artists.map((a: any) => a.name).join(', ')}`);
      console.log(`   - Album: ${track.album.name}`);
      console.log(`   - Preview URL: ${track.preview_url || 'Tidak tersedia'}`);
    } else {
      console.log('❌ Koneksi berhasil tapi tidak ada hasil pencarian.');
    }

  } catch (error: any) {
    console.error('❌ Terjadi Error:', error.message);
  }
}

testSpotifyConnection();
