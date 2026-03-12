import React, { useState, useRef, useEffect } from 'react';
import { Search, Play, Pause, Volume2, Loader2, Music, SkipBack, SkipForward, Mic2, X, Plus, ListMusic, Trash2, ArrowLeft, History, Repeat, Repeat1, Shuffle, Download, CheckCircle2, HardDriveDownload, Flame, Edit3, Image as ImageIcon, Upload, Zap, Share2 } from 'lucide-react';
import localforage from 'localforage';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';
import { BatteryOptimization } from '@capawesome-team/capacitor-android-battery-optimization';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { motion, AnimatePresence } from 'framer-motion';
import { Network } from '@capacitor/network';

// Ganti dengan API Key ImgBB Anda jika perlu
const IMGBB_API_KEY = 'e18b5fb620e522fb9405cada79e56652';

interface SearchResult {
  duration?: number;
  permalink: string;
  artwork_url?: string;
  permalink_url: string;
  title?: string;
  user?: string;
  id?: string;
  artist?: string;
  isSpotify?: boolean;
}

interface TrackDetails {
  title: string;
  url: string;
  thumbnail: string;
  duration: number;
  user: string;
  description: string;
  permalink_url?: string;
  played_at?: string;
}

interface Playlist {
  id: string;
  name: string;
  tracks: SearchResult[];
  artwork_url?: string;
}

const API_BASE_URL = Capacitor.isNativePlatform() 
  ? 'https://musicplayer-updt.vercel.app' 
  : '';

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [trendingResults, setTrendingResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);
  const [searchSource, setSearchSource] = useState<'soundcloud' | 'spotify'>('soundcloud');
  
  const [currentTrack, setCurrentTrack] = useState<TrackDetails | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem('soundstream_playlists');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [isSpotifyImportModalOpen, setIsSpotifyImportModalOpen] = useState(false);
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState('');
  const [isImportingSpotify, setIsImportingSpotify] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importSuccessData, setImportSuccessData] = useState<{name: string, count: number, total: number} | null>(null);

  const [metadataSuggestions, setMetadataSuggestions] = useState<any[]>([]);
  const [isSelectingArtist, setIsSelectingArtist] = useState(false);

  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'library'>('home');
  const [isBassBoost, setIsBassBoost] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'playlists' | 'downloads' | 'history'>('playlists');
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditPlaylistModalOpen, setIsEditPlaylistModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportTrackModalOpen, setIsImportTrackModalOpen] = useState(false);
  const [sharedPlaylistData, setSharedPlaylistData] = useState<Playlist | null>(null);
  const [sharedTrackData, setSharedTrackData] = useState<any | null>(null);
  const [playlistToEdit, setPlaylistToEdit] = useState<Playlist | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistImage, setEditPlaylistImage] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [trackToAdd, setTrackToAdd] = useState<SearchResult | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [history, setHistory] = useState<TrackDetails[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [queue, setQueue] = useState<any[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffle, setIsShuffle] = useState(false);
  const [shuffledQueue, setShuffledQueue] = useState<any[]>([]);
  
  const [downloadedTracks, setDownloadedTracks] = useState<TrackDetails[]>([]);
  const [downloadingTracks, setDownloadingTracks] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const animationRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    localStorage.setItem('soundstream_playlists', JSON.stringify(playlists));
  }, [playlists]);

  const startForeground = async () => {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await ForegroundService.startForegroundService({
          id: 12345,
          title: currentTrack ? currentTrack.title : 'SoundStream',
          body: currentTrack ? `Playing: ${currentTrack.user}` : 'Ready to play',
          smallIcon: 'ic_launcher_foreground',
          channelId: 'foreground_service_channel'
        });
      } catch (e) { console.error(e); }
    }
  };

  useEffect(() => { startForeground(); }, [isPlaying, currentTrack]);

  useEffect(() => {
    const handleUrl = (url: string) => {
      try {
        const searchPart = url.includes('?') ? url.split('?')[1] : '';
        const params = new URLSearchParams(searchPart);
        const sharedData = params.get('share');
        const trackData = params.get('track');
        if (sharedData) {
          const decoded = JSON.parse(decodeURIComponent(escape(atob(sharedData))));
          const playlist: Playlist = {
            id: `shared_${Date.now()}`,
            name: decoded.n || "Shared Playlist",
            artwork_url: decoded.a || "",
            tracks: (decoded.t || []).map((t: any) => ({
              permalink_url: t.p, title: t.t, user: t.u, artwork_url: t.a, thumbnail: t.a, duration: t.d || 0, permalink: t.p.split('/').pop() || ''
            }))
          };
          setSharedPlaylistData(playlist);
          setIsImportModalOpen(true);
        }
        if (trackData) {
          setSharedTrackData(JSON.parse(decodeURIComponent(escape(atob(trackData)))));
          setIsImportTrackModalOpen(true);
        }
      } catch (e) { console.error(e); }
    };

    if (Capacitor.isNativePlatform()) {
      CapApp.getLaunchUrl().then(url => url?.url && handleUrl(url.url));
      CapApp.addListener('appUrlOpen', data => handleUrl(data.url));
    } else handleUrl(window.location.href);

    Network.getStatus().then(s => setIsOnline(status.connected));
    Network.addListener('networkStatusChange', s => setIsOnline(s.connected));
    
    fetchTrending();
    fetchHistory();
    loadDownloadedTracks();
  }, []);

  const fetchTrending = async () => {
    setIsLoadingTrending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/spotify/trending`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTrendingResults(data.map((t: any) => ({ ...t, user: t.artist, permalink: t.id || t.title })));
      }
    } catch (e) { console.error(e); } finally { setIsLoadingTrending(false); }
  };

  const handleSearch = async (e?: React.FormEvent, forceQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = forceQuery || query;
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setMetadataSuggestions([]);
    setIsSelectingArtist(false);
    try {
      if (searchSource === 'soundcloud') {
        const res = await fetch(`https://api.siputzx.my.id/api/s/soundcloud?query=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.status && data.data) setResults(data.data.filter((t: any) => t.duration > 0));
      } else {
        if (!forceQuery) {
          const metaRes = await fetch(`${API_BASE_URL}/api/search/metadata?query=${encodeURIComponent(searchQuery)}`);
          const metaData = await metaRes.json();
          if (Array.isArray(metaData) && metaData.length > 1) {
            setMetadataSuggestions(metaData);
            setIsSelectingArtist(true);
            setIsSearching(false);
            return;
          }
        }
        const res = await fetch(`${API_BASE_URL}/api/search/youtube?query=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data && data.items) {
          setResults(data.items.map((t: any) => ({
            id: t.id, title: t.title, user: t.channelTitle, artwork_url: t.thumbnail?.thumbnails?.[0]?.url, 
            thumbnail: t.thumbnail?.thumbnails?.[0]?.url, permalink_url: `https://www.youtube.com/watch?v=${t.id}`, duration: 0, permalink: t.id
          })));
        }
      }
    } catch (e) { console.error(e); } finally { setIsSearching(false); }
  };

  const playTrack = async (permalink_url: string, trackData?: any) => {
    if (!isOnline) {
      const offline = await localforage.getItem(`track_${permalink_url}`);
      if (!offline) return alert("Offline mode: track not downloaded.");
    }
    setIsLoadingTrack(true);
    try {
      let finalUrl = permalink_url;
      let meta = trackData;
      if (permalink_url.startsWith('spotify_jit_') || (trackData && trackData.isSpotify)) {
        const q = `${trackData?.title || permalink_url.split('_')[2]} ${trackData?.artist || permalink_url.split('_')[3]} (spotify)`;
        const res = await fetch(`${API_BASE_URL}/api/search/youtube?query=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.items?.length > 0) {
          finalUrl = `https://www.youtube.com/watch?v=${data.items[0].id}`;
          meta = { ...trackData, permalink_url: finalUrl, id: data.items[0].id };
        } else throw new Error("Not found");
      }
      const offline: any = await localforage.getItem(`track_${finalUrl}`);
      if (offline?.blob) {
        setCurrentTrack({ ...offline.metadata, url: URL.createObjectURL(offline.blob) });
        setIsPlaying(true);
        setIsLoadingTrack(false);
        return;
      }
      const endpoint = finalUrl.includes('youtube.com') || finalUrl.includes('youtu.be') ? 'youtube' : 'external';
      const res = await fetch(`${API_BASE_URL}/api/download/${endpoint}?url=${encodeURIComponent(finalUrl)}`);
      const data = await res.json();
      let trackInfo: any = null;
      if (endpoint === 'youtube' && data.status === 'ok') {
        trackInfo = { title: meta?.title || data.title, url: data.link, user: meta?.artist || data.user, thumbnail: meta?.thumbnail || data.thumbnail, permalink_url: finalUrl };
      } else if (data.status && data.data) {
        trackInfo = { ...data.data, permalink_url: finalUrl, thumbnail: data.data.thumbnail || data.data.image };
      }
      if (trackInfo?.url) {
        const audioRes = await fetch(trackInfo.url);
        const blob = await audioRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        await localforage.setItem('temp_playing_blob', blob);
        const finalTrack = { ...trackInfo, url: objectUrl };
        setCurrentTrack(finalTrack);
        setIsPlaying(true);
        saveToHistory(finalTrack);
      }
    } catch (e) { alert("Playback failed."); } finally { setIsLoadingTrack(false); }
  };

  const importSpotifyPlaylist = async () => {
    if (!spotifyPlaylistUrl.trim()) return;
    setIsImportingSpotify(true);
    setImportSuccessData(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/spotify/playlist?url=${encodeURIComponent(spotifyPlaylistUrl)}`);
      const data = await res.json();
      setImportProgress({ current: 0, total: data.tracks.length });
      const imported: SearchResult[] = [];
      for (let i = 0; i < data.tracks.length; i++) {
        const track = data.tracks[i];
        setImportProgress({ current: i + 1, total: data.tracks.length });
        try {
          const q = track.artist ? `${track.title} ${track.artist} (spotify)` : `${track.title} (spotify)`;
          const ytRes = await fetch(`${API_BASE_URL}/api/search/youtube?query=${encodeURIComponent(q)}`);
          const ytData = await ytRes.json();
          if (ytData.items?.length > 0) {
            const first = ytData.items[0];
            imported.push({ id: first.id, title: track.title, user: track.artist, artwork_url: track.thumbnail || first.thumbnail?.thumbnails?.[0]?.url, thumbnail: track.thumbnail || first.thumbnail?.thumbnails?.[0]?.url, permalink_url: `https://www.youtube.com/watch?v=${first.id}`, duration: track.duration, permalink: first.id });
          }
          await new Promise(r => setTimeout(r, 800));
        } catch (e) {}
      }
      if (imported.length > 0) {
        const p: Playlist = { id: `sp_${Date.now()}`, name: data.name, artwork_url: data.artwork_url, tracks: imported };
        setPlaylists(prev => [...prev, p]);
        setImportSuccessData({ name: data.name, count: imported.length, total: data.tracks.length });
        setIsSpotifyImportModalOpen(false);
        setSpotifyPlaylistUrl('');
      }
    } catch (e) { alert("Import failed."); } finally { setIsImportingSpotify(false); }
  };

  const fetchLyrics = async (title: string, artist?: string) => {
    setIsLoadingLyrics(true); setLyrics(null);
    try {
      const cleanTitle = title.replace(/\(official.*\)|\[official.*\]|\(lyrics.*\)|\[lyrics.*\]/gi, '').trim();
      const q = artist ? `${cleanTitle} ${artist}` : cleanTitle;
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const track = data?.find((t: any) => t.plainLyrics);
      if (track) setLyrics(track.plainLyrics);
      else {
        const resFallback = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`);
        const dataFallback = await resFallback.json();
        const fb = dataFallback?.find((t: any) => t.plainLyrics);
        setLyrics(fb ? fb.plainLyrics : "Lyrics not found.");
      }
    } catch (e) { setLyrics("Error loading lyrics."); } finally { setIsLoadingLyrics(false); }
  };

  const downloadTrack = async (e: React.MouseEvent, track: any) => {
    e.stopPropagation();
    if (!track.permalink_url) return;
    setDownloadingTracks(prev => new Set(prev).add(track.permalink_url));
    try {
      const isYT = track.permalink_url.includes('youtube.com') || track.permalink_url.includes('youtu.be');
      const res = await fetch(`${API_BASE_URL}/api/download/${isYT ? 'youtube' : 'external'}?url=${encodeURIComponent(track.permalink_url)}`);
      const data = await res.json();
      let meta: any = null;
      if (isYT && data.status === 'ok') meta = { title: data.title || track.title, url: data.link, user: data.user || "YouTube Music", thumbnail: data.thumbnail || track.thumbnail, permalink_url: track.permalink_url };
      else if (data.status && data.data) meta = { ...data.data, permalink_url: track.permalink_url, thumbnail: data.data.thumbnail || data.data.image };
      if (!meta?.url) throw new Error("No URL");
      const audioRes = await fetch(meta.url);
      const blob = await audioRes.blob();
      await localforage.setItem(`track_${track.permalink_url}`, { metadata: meta, blob });
      loadDownloadedTracks();
    } catch (e) { alert("Download failed."); } finally { setDownloadingTracks(prev => { const n = new Set(prev); n.delete(track.permalink_url); return n; }); }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const saved: any = await localforage.getItem('soundstream_history');
        if (Array.isArray(saved)) setHistory(saved);
      } else {
        const res = await fetch(`${API_BASE_URL}/api/history`);
        const data = await res.json();
        if (Array.isArray(data)) setHistory(data);
      }
    } catch (e) {} finally { setIsLoadingHistory(false); }
  };

  const saveToHistory = async (track: TrackDetails) => {
    const entry = { ...track, played_at: new Date().toISOString() };
    setHistory(prev => {
      const filtered = prev.filter(t => t.permalink_url !== track.permalink_url);
      const updated = [entry, ...filtered].slice(0, 50);
      if (Capacitor.isNativePlatform()) localforage.setItem('soundstream_history', updated);
      return updated;
    });
    if (!Capacitor.isNativePlatform()) {
      fetch(`${API_BASE_URL}/api/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(track) }).catch(() => {});
    }
  };

  const clearHistory = async () => {
    setConfirmModal({
      isOpen: true, title: "Clear History?", message: "Your recently played list will be wiped.",
      onConfirm: async () => {
        if (Capacitor.isNativePlatform()) await localforage.removeItem('soundstream_history');
        else await fetch(`${API_BASE_URL}/api/history`, { method: 'DELETE' });
        setHistory([]);
      }
    });
  };

  const loadDownloadedTracks = async () => {
    const keys = await localforage.keys();
    const tracks: TrackDetails[] = [];
    for (const key of keys) {
      if (key.startsWith('track_')) {
        const item: any = await localforage.getItem(key);
        if (item?.metadata) tracks.push(item.metadata);
      }
    }
    setDownloadedTracks(tracks);
  };

  const removeDownload = async (e: any, url: string) => {
    e.stopPropagation();
    await localforage.removeItem(`track_${url}`);
    loadDownloadedTracks();
  };

  const createPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const p: Playlist = { id: Date.now().toString(), name: newPlaylistName.trim(), tracks: [], artwork_url: '' };
    setPlaylists(prev => [...prev, p]);
    setNewPlaylistName('');
    if (trackToAdd) {
      const updated = [...playlists, p].map(pl => pl.id === p.id ? { ...pl, tracks: [trackToAdd] } : pl);
      setPlaylists(updated);
      setIsAddModalOpen(false);
      setTrackToAdd(null);
    } else setIsAddModalOpen(false);
  };

  const addToPlaylist = (id: string, track: SearchResult) => {
    setPlaylists(prev => prev.map(p => p.id === id && !p.tracks.some(t => t.permalink_url === track.permalink_url) ? { ...p, tracks: [...p.tracks, track] } : p));
    setIsAddModalOpen(false);
    setTrackToAdd(null);
  };

  const removeFromPlaylist = (id: string, url: string) => {
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, tracks: p.tracks.filter(t => t.permalink_url !== url) } : p));
    if (activePlaylist?.id === id) setActivePlaylist({ ...activePlaylist, tracks: activePlaylist.tracks.filter(t => t.permalink_url !== url) });
  };

  const updatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistToEdit) return;
    setPlaylists(prev => prev.map(p => p.id === playlistToEdit.id ? { ...p, name: editPlaylistName, artwork_url: editPlaylistImage } : p));
    setIsEditPlaylistModalOpen(false);
    if (activePlaylist?.id === playlistToEdit.id) setActivePlaylist({ ...activePlaylist, name: editPlaylistName, artwork_url: editPlaylistImage });
  };

  const deletePlaylist = (id: string) => {
    setConfirmModal({
      isOpen: true, title: "Delete Playlist?", message: "This action cannot be undone.",
      onConfirm: () => {
        setPlaylists(prev => prev.filter(p => p.id !== id));
        if (activePlaylist?.id === id) setActivePlaylist(null);
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsUploadingImage(true);
    const fd = new FormData(); fd.append('image', file);
    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) setEditPlaylistImage(data.data.url);
    } catch (e) {} finally { setIsUploadingImage(false); }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return "0:00";
    const m = Math.floor(s / 60); const ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };

  const shareTrack = async (track: any) => {
    const data = { t: track.title, u: track.user, a: track.artwork_url || track.thumbnail, d: track.duration, p: track.permalink_url };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    const url = `https://musicplayer-updt.vercel.app/?track=${encoded}`;
    if (navigator.share) await navigator.share({ title: data.t, url });
    else { await navigator.clipboard.writeText(url); alert("Copied!"); }
  };

  const sharePlaylist = async (p: Playlist) => {
    const data = { n: p.name, a: p.artwork_url, t: p.tracks.map(t => ({ p: t.permalink_url, t: t.title, u: t.user, a: t.artwork_url, d: t.duration })) };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    const url = `https://musicplayer-updt.vercel.app/?share=${encoded}`;
    if (navigator.share) await navigator.share({ title: p.name, url });
    else { await navigator.clipboard.writeText(url); alert("Copied!"); }
  };

  const playNext = () => {
    const q = isShuffle ? shuffledQueue : queue;
    if (q.length > 0) {
      let idx = queueIndex + 1;
      if (idx >= q.length) idx = repeatMode === 'all' ? 0 : -1;
      if (idx !== -1) { setQueueIndex(idx); playTrack(q[idx].permalink_url); }
      else setIsPlaying(false);
    }
  };

  const playPrevious = () => {
    const q = isShuffle ? shuffledQueue : queue;
    if (q.length > 0) {
      let idx = queueIndex - 1;
      if (idx < 0) idx = repeatMode === 'all' ? q.length - 1 : 0;
      setQueueIndex(idx); playTrack(q[idx].permalink_url);
    }
  };

  const getArtistFromUrl = (url: string) => {
    const match = url.match(/soundcloud\.com\/([^/]+)/);
    return match ? match[1].replace(/-/g, ' ') : "Unknown Artist";
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans overflow-hidden">
      <header className="px-6 py-4 sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-500 font-bold text-xl"><Music className="w-7 h-7" /><span>SoundStream</span></div>
        <div className="flex items-center gap-4">
          {!isOnline && <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /><span className="text-[10px] font-bold text-red-500 uppercase">Offline</span></div>}
          <button className="p-2 bg-zinc-900 rounded-full text-zinc-400" onClick={() => {setActiveTab('library'); setLibraryTab('history');}}><History className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-6 space-y-8">
              <section>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><Flame className="w-6 h-6 text-orange-500 fill-orange-500" /> Trending Today</h2>
                {isLoadingTrending ? <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <div key={i} className="aspect-square bg-zinc-900 rounded-2xl animate-pulse" />)}</div> : (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {trendingResults.slice(0, 5).map((t, i) => (
                      <div key={t.permalink_url} onClick={() => { setQueue(trendingResults); setQueueIndex(i); playTrack(t.permalink_url, t); }} className="space-y-2 cursor-pointer group">
                        <div className="aspect-square rounded-2xl overflow-hidden relative shadow-lg">
                          <img src={t.thumbnail || "https://picsum.photos/seed/m/300/300"} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-10 h-10 fill-emerald-500 text-emerald-500" /></div>
                        </div>
                        <h3 className="font-bold text-sm truncate">{t.title}</h3>
                        <p className="text-xs text-zinc-500 truncate">{t.artist}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              {history.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold mb-4">Recently Played</h2>
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                    {history.slice(0, 10).map((t, i) => (
                      <div key={i} onClick={() => playTrack(t.permalink_url!)} className="w-24 flex-shrink-0 space-y-2 cursor-pointer">
                        <img src={t.thumbnail} className="w-24 h-24 rounded-xl object-cover shadow-md" />
                        <p className="text-[10px] font-bold truncate text-center">{t.title}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <h2 className="text-xl font-bold mb-4">More Trending</h2>
                <TrackList tracks={trendingResults.slice(5)} playTrack={playTrack} downloadedTracks={downloadedTracks} removeDownload={removeDownload} downloadTrack={downloadTrack} downloadingTracks={downloadingTracks} openAddModal={(e:any, t:any)=> {setTrackToAdd(t); setIsAddModalOpen(true);}} shareTrack={shareTrack} setConfirmModal={setConfirmModal} />
              </section>
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">Search</h2>
                <div className="flex bg-zinc-900 rounded-full p-1 border border-zinc-800">
                  {(['soundcloud', 'spotify'] as const).map(s => <button key={s} onClick={() => setSearchSource(s)} className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${searchSource === s ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-500'}`}>{s}</button>)}
                </div>
              </div>
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${searchSource}...`} className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-2xl py-4 pl-12 pr-4 text-zinc-100" />
              </form>
              {isSearching ? <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /><p>Searching...</p></div> : isSelectingArtist ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><h3 className="font-bold text-zinc-400">Pilih Versi Artis</h3><button onClick={() => setIsSelectingArtist(false)} className="text-xs text-emerald-500">Lewati</button></div>
                  <div className="space-y-3">
                    {metadataSuggestions.map((s, i) => (
                      <div key={i} onClick={() => { setQuery(`${s.title} ${s.artist}`); handleSearch(undefined, `${s.title} ${s.artist}`); }} className="flex items-center gap-4 p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800 hover:border-emerald-500/30 cursor-pointer">
                        <img src={s.artwork} className="w-14 h-14 rounded-xl object-cover" />
                        <div className="flex-1 min-w-0"><h4 className="font-bold truncate">{s.title}</h4><p className="text-xs text-zinc-500 truncate">{s.artist}</p></div>
                        <ArrowLeft className="w-5 h-5 rotate-180 text-zinc-700" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : results.length > 0 ? <TrackList tracks={results} playTrack={playTrack} downloadedTracks={downloadedTracks} removeDownload={removeDownload} downloadTrack={downloadTrack} downloadingTracks={downloadingTracks} openAddModal={(e:any, t:any)=> {setTrackToAdd(t); setIsAddModalOpen(true);}} shareTrack={shareTrack} setConfirmModal={setConfirmModal} /> : (
                <div className="grid grid-cols-2 gap-4">{['Pop', 'Rock', 'Indie', 'Jazz', 'Electronic', 'Hip Hop'].map(g => <div key={g} onClick={() => { setQuery(g); handleSearch(); }} className="h-24 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-4 font-bold text-lg flex items-end cursor-pointer">{g}</div>)}</div>
              )}
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 space-y-6">
              <div className="flex items-center justify-between"><h2 className="text-3xl font-bold">Library</h2><button onClick={() => setIsAddModalOpen(true)} className="p-2 bg-emerald-500 text-zinc-950 rounded-full"><Plus className="w-6 h-6" /></button></div>
              <div className="flex border-b border-zinc-900 overflow-x-auto no-scrollbar">
                {(['playlists', 'downloads', 'history'] as const).map(t => <button key={t} onClick={() => setLibraryTab(t)} className={`px-4 py-3 font-medium capitalize border-b-2 transition-colors ${libraryTab === t ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-zinc-500'}`}>{t}</button>)}
              </div>
              <div className="pt-2">
                {libraryTab === 'playlists' && (
                  <div className="space-y-6">
                    {activePlaylist ? (
                      <div className="space-y-6">
                        <div className="flex gap-6 items-end">
                          <img src={activePlaylist.artwork_url || activePlaylist.tracks[0]?.artwork_url || activePlaylist.tracks[0]?.thumbnail || "https://picsum.photos/seed/p/300/300"} className="w-32 h-32 rounded-3xl object-cover shadow-2xl" />
                          <div className="flex-1">
                            <button onClick={() => setActivePlaylist(null)} className="flex items-center gap-1 text-xs text-zinc-500 mb-2"><ArrowLeft className="w-4 h-4" /> Back</button>
                            <h3 className="text-3xl font-bold mb-2">{activePlaylist.name}</h3>
                            <div className="flex gap-2">
                              <button onClick={() => playPlaylist(activePlaylist)} className="bg-emerald-500 text-zinc-950 px-6 py-2 rounded-full font-bold flex items-center gap-2"><Play className="w-4 h-4 fill-current" /> Play</button>
                              <button onClick={() => sharePlaylist(activePlaylist)} className="p-2 bg-zinc-900 rounded-full text-emerald-500"><Share2 className="w-5 h-5" /></button>
                              <button onClick={() => deletePlaylist(activePlaylist.id)} className="p-2 bg-zinc-900 rounded-full text-red-500"><Trash2 className="w-5 h-5" /></button>
                            </div>
                          </div>
                        </div>
                        <TrackList tracks={activePlaylist.tracks} playTrack={playTrack} downloadedTracks={downloadedTracks} removeDownload={removeDownload} downloadTrack={downloadTrack} downloadingTracks={downloadingTracks} openAddModal={(e:any, t:any)=> {setTrackToAdd(t); setIsAddModalOpen(true);}} shareTrack={shareTrack} setConfirmModal={setConfirmModal} showRemove playlistId={activePlaylist.id} removeFromPlaylist={removeFromPlaylist} />
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-3">
                          <button onClick={() => setIsAddModalOpen(true)} className="flex-1 py-4 border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-500 flex items-center justify-center gap-2 hover:bg-zinc-900"><Plus className="w-5 h-5" /> <b>New</b></button>
                          <button onClick={() => setIsSpotifyImportModalOpen(true)} className="flex-1 py-4 border-2 border-dashed border-emerald-900/30 rounded-3xl text-emerald-600 flex items-center justify-center gap-2 hover:bg-emerald-950/20"><Music className="w-5 h-5" /> <b>Import Spotify</b></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {playlists.map(p => (
                            <div key={p.id} onClick={() => setActivePlaylist(p)} className="p-4 bg-zinc-900/40 rounded-3xl cursor-pointer hover:bg-zinc-900 transition-all border border-transparent hover:border-zinc-800">
                              <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-800 mb-3"><img src={p.artwork_url || p.tracks[0]?.artwork_url || p.tracks[0]?.thumbnail || "https://picsum.photos/seed/p/300/300"} className="w-full h-full object-cover" /></div>
                              <h4 className="font-bold truncate">{p.name}</h4><p className="text-xs text-zinc-500">{p.tracks.length} songs</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {libraryTab === 'downloads' && <TrackList tracks={downloadedTracks} playTrack={playTrack} downloadedTracks={downloadedTracks} removeDownload={removeDownload} downloadTrack={downloadTrack} downloadingTracks={downloadingTracks} openAddModal={(e:any, t:any)=> {setTrackToAdd(t); setIsAddModalOpen(true);}} shareTrack={shareTrack} setConfirmModal={setConfirmModal} />}
                {libraryTab === 'history' && (
                  <div className="space-y-4">
                    <div className="flex justify-end"><button onClick={clearHistory} className="text-xs text-zinc-500 flex items-center gap-1"><Trash2 className="w-4 h-4" /> Clear</button></div>
                    <TrackList tracks={history} playTrack={playTrack} downloadedTracks={downloadedTracks} removeDownload={removeDownload} downloadTrack={downloadTrack} downloadingTracks={downloadingTracks} openAddModal={(e:any, t:any)=> {setTrackToAdd(t); setIsAddModalOpen(true);}} shareTrack={shareTrack} setConfirmModal={setConfirmModal} />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {currentTrack && !isPlayerExpanded && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-[72px] left-2 right-2 z-50 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-2xl flex items-center gap-3" onClick={() => setIsPlayerExpanded(true)}>
          <img src={currentTrack.thumbnail} className="w-12 h-12 rounded-xl object-cover" />
          <div className="flex-1 min-w-0"><h4 className="font-bold text-sm truncate">{currentTrack.title}</h4><p className="text-xs text-emerald-500 truncate">{currentTrack.user}</p></div>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={playPrevious} className="p-2 text-zinc-400"><SkipBack className="w-5 h-5 fill-current" /></button>
            <button onClick={togglePlay} className="p-2 text-white">{isLoadingTrack ? <Loader2 className="w-6 h-6 animate-spin" /> : isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}</button>
            <button onClick={playNext} className="p-2 text-zinc-400"><SkipForward className="w-5 h-5 fill-current" /></button>
          </div>
          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(progress / duration) * 100}%` }} /></div>
        </motion.div>
      )}

      <AnimatePresence>
        {isPlayerExpanded && currentTrack && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col p-8 sm:p-12">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />
            <div className="relative flex-1 flex flex-col items-center">
              <div className="w-full flex justify-between mb-8">
                <button onClick={() => setIsPlayerExpanded(false)} className="p-2 bg-white/5 rounded-full"><ArrowLeft className="w-6 h-6 rotate-[-90deg]" /></button>
                <div className="text-center"><p className="text-[10px] font-bold text-emerald-500 uppercase">Now Playing</p><p className="text-sm font-bold truncate max-w-[200px]">{currentTrack.title}</p></div>
                <button onClick={() => { setIsPlayerExpanded(false); setActiveTab('library'); }} className="p-2 bg-white/5 rounded-full"><ListMusic className="w-6 h-6" /></button>
              </div>
              <motion.img animate={{ scale: isPlaying ? 1 : 0.9 }} src={currentTrack.thumbnail} className="w-full max-w-[320px] aspect-square rounded-[2rem] shadow-2xl mb-8 object-cover" />
              <div className="text-center space-y-2 mb-8"><h2 className="text-3xl font-bold line-clamp-1">{currentTrack.title}</h2><p className="text-xl text-emerald-400">{currentTrack.user}</p></div>
              <div className="w-full space-y-2 mb-8">
                <div className="h-1.5 bg-zinc-800 rounded-full relative overflow-hidden cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); const p = (e.clientX - rect.left) / rect.width; if(audioRef.current) audioRef.current.currentTime = p * duration; }}>
                  <div className="h-full bg-emerald-500" style={{ width: `${(progress / duration) * 100}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 font-bold"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
              </div>
              <div className="flex items-center justify-between w-full max-w-xs mb-12">
                <button onClick={toggleShuffle} className={isShuffle ? 'text-emerald-500' : 'text-zinc-600'}><Shuffle className="w-6" /></button>
                <button onClick={playPrevious} className="text-white"><SkipBack className="w-8 h-8 fill-current" /></button>
                <button onClick={togglePlay} className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center shadow-xl">{isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}</button>
                <button onClick={playNext} className="text-white"><SkipForward className="w-8 h-8 fill-current" /></button>
                <button onClick={toggleRepeat} className={repeatMode !== 'off' ? 'text-emerald-500' : 'text-zinc-600'}>{repeatMode === 'one' ? <Repeat1 className="w-6" /> : <Repeat className="w-6" />}</button>
              </div>
              <div className="flex justify-around w-full max-w-sm">
                <button onClick={() => { if(!lyrics) fetchLyrics(currentTrack.title, currentTrack.user); setIsLyricsOpen(true); }} className={`flex flex-col items-center gap-1 ${isLyricsOpen ? 'text-emerald-500' : 'text-zinc-500'}`}><Mic2 className="w-6" /><span className="text-[8px] font-bold uppercase">Lyrics</span></button>
                <button onClick={() => shareTrack(currentTrack)} className="flex flex-col items-center gap-1 text-zinc-500"><Share2 className="w-6" /><span className="text-[8px] font-bold uppercase">Share</span></button>
                <button onClick={() => setIsBassBoost(!isBassBoost)} className={`flex flex-col items-center gap-1 ${isBassBoost ? 'text-emerald-500' : 'text-zinc-500'}`}><Zap className="w-6" /><span className="text-[8px] font-bold uppercase">Boost</span></button>
                <button onClick={(e) => downloadTrack(e, currentTrack)} className="flex flex-col items-center gap-1 text-zinc-500">{downloadingTracks.has(currentTrack.permalink_url!) ? <Loader2 className="w-6 animate-spin" /> : <Download className="w-6" />}<span className="text-[8px] font-bold uppercase">Offline</span></button>
              </div>
            </div>
            <AnimatePresence>{isLyricsOpen && (
              <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="absolute inset-0 bg-zinc-950/95 z-50 p-8 flex flex-col">
                <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-bold">Lyrics</h3><button onClick={() => setIsLyricsOpen(false)} className="p-2 bg-zinc-900 rounded-full"><X className="w-6" /></button></div>
                <div className="flex-1 overflow-y-auto no-scrollbar pb-20">{isLoadingLyrics ? <div className="h-full flex items-center justify-center"><Loader2 className="w-10 animate-spin text-emerald-500" /></div> : <p className="text-3xl font-bold leading-tight whitespace-pre-wrap">{lyrics || "Lyrics not found."}</p>}</div>
              </motion.div>
            )}</AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900 px-6 py-3 flex justify-between items-center z-50">
        <NavButton active={activeTab === 'home'} icon={<Music />} label="Home" onClick={() => setActiveTab('home')} />
        <NavButton active={activeTab === 'search'} icon={<Search />} label="Search" onClick={() => setActiveTab('search')} />
        <NavButton active={activeTab === 'library'} icon={<ListMusic />} label="Library" onClick={() => setActiveTab('library')} />
      </nav>

      {/* Modals & Overlays */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6" onClick={() => setIsAddModalOpen(false)}>
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-zinc-900 p-8 rounded-[2rem] w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6">Add to Playlist</h3>
            <div className="space-y-3 mb-6 max-h-48 overflow-y-auto no-scrollbar">
              {playlists.map(p => <button key={p.id} onClick={() => trackToAdd && addToPlaylist(p.id, trackToAdd)} className="w-full p-4 bg-zinc-800 rounded-2xl font-bold text-left">{p.name}</button>)}
            </div>
            <form onSubmit={createPlaylist} className="flex gap-2">
              <input value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="New playlist..." className="flex-1 bg-zinc-800 rounded-xl px-4 py-2" />
              <button type="submit" className="bg-emerald-500 text-zinc-950 p-2 rounded-xl"><Plus /></button>
            </form>
          </motion.div>
        </div>
      )}

      {isSpotifyImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
          <motion.div animate={{ scale: 1 }} className="bg-zinc-900 p-8 rounded-[2rem] w-full max-w-sm">
            <div className="flex justify-between mb-6"><h3 className="text-xl font-bold">Import Spotify</h3>{!isImportingSpotify && <button onClick={() => setIsSpotifyImportModalOpen(false)}><X /></button>}</div>
            {isImportingSpotify ? (
              <div className="text-center py-4 space-y-4">
                <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto" />
                <p className="font-bold">Importing songs...</p>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }} /></div>
                <p className="text-xs text-zinc-500">{importProgress.current} / {importProgress.total}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <input value={spotifyPlaylistUrl} onChange={e => setSpotifyPlaylistUrl(e.target.value)} placeholder="Paste Spotify Link..." className="w-full bg-zinc-800 rounded-xl px-4 py-3" />
                <button onClick={importSpotifyPlaylist} className="w-full bg-emerald-500 text-zinc-950 py-3 rounded-xl font-bold">Start Import</button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {importSuccessData && (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-zinc-900 p-10 rounded-[3rem] text-center space-y-6 w-full max-w-sm border border-emerald-500/20">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 className="w-10 h-10 text-zinc-950" /></div>
            <h3 className="text-2xl font-bold">Import Complete!</h3>
            <p className="text-zinc-400">"{importSuccessData.name}" created with {importSuccessData.count} songs.</p>
            <button onClick={() => { setImportSuccessData(null); setActiveTab('library'); setLibraryTab('playlists'); }} className="w-full bg-white text-black py-4 rounded-2xl font-bold">View Playlist</button>
          </motion.div>
        </div>
      )}

      {confirmModal?.isOpen && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-900 p-8 rounded-[2.5rem] w-full max-w-xs text-center space-y-6 border border-zinc-800">
            <h3 className="text-xl font-bold">{confirmModal.title}</h3><p className="text-zinc-400 text-sm">{confirmModal.message}</p>
            <div className="flex gap-3"><button onClick={() => setConfirmModal(null)} className="flex-1 py-3 bg-zinc-800 rounded-xl">Cancel</button><button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-3 bg-red-500 text-white rounded-xl">Confirm</button></div>
          </div>
        </div>
      )}

      {isLoadingTrack && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8 gap-6">
          <div className="relative"><div className="w-24 h-24 border-2 border-emerald-500/20 rounded-full" /><div className="absolute inset-0 w-24 h-24 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /><Music className="absolute inset-0 m-auto w-8 h-8 text-emerald-500 animate-pulse" /></div>
          <div className="text-center"><h3 className="text-xl font-bold mb-2">Preparing Audio...</h3><p className="text-xs text-zinc-500">Wait a few seconds.</p></div>
        </div>
      )}

      <audio ref={audioRef} src={currentTrack?.url} crossOrigin="anonymous" onTimeUpdate={() => { if(audioRef.current) setProgress(audioRef.current.currentTime); }} onEnded={playNext} onLoadedMetadata={() => { if(audioRef.current) setDuration(audioRef.current.duration); }} />
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: any) {
  return <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-emerald-500' : 'text-zinc-500'}`}><motion.div animate={{ scale: active ? 1.2 : 1 }}>{icon}</motion.div><span className="text-[8px] font-bold uppercase">{label}</span></button>;
}

const TrackList = ({ tracks, playTrack, downloadedTracks, removeDownload, downloadTrack, downloadingTracks, openAddModal, shareTrack, setConfirmModal, showRemove, playlistId, removeFromPlaylist }: any) => (
  <div className="space-y-2">
    {tracks.map((t: any, i: number) => (
      <div key={i} onClick={() => playTrack(t.permalink_url, t)} className="flex items-center gap-4 p-2 hover:bg-zinc-900/50 rounded-2xl cursor-pointer group">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 relative">
          <img src={t.artwork_url || t.thumbnail || "https://picsum.photos/seed/m/100/100"} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100"><Play className="w-5 h-5 fill-white text-white" /></div>
        </div>
        <div className="flex-1 min-w-0"><h4 className="font-bold text-xs truncate capitalize">{t.title}</h4><p className="text-[10px] text-zinc-500 truncate">{t.user || t.artist}</p></div>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          {downloadedTracks.some((d:any)=>d.permalink_url === t.permalink_url) ? (
            <button onClick={(e) => setConfirmModal({ isOpen: true, title: "Remove?", message: "Delete from offline storage.", onConfirm: () => removeDownload(e, t.permalink_url) })} className="p-2 text-red-500"><Trash2 className="w-4 h-4" /></button>
          ) : (
            <button onClick={(e) => downloadTrack(e, t)} className="p-2 text-zinc-700">{downloadingTracks.has(t.permalink_url) ? <Loader2 className="w-4 animate-spin" /> : <Download className="w-4" />}</button>
          )}
          <button onClick={() => shareTrack(t)} className="p-2 text-zinc-700"><Share2 className="w-4 h-4" /></button>
          {showRemove ? <button onClick={() => removeFromPlaylist(playlistId, t.permalink_url)} className="p-2 text-zinc-700"><X className="w-4 h-4" /></button> : <button onClick={(e) => openAddModal(e, t)} className="p-2 text-zinc-700"><Plus className="w-4 h-4" /></button>}
        </div>
      </div>
    ))}
  </div>
);
