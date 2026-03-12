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

    Network.getStatus().then(s => setIsOnline(s.connected));
    Network.addListener('networkStatusChange', s => setIsOnline(s.connected));
    
    fetchTrending();
    fetchHistory();
    loadDownloadedTracks();
  }, []);

  const fetchTrending = async () => {
    setIsLoadingTrending(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/spotify/trending`);
      const trendingData = await res.json();
      
      if (Array.isArray(trendingData)) {
        const mapped = trendingData.map((t: any) => ({
          ...t,
          user: t.artist,
          permalink: t.id || t.title
        }));
        setTrendingResults(mapped);
      }
    } catch (error) {
      console.error("Failed to fetch trending:", error);
    } finally {
      setIsLoadingTrending(false);
    }
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
        if (data.status && data.data) {
          setResults(data.data.filter((t: any) => t.duration > 0));
        }
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

        const url = `${API_BASE_URL}/api/search/youtube?query=${encodeURIComponent(searchQuery)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.items) {
          const mapped = data.items.map((t: any) => ({
            id: t.id,
            title: t.title,
            user: t.channelTitle || "YouTube Music",
            artwork_url: t.thumbnail?.thumbnails?.[0]?.url || "",
            thumbnail: t.thumbnail?.thumbnails?.[0]?.url || "",
            permalink_url: `https://www.youtube.com/watch?v=${t.id}`,
            duration: 0,
            permalink: t.id
          }));
          setResults(mapped);
        }
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const playTrack = async (permalink_url: string, trackData?: any) => {
    if (!isOnline) {
      const offlineData: any = await localforage.getItem(`track_${permalink_url}`);
      if (!offlineData) {
        alert("Kamu sedang offline. Lagu ini belum diunduh.");
        return;
      }
    }

    setIsLoadingTrack(true);
    try {
      let finalPermalinkUrl = permalink_url;
      let metadataToUse = trackData;

      if (permalink_url.startsWith('spotify_jit_') || (trackData && trackData.isSpotify)) {
        let searchTitle = trackData?.title;
        let searchArtist = trackData?.artist;

        if (!searchTitle && permalink_url.startsWith('spotify_jit_')) {
          const parts = permalink_url.replace('spotify_jit_', '').split('_');
          searchTitle = parts[0];
          searchArtist = parts[1];
        }

        const query = `${searchTitle} ${searchArtist} (spotify)`;
        const ytRes = await fetch(`${API_BASE_URL}/api/search/youtube?query=${encodeURIComponent(query)}`);
        const ytData = await ytRes.json();
        
        if (ytData && ytData.items && ytData.items.length > 0) {
          const firstResult = ytData.items[0];
          finalPermalinkUrl = `https://www.youtube.com/watch?v=${firstResult.id}`;
          metadataToUse = {
            ...trackData,
            title: searchTitle,
            user: searchArtist,
            thumbnail: trackData?.thumbnail || firstResult.thumbnail?.thumbnails?.[0]?.url || "",
            permalink_url: finalPermalinkUrl
          };
        } else {
          throw new Error("Lagu tidak ditemukan di YouTube");
        }
      }

      const offlineData: any = await localforage.getItem(`track_${finalPermalinkUrl}`);
      if (offlineData && offlineData.blob) {
        const objectUrl = URL.createObjectURL(offlineData.blob);
        setCurrentTrack({ ...offlineData.metadata, url: objectUrl });
        setIsPlaying(true);
        setIsLoadingTrack(false);
        return;
      }

      const isYouTube = finalPermalinkUrl.includes('youtube.com') || finalPermalinkUrl.includes('youtu.be');
      const endpoint = isYouTube ? 'youtube' : 'external';
      
      const res = await fetch(`${API_BASE_URL}/api/download/${endpoint}?url=${encodeURIComponent(finalPermalinkUrl)}`);
      const data = await res.json();
      
      let trackInfo: any = null;
      if (isYouTube) {
        if (data && data.status === 'ok') {
          trackInfo = {
            title: metadataToUse?.title || data.title,
            url: data.link,
            user: metadataToUse?.user || data.user || "YouTube Music",
            thumbnail: metadataToUse?.thumbnail || data.thumbnail,
            permalink_url: finalPermalinkUrl
          };
        }
      } else {
        if (data.status && data.data) {
          trackInfo = { ...data.data, permalink_url: finalPermalinkUrl, thumbnail: data.data.thumbnail || data.data.image };
        }
      }

      if (trackInfo && trackInfo.url) {
        const audioRes = await fetch(trackInfo.url);
        const blob = await audioRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        await localforage.setItem('temp_playing_blob', blob);
        
        const finalTrack = { ...trackInfo, url: objectUrl };
        setCurrentTrack(finalTrack);
        setIsPlaying(true);
        saveToHistory(finalTrack);
      }
    } catch (error) {
      console.error("Play error:", error);
      alert("Gagal memuat lagu. Periksa koneksi internet kamu.");
    } finally {
      setIsLoadingTrack(false);
    }
  };

  const importSpotifyPlaylist = async () => {
    if (!spotifyPlaylistUrl.trim()) return;
    setIsImportingSpotify(true);
    setImportSuccessData(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/spotify/playlist?url=${encodeURIComponent(spotifyPlaylistUrl)}`);
      if (!res.ok) throw new Error("Failed to fetch Spotify playlist");
      const data = await res.json();
      
      setImportProgress({ current: 0, total: data.tracks.length });
      const importedTracks: SearchResult[] = [];
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      for (let i = 0; i < data.tracks.length; i++) {
        const track = data.tracks[i];
        setImportProgress({ current: i + 1, total: data.tracks.length });
        try {
          const searchQuery = track.artist ? `${track.title} ${track.artist} (spotify)` : `${track.title} (spotify)`;
          const ytRes = await fetch(`${API_BASE_URL}/api/search/youtube?query=${encodeURIComponent(searchQuery)}`);
          const ytData = await ytRes.json();
          
          if (ytData && ytData.items && ytData.items.length > 0) {
            const firstResult = ytData.items[0];
            importedTracks.push({
              id: firstResult.id,
              title: track.title,
              user: track.artist,
              artwork_url: track.thumbnail || firstResult.thumbnail?.thumbnails?.[0]?.url || "",
              thumbnail: track.thumbnail || firstResult.thumbnail?.thumbnails?.[0]?.url || "",
              permalink_url: `https://www.youtube.com/watch?v=${firstResult.id}`,
              duration: track.duration,
              permalink: firstResult.id
            });
          }
          await delay(800);
        } catch (err) {}
      }
      
      if (importedTracks.length > 0) {
        const newPlaylist: Playlist = {
          id: `spotify_${Date.now()}`,
          name: data.name,
          artwork_url: data.artwork_url,
          tracks: importedTracks
        };
        setPlaylists(prev => [...prev, newPlaylist]);
        setImportSuccessData({ name: data.name, count: importedTracks.length, total: data.tracks.length });
        setIsSpotifyImportModalOpen(false);
        setSpotifyPlaylistUrl('');
      }
    } catch (error) {
      alert("Gagal mengimpor playlist Spotify.");
    } finally {
      setIsImportingSpotify(false);
    }
  };

  const fetchLyrics = async (title: string, artist?: string) => {
    setIsLoadingLyrics(true);
    setLyrics(null);
    try {
      const cleanTitle = title.replace(/\(official.*\)|\[official.*\]|\(lyrics.*\)|\[lyrics.*\]/gi, '').trim();
      const searchQuery = artist ? `${cleanTitle} ${artist}` : cleanTitle;
      
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const trackWithLyrics = data.find((t: any) => t.plainLyrics);
        if (trackWithLyrics) setLyrics(trackWithLyrics.plainLyrics);
        else setLyrics("Lirik tersedia tapi formatnya tidak didukung.");
      } else {
        if (artist) {
          const resFallback = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`);
          const dataFallback = await resFallback.json();
          const fallbackTrack = dataFallback.find((t: any) => t.plainLyrics);
          if (fallbackTrack) {
            setLyrics(fallbackTrack.plainLyrics);
            return;
          }
        }
        setLyrics("Lirik tidak ditemukan untuk lagu ini.");
      }
    } catch (error) {
      setLyrics("Gagal memuat lirik.");
    } finally {
      setIsLoadingLyrics(false);
    }
  };

  const downloadTrack = async (e: React.MouseEvent, track: SearchResult | TrackDetails) => {
    e.stopPropagation();
    if (!track.permalink_url) return;
    const permalink_url = track.permalink_url;
    setDownloadingTracks(prev => new Set(prev).add(permalink_url));
    
    try {
      const isYouTube = permalink_url.includes('youtube.com') || permalink_url.includes('youtu.be');
      const endpoint = isYouTube ? 'youtube' : 'external';
      
      const res = await fetch(`${API_BASE_URL}/api/download/${endpoint}?url=${encodeURIComponent(permalink_url)}`);
      const data = await res.json();
      
      let metadata: any = null;
      if (isYouTube) {
        if (data && data.status === 'ok' && data.link) {
          metadata = { title: data.title || track.title, url: data.link, user: data.user || "YouTube Music", thumbnail: data.thumbnail || track.thumbnail, permalink_url: permalink_url };
        }
      } else {
        if (data.status && data.data) {
          metadata = { ...data.data, user: data.data.user || getArtistFromUrl(permalink_url), permalink_url: permalink_url, thumbnail: data.data.thumbnail || data.data.artwork_url || data.data.image };
        }
      }

      if (!metadata || !metadata.url) throw new Error("Failed to get download URL");
      
      const audioRes = await fetch(metadata.url);
      const blob = await audioRes.blob();
      
      await localforage.setItem(`track_${permalink_url}`, { metadata, blob });
      await loadDownloadedTracks();
    } catch (error) {
      alert("Gagal mengunduh lagu.");
    } finally {
      setDownloadingTracks(prev => {
        const next = new Set(prev);
        next.delete(permalink_url);
        return next;
      });
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const savedHistory: any = await localforage.getItem('soundstream_history');
        if (Array.isArray(savedHistory)) setHistory(savedHistory);
      } else {
        const res = await fetch(`${API_BASE_URL}/api/history`);
        const data = await res.json();
        if (Array.isArray(data)) setHistory(data);
      }
    } catch (error) {} finally {
      setIsLoadingHistory(false);
    }
  };

  const saveToHistory = async (track: TrackDetails) => {
    try {
      const newEntry = { ...track, played_at: new Date().toISOString() };
      setHistory(prev => {
        const filtered = prev.filter(t => t.permalink_url !== track.permalink_url);
        const updated = [newEntry, ...filtered].slice(0, 50);
        if (Capacitor.isNativePlatform()) {
          localforage.setItem('soundstream_history', updated);
        }
        return updated;
      });

      if (!Capacitor.isNativePlatform()) {
        fetch(`${API_BASE_URL}/api/history`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(track)
        }).catch(() => {});
      }
    } catch (e) {}
  };

  const clearHistory = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Riwayat?",
      message: "Semua daftar lagu yang baru saja diputar akan dihapus.",
      onConfirm: async () => {
        if (Capacitor.isNativePlatform()) {
          await localforage.removeItem('soundstream_history');
        } else {
          await fetch(`${API_BASE_URL}/api/history`, { method: 'DELETE' });
        }
        setHistory([]);
      }
    });
  };

  const loadDownloadedTracks = async () => {
    try {
      const keys = await localforage.keys();
      const tracks: TrackDetails[] = [];
      for (const key of keys) {
        if (key.startsWith('track_')) {
          const item: any = await localforage.getItem(key);
          if (item && item.metadata) tracks.push(item.metadata);
        }
      }
      setDownloadedTracks(tracks);
    } catch (e) {}
  };

  const removeDownload = async (e: React.MouseEvent, permalink_url: string) => {
    e.stopPropagation();
    try {
      await localforage.removeItem(`track_${permalink_url}`);
      await loadDownloadedTracks();
    } catch (error) {}
  };

  const toggleShuffle = () => {
    setIsShuffle(!isShuffle);
    if (!isShuffle) {
      setShuffledQueue([...queue].sort(() => Math.random() - 0.5));
    }
  };

  const toggleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  const playPlaylist = (playlist: Playlist) => {
    setQueue(playlist.tracks);
    setShuffledQueue([...playlist.tracks].sort(() => Math.random() - 0.5));
    setQueueIndex(0);
    playTrack(playlist.tracks[0].permalink_url, playlist.tracks[0]);
  };

  const createPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      tracks: [],
      artwork_url: ''
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    setNewPlaylistName('');
    if (trackToAdd) {
      const updatedPlaylists = [...playlists, newPlaylist].map(p => {
        if (p.id === newPlaylist.id) {
          return { ...p, tracks: [trackToAdd] };
        }
        return p;
      });
      setPlaylists(updatedPlaylists);
      setIsAddModalOpen(false);
      setTrackToAdd(null);
    } else {
      setIsAddModalOpen(false);
    }
  };

  const addToPlaylist = (playlistId: string, track: SearchResult) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        if (p.tracks.some(t => t.permalink_url === track.permalink_url)) return p;
        return { ...p, tracks: [...p.tracks, track] };
      }
      return p;
    }));
    setIsAddModalOpen(false);
    setTrackToAdd(null);
  };

  const removeFromPlaylist = (playlistId: string, permalink_url: string) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        return { ...p, tracks: p.tracks.filter(t => t.permalink_url !== permalink_url) };
      }
      return p;
    }));
    if (activePlaylist && activePlaylist.id === playlistId) {
      setActivePlaylist({
        ...activePlaylist,
        tracks: activePlaylist.tracks.filter(t => t.permalink_url !== permalink_url)
      });
    }
  };

  const updatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistToEdit) return;
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistToEdit.id) {
        return { ...p, name: editPlaylistName, artwork_url: editPlaylistImage };
      }
      return p;
    }));
    setIsEditPlaylistModalOpen(false);
    if (activePlaylist && activePlaylist.id === playlistToEdit.id) {
      setActivePlaylist({ ...activePlaylist, name: editPlaylistName, artwork_url: editPlaylistImage });
    }
  };

  const deletePlaylist = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Playlist?",
      message: "Tindakan ini tidak bisa dibatalkan.",
      onConfirm: () => {
        setPlaylists(prev => prev.filter(p => p.id !== id));
        if (activePlaylist && activePlaylist.id === id) setActivePlaylist(null);
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setEditPlaylistImage(data.data.url);
      }
    } catch (error) {} finally {
      setIsUploadingImage(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const shareTrack = async (track: any) => {
    const trackData = {
      t: track.title,
      u: track.user,
      a: track.artwork_url || track.thumbnail,
      d: track.duration,
      p: track.permalink_url
    };
    const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(trackData))));
    const shareUrl = `https://musicplayer-updt.vercel.app/?track=${encodedData}`;
    if (navigator.share) {
      try { await navigator.share({ title: track.title, url: shareUrl }); } catch (e) {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link lagu berhasil disalin!");
    }
  };

  const sharePlaylist = async (playlist: Playlist) => {
    const playlistData = {
      n: playlist.name,
      a: playlist.artwork_url,
      t: playlist.tracks.map(t => ({
        p: t.permalink_url,
        t: t.title,
        u: t.user,
        a: t.artwork_url,
        d: t.duration
      }))
    };
    const encodedData = btoa(unescape(encodeURIComponent(JSON.stringify(playlistData))));
    const shareUrl = `https://musicplayer-updt.vercel.app/?share=${encodedData}`;
    if (navigator.share) {
      try { await navigator.share({ title: playlist.name, url: shareUrl }); } catch (e) {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      alert("Link playlist berhasil disalin!");
    }
  };

  const playNext = () => {
    const currentQueue = isShuffle ? shuffledQueue : queue;
    if (currentQueue.length > 0) {
      let nextIndex = queueIndex + 1;
      if (nextIndex >= currentQueue.length) {
        if (repeatMode === 'all') nextIndex = 0;
        else { setIsPlaying(false); return; }
      }
      setQueueIndex(nextIndex);
      playTrack(currentQueue[nextIndex].permalink_url, currentQueue[nextIndex]);
    }
  };

  const playPrevious = () => {
    const currentQueue = isShuffle ? shuffledQueue : queue;
    if (currentQueue.length > 0) {
      let prevIndex = queueIndex - 1;
      if (prevIndex < 0) {
        if (repeatMode === 'all') prevIndex = currentQueue.length - 1;
        else prevIndex = 0;
      }
      setQueueIndex(prevIndex);
      playTrack(currentQueue[prevIndex].permalink_url, currentQueue[prevIndex]);
    }
  };

  const getArtistFromUrl = (url: string) => {
    const match = url.match(/soundcloud\.com\/([^/]+)/);
    return match ? match[1].replace(/-/g, ' ') : "Unknown Artist";
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans overflow-hidden">
      <header className="px-6 py-4 sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-2 text-emerald-500 font-bold text-xl">
          <Music className="w-7 h-7" />
          <span>SoundStream</span>
        </div>
        <div className="flex items-center gap-4">
          {!isOnline && (
            <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Offline</span>
            </div>
          )}
          <button 
            className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"
            onClick={() => {
              setActiveTab('library');
              setLibraryTab('history');
            }}
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-6 space-y-8">
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
                    Trending Today
                  </h2>
                </div>
                
                {isLoadingTrending ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="space-y-3">
                        <div className="aspect-square bg-zinc-900 rounded-2xl animate-pulse" />
                        <div className="h-4 bg-zinc-900 rounded-full w-3/4 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {trendingResults.slice(0, 5).map((track, i) => (
                      <motion.div 
                        key={track.permalink_url}
                        whileHover={{ y: -5 }}
                        onClick={() => {
                          setQueue(trendingResults);
                          setQueueIndex(i);
                          playTrack(track.permalink_url, track);
                        }}
                        className="space-y-2 cursor-pointer group"
                      >
                        <div className="aspect-square rounded-2xl overflow-hidden relative shadow-lg">
                          <img src={track.thumbnail || "https://picsum.photos/seed/m/300/300"} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-10 h-10 fill-emerald-500 text-emerald-500" />
                          </div>
                        </div>
                        <h3 className="font-bold text-sm truncate group-hover:text-emerald-400 transition-colors">{track.title}</h3>
                        <p className="text-xs text-zinc-500 truncate">{track.user || track.artist}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>

              {history.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold mb-4">Recently Played</h2>
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                    {history.slice(0, 10).map((track, i) => (
                      <div key={i} onClick={() => playTrack(track.permalink_url!)} className="w-24 flex-shrink-0 space-y-2 cursor-pointer group">
                        <div className="relative">
                          <img src={track.thumbnail} alt="" className="w-24 h-24 rounded-xl object-cover shadow-md group-hover:brightness-75 transition-all" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-6 h-6 fill-white text-white" />
                          </div>
                        </div>
                        <p className="text-[10px] font-bold truncate text-center group-hover:text-emerald-400">{track.title}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-xl font-bold mb-4">More Hits</h2>
                <TrackList 
                  tracks={trendingResults.slice(5)} 
                  playTrack={playTrack} 
                  downloadedTracks={downloadedTracks}
                  removeDownload={removeDownload}
                  downloadTrack={downloadTrack}
                  downloadingTracks={downloadingTracks}
                  openAddModal={(e:any, t:any)=> {setTrackToAdd(t); setIsAddModalOpen(true);}}
                  shareTrack={shareTrack}
                  setConfirmModal={setConfirmModal}
                />
              </section>
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">Search</h2>
                <div className="flex bg-zinc-900 rounded-full p-1 border border-zinc-800">
                  {(['soundcloud', 'spotify'] as const).map(source => (
                    <button 
                      key={source}
                      onClick={() => setSearchSource(source)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${searchSource === source ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-500'}`}
                    >
                      {source}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSearch} className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  type="search" value={query} onChange={e => setQuery(e.target.value)} 
                  placeholder={`Cari musik di ${searchSource === 'spotify' ? 'YouTube' : 'SoundCloud'}...`}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500/50 rounded-2xl py-4 pl-12 pr-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20" 
                />
              </form>

              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                  <p className="font-medium">Searching the SoundStream...</p>
                </div>
              ) : isSelectingArtist ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-zinc-400">Versi mana yang kamu cari?</h3>
                    <button onClick={() => setIsSelectingArtist(false)} className="text-sm text-emerald-500 font-bold">Lewati</button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {metadataSuggestions.map((item, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => {
                          setQuery(`${item.title} ${item.artist}`);
                          handleSearch(undefined, `${item.title} ${item.artist}`);
                        }}
                        className="flex items-center gap-4 p-4 bg-zinc-900/50 hover:bg-zinc-800 rounded-3xl cursor-pointer group transition-all border border-zinc-800/50 hover:border-emerald-500/30"
                      >
                        <img src={item.artwork} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white truncate">{item.title}</h4>
                          <p className="text-zinc-500 text-sm truncate">{item.artist}</p>
                          <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-widest mt-1 opacity-60">{item.album}</p>
                        </div>
                        <div className="w-10 h-10 bg-zinc-800 group-hover:bg-emerald-500 rounded-full flex items-center justify-center transition-colors">
                          <ArrowLeft className="w-5 h-5 rotate-180 group-hover:text-zinc-950" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : results.length > 0 ? (
                <TrackList 
                  tracks={results} 
                  playTrack={playTrack} 
                  downloadedTracks={downloadedTracks}
                  removeDownload={removeDownload}
                  downloadTrack={downloadTrack}
                  downloadingTracks={downloadingTracks}
                  openAddModal={(e:any, t:any)=> {setTrackToAdd(t); setIsAddModalOpen(true);}}
                  shareTrack={shareTrack}
                  setConfirmModal={setConfirmModal}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {['Pop', 'Rock', 'Indie', 'Jazz', 'Electronic', 'Hip Hop'].map(genre => (
                    <div 
                      key={genre} onClick={() => { setQuery(genre); handleSearch(); }}
                      className="h-24 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl p-4 font-bold text-lg flex items-end cursor-pointer hover:from-zinc-700 hover:to-zinc-800 transition-all border border-zinc-800/50"
                    >
                      {genre}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">Library</h2>
                <button onClick={() => setIsAddModalOpen(true)} className="p-2 bg-emerald-500 text-zinc-950 rounded-full shadow-lg shadow-emerald-500/20"><Plus className="w-6 h-6" /></button>
              </div>

              <div className="flex border-b border-zinc-900 overflow-x-auto no-scrollbar">
                {(['playlists', 'downloads', 'history'] as const).map(tab => (
                  <button 
                    key={tab} onClick={() => setLibraryTab(tab)}
                    className={`px-4 py-3 font-medium capitalize border-b-2 transition-colors flex-shrink-0 ${libraryTab === tab ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-zinc-500'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                {libraryTab === 'playlists' && (
                  <div className="space-y-6">
                    {activePlaylist ? (
                      <div className="space-y-6">
                        <div className="flex gap-6 items-end">
                          <img src={activePlaylist.artwork_url || activePlaylist.tracks[0]?.artwork_url || activePlaylist.tracks[0]?.thumbnail || "https://picsum.photos/seed/p/300/300"} alt="" className="w-32 h-32 rounded-3xl object-cover shadow-2xl" />
                          <div className="flex-1">
                            <button onClick={() => setActivePlaylist(null)} className="flex items-center gap-1 text-xs text-zinc-500 mb-2 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /> Back to list</button>
                            <h3 className="text-3xl font-bold mb-2">{activePlaylist.name}</h3>
                            <div className="flex gap-2">
                              <button onClick={() => playPlaylist(activePlaylist)} className="bg-emerald-500 text-zinc-950 px-6 py-2 rounded-full font-bold flex items-center gap-2 active:scale-95 transition-transform"><Play className="w-4 h-4 fill-current" /> Play All</button>
                              <button onClick={() => sharePlaylist(activePlaylist)} className="p-2 bg-zinc-900 rounded-full text-emerald-500 border border-zinc-800"><Share2 className="w-5 h-5" /></button>
                              <button onClick={() => deletePlaylist(activePlaylist.id)} className="p-2 bg-zinc-900 rounded-full text-red-500 border border-zinc-800"><Trash2 className="w-5 h-5" /></button>
                            </div>
                          </div>
                        </div>
                        <TrackList 
                          tracks={activePlaylist.tracks} 
                          playTrack={playTrack} 
                          downloadedTracks={downloadedTracks}
                          removeDownload={removeDownload}
                          downloadTrack={downloadTrack}
                          downloadingTracks={downloadingTracks}
                          openAddModal={(e:any, t:any)=> {setTrackToAdd(t); setIsAddModalOpen(true);}}
                          shareTrack={shareTrack}
                          setConfirmModal={setConfirmModal}
                          showRemove 
                          playlistId={activePlaylist.id} 
                          removeFromPlaylist={removeFromPlaylist} 
                        />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex gap-3">
                          <button onClick={() => setIsAddModalOpen(true)} className="flex-1 py-4 border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-500 flex items-center justify-center gap-2 hover:bg-zinc-900 hover:border-zinc-700 transition-all group">
                            <Plus className="w-5 h-5 group-hover:text-emerald-500 transition-colors" />
                            <span className="font-bold">Buat Baru</span>
                          </button>
                          <button onClick={() => setIsSpotifyImportModalOpen(true)} className="flex-1 py-4 border-2 border-dashed border-emerald-900/30 rounded-3xl text-emerald-600 flex items-center justify-center gap-2 hover:bg-emerald-950/20 hover:border-emerald-500/50 transition-all group">
                            <Music className="w-5 h-5 group-hover:text-emerald-500 transition-colors" />
                            <span className="font-bold">Impor Spotify</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {playlists.map(playlist => (
                            <motion.div 
                              key={playlist.id} whileTap={{ scale: 0.95 }} onClick={() => setActivePlaylist(playlist)}
                              className="p-4 bg-zinc-900/40 rounded-3xl cursor-pointer hover:bg-zinc-900 transition-all border border-transparent hover:border-zinc-800 group"
                            >
                              <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-800 mb-3 shadow-md">
                                <img src={playlist.artwork_url || playlist.tracks[0]?.artwork_url || playlist.tracks[0]?.thumbnail || "https://picsum.photos/seed/p/300/300"} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              </div>
                              <h4 className="font-bold truncate">{playlist.name}</h4>
                              <p className="text-xs text-zinc-500">{playlist.tracks.length} songs</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {libraryTab === 'downloads' && (
                  <div className="space-y-4">
                    {downloadedTracks.length > 0 ? (
                      <TrackList 
                        tracks={downloadedTracks} 
                        playTrack={playTrack} 
                        downloadedTracks={downloadedTracks}
                        removeDownload={removeDownload}
                        downloadTrack={downloadTrack}
                        downloadingTracks={downloadingTracks}
                        openAddModal={(e:any, t:any)=> {setTrackToAdd(t); setIsAddModalOpen(true);}}
                        shareTrack={shareTrack}
                        setConfirmModal={setConfirmModal}
                      />
                    ) : (
                      <div className="py-20 text-center text-zinc-500">
                        <HardDriveDownload className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No offline songs found.</p>
                      </div>
                    )}
                  </div>
                )}

                {libraryTab === 'history' && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <button onClick={clearHistory} className="text-xs text-zinc-500 hover:text-red-500 transition-colors flex items-center gap-1"><Trash2 className="w-4 h-4" /> Clear History</button>
                    </div>
                    {history.length > 0 ? (
                      <TrackList 
                        tracks={history} 
                        playTrack={playTrack} 
                        downloadedTracks={downloadedTracks}
                        removeDownload={removeDownload}
                        downloadTrack={downloadTrack}
                        downloadingTracks={downloadingTracks}
                        openAddModal={(e:any, t:any)=> {setTrackToAdd(t); setIsAddModalOpen(true);}}
                        shareTrack={shareTrack}
                        setConfirmModal={setConfirmModal}
                      />
                    ) : (
                      <div className="py-20 text-center text-zinc-500"><History className="w-12 h-12 mx-auto mb-4 opacity-20" /><p>Your listening history is empty.</p></div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {currentTrack && !isPlayerExpanded && (
        <motion.div 
          initial={{ y: 100 }} animate={{ y: 0 }} 
          className="fixed bottom-[72px] left-2 right-2 z-50 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-2xl flex items-center gap-3 active:scale-[0.98] transition-transform"
          onClick={() => setIsPlayerExpanded(true)}
        >
          <img src={currentTrack.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover shadow-lg" />
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm truncate text-white">{currentTrack.title}</h4>
            <p className="text-xs text-emerald-500 truncate font-medium">{currentTrack.user}</p>
          </div>
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={playPrevious} className="p-2 text-zinc-400 hover:text-white"><SkipBack className="w-5 h-5 fill-current" /></button>
            <button onClick={togglePlay} className="p-2 text-white bg-zinc-800 rounded-full h-10 w-10 flex items-center justify-center">
              {isLoadingTrack ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
            <button onClick={playNext} className="p-2 text-zinc-400 hover:text-white"><SkipForward className="w-5 h-5 fill-current" /></button>
          </div>
          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${(progress / duration) * 100}%` }} />
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {isPlayerExpanded && currentTrack && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col p-8 sm:p-12 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />
            <div className="relative flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
              <div className="w-full flex justify-between items-center mb-8">
                <button onClick={() => setIsPlayerExpanded(false)} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><ArrowLeft className="w-6 h-6 rotate-[-90deg]" /></button>
                <div className="text-center">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Now Playing</p>
                  <p className="text-sm font-bold truncate max-w-[200px] text-white/90">{currentTrack.title}</p>
                </div>
                <button onClick={() => { setIsPlayerExpanded(false); setActiveTab('library'); }} className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><ListMusic className="w-6 h-6" /></button>
              </div>

              <div className="relative w-full aspect-square mb-10 group">
                <motion.img 
                  animate={{ scale: isPlaying ? 1 : 0.9, rotate: isPlaying ? 0 : -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  src={currentTrack.thumbnail} alt="" className="w-full h-full rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] object-cover z-10 relative" 
                />
                <div className={`absolute inset-0 bg-emerald-500/20 rounded-[2.5rem] blur-3xl transition-opacity duration-1000 ${isPlaying ? 'opacity-100 animate-pulse' : 'opacity-0'}`} />
              </div>

              <div className="text-center space-y-2 mb-10 w-full px-4">
                <h2 className="text-3xl sm:text-4xl font-black text-white line-clamp-1">{currentTrack.title}</h2>
                <p className="text-xl text-emerald-400 font-bold opacity-80">{currentTrack.user}</p>
              </div>

              <div className="w-full space-y-3 mb-10">
                <div 
                  className="h-2 bg-zinc-800 rounded-full relative overflow-hidden cursor-pointer group"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const p = (e.clientX - rect.left) / rect.width;
                    if(audioRef.current) audioRef.current.currentTime = p * duration;
                  }}
                >
                  <div className="h-full bg-emerald-500 relative transition-all" style={{ width: `${(progress / duration) * 100}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-zinc-500 font-black tracking-tighter">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between w-full max-w-sm mb-12">
                <button onClick={toggleShuffle} className={`p-2 transition-colors ${isShuffle ? 'text-emerald-500' : 'text-zinc-600'}`}><Shuffle className="w-6 h-6" /></button>
                <button onClick={playPrevious} className="text-white hover:text-emerald-400 transition-colors"><SkipBack className="w-10 h-10 fill-current" /></button>
                <button 
                  onClick={togglePlay} 
                  className="w-24 h-24 bg-white text-black rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-90 transition-all"
                >
                  {isPlaying ? <Pause className="w-12 h-12 fill-current" /> : <Play className="w-12 h-12 fill-current ml-2" />}
                </button>
                <button onClick={playNext} className="text-white hover:text-emerald-400 transition-colors"><SkipForward className="w-10 h-10 fill-current" /></button>
                <button onClick={toggleRepeat} className={`p-2 transition-colors ${repeatMode !== 'off' ? 'text-emerald-500' : 'text-zinc-600'}`}>
                  {repeatMode === 'one' ? <Repeat1 className="w-6 h-6" /> : <Repeat className="w-6 h-6" />}
                </button>
              </div>

              <div className="flex justify-around w-full bg-zinc-900/50 backdrop-blur-xl py-6 rounded-[2.5rem] border border-white/5">
                <button onClick={() => { if(!lyrics) fetchLyrics(currentTrack.title, currentTrack.user); setIsLyricsOpen(true); }} className={`flex flex-col items-center gap-1.5 transition-colors ${isLyricsOpen ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}>
                  <Mic2 className="w-6 h-6" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Lyrics</span>
                </button>
                <button onClick={() => shareTrack(currentTrack)} className="flex flex-col items-center gap-1.5 text-zinc-500 hover:text-white transition-colors">
                  <Share2 className="w-6 h-6" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Share</span>
                </button>
                <button onClick={() => setIsBassBoost(!isBassBoost)} className={`flex flex-col items-center gap-1.5 transition-colors ${isBassBoost ? 'text-emerald-500' : 'text-zinc-500 hover:text-white'}`}>
                  <Zap className="w-6 h-6" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Boost</span>
                </button>
                <button onClick={(e) => downloadTrack(e, currentTrack)} className="flex flex-col items-center gap-1.5 text-zinc-500 hover:text-white transition-colors">
                  {downloadingTracks.has(currentTrack.permalink_url!) ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
                  <span className="text-[8px] font-black uppercase tracking-widest">Offline</span>
                </button>
              </div>
            </div>

            <AnimatePresence>
              {isLyricsOpen && (
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="absolute inset-0 bg-zinc-950/98 z-[70] p-8 flex flex-col">
                  <div className="flex justify-between items-center mb-10">
                    <div>
                      <h3 className="text-2xl font-black text-white">Lyrics</h3>
                      <p className="text-zinc-500 text-sm">{currentTrack.title}</p>
                    </div>
                    <button onClick={() => setIsLyricsOpen(false)} className="p-3 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
                    {isLoadingLyrics ? (
                      <div className="h-full flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-emerald-500" /></div>
                    ) : (
                      <p className="text-3xl sm:text-4xl font-black leading-tight whitespace-pre-wrap text-white/90 selection:bg-emerald-500/30">
                        {lyrics || "Lyrics not found for this track."}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900/50 px-6 py-3 flex justify-between items-center z-50">
        <NavButton active={activeTab === 'home'} icon={<Music />} label="Home" onClick={() => setActiveTab('home')} />
        <NavButton active={activeTab === 'search'} icon={<Search />} label="Search" onClick={() => setActiveTab('search')} />
        <NavButton active={activeTab === 'library'} icon={<ListMusic />} label="Library" onClick={() => setActiveTab('library')} />
      </nav>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6" onClick={() => setIsAddModalOpen(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-zinc-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Plus className="text-emerald-500" /> Add to Playlist</h3>
            <div className="space-y-3 mb-8 max-h-60 overflow-y-auto no-scrollbar pr-2">
              {playlists.map(p => (
                <button key={p.id} onClick={() => trackToAdd && addToPlaylist(p.id, trackToAdd)} className="w-full p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-2xl font-bold text-left transition-colors border border-transparent hover:border-emerald-500/30">
                  {p.name}
                </button>
              ))}
            </div>
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 px-1">Atau Buat Baru</p>
              <form onSubmit={createPlaylist} className="flex gap-2">
                <input value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="Nama playlist..." className="flex-1 bg-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                <button type="submit" className="bg-emerald-500 text-zinc-950 p-3 rounded-xl hover:bg-emerald-400 transition-colors shadow-lg"><Plus className="w-6 h-6" /></button>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {isSpotifyImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-zinc-800">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-zinc-950"><Music className="w-6 h-6" /></div><h3 className="text-2xl font-bold">Impor Spotify</h3></div>
              {!isImportingSpotify && <button onClick={() => setIsSpotifyImportModalOpen(false)} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors"><X className="w-5 h-5" /></button>}
            </div>
            {isImportingSpotify ? (
              <div className="space-y-8 py-4">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative"><div className="w-24 h-24 border-4 border-emerald-500/10 rounded-full" /><div className="absolute inset-0 w-24 h-24 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /><Music className="absolute inset-0 m-auto w-10 h-10 text-emerald-500 animate-pulse" /></div>
                  <div className="text-center"><p className="text-lg font-bold">Sedang mengimpor lagu...</p><p className="text-emerald-500 font-mono text-sm">{importProgress.current} / {importProgress.total}</p></div>
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden"><motion.div className="h-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }} /></div>
                  <p className="text-[10px] text-zinc-500 text-center uppercase font-black">Mohon jangan tutup aplikasi</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-zinc-400 text-sm leading-relaxed">Tempelkan link playlist Spotify publik Anda di bawah. Kami akan mencari versi YouTube-nya secara otomatis.</p>
                <div className="space-y-4">
                  <input value={spotifyPlaylistUrl} onChange={e => setSpotifyPlaylistUrl(e.target.value)} placeholder="https://open.spotify.com/playlist/..." className="w-full bg-zinc-800 border border-zinc-700 focus:border-emerald-500/50 rounded-xl py-4 px-4 text-zinc-100" />
                  <button onClick={importSpotifyPlaylist} disabled={!spotifyPlaylistUrl.includes('spotify.com')} className="w-full bg-emerald-500 text-zinc-950 py-4 rounded-xl font-bold active:scale-95 transition-all disabled:opacity-50">Mulai Impor</button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {importSuccessData && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 rounded-[3rem] p-10 w-full max-w-md shadow-2xl border border-emerald-500/20 text-center space-y-8 relative overflow-hidden">
            <div className="relative">
              <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.4)]"><CheckCircle2 className="w-12 h-12 text-zinc-950" /></div>
              <div className="mt-8 space-y-3"><h3 className="text-3xl font-bold text-white">Impor Selesai!</h3><p className="text-zinc-400">Playlist <span className="text-emerald-400 font-bold">"{importSuccessData.name}"</span> berhasil dibuat.</p></div>
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="bg-zinc-800/50 p-4 rounded-3xl border border-zinc-700"><p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Berhasil</p><p className="text-2xl font-black text-emerald-500">{importSuccessData.count}</p></div>
                <div className="bg-zinc-800/50 p-4 rounded-3xl border border-zinc-700"><p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Total</p><p className="text-2xl font-black text-white">{importSuccessData.total}</p></div>
              </div>
              <button onClick={() => { setImportSuccessData(null); setActiveTab('library'); setLibraryTab('playlists'); }} className="w-full mt-10 bg-white text-black py-5 rounded-[2rem] font-bold text-lg active:scale-95 transition-all">Lihat Playlist</button>
            </div>
          </motion.div>
        </div>
      )}

      {confirmModal?.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-900 p-8 rounded-[2.5rem] w-full max-w-xs text-center space-y-6 border border-zinc-800 shadow-2xl">
            <h3 className="text-xl font-bold text-white">{confirmModal.title}</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 bg-zinc-800 rounded-2xl font-bold text-zinc-400 hover:bg-zinc-700 transition-colors">Batal</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">Hapus</button>
            </div>
          </div>
        </div>
      )}

      {isLoadingTrack && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-8 gap-6">
          <div className="relative"><div className="w-24 h-24 border-4 border-emerald-500/10 rounded-full" /><div className="absolute inset-0 w-24 h-24 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /><Music className="absolute inset-0 m-auto w-10 h-10 text-emerald-500 animate-pulse" /></div>
          <div className="text-center space-y-2"><h3 className="text-2xl font-black text-white">Menyiapkan Lagu...</h3><p className="text-xs text-zinc-500 uppercase tracking-[0.2em] font-black">SoundStream AI Optimizer</p></div>
        </div>
      )}

      <audio 
        ref={audioRef} 
        src={currentTrack?.url} 
        crossOrigin="anonymous" 
        onTimeUpdate={() => { if(audioRef.current) setProgress(audioRef.current.currentTime); }} 
        onEnded={playNext} 
        onLoadedMetadata={() => { if(audioRef.current) setDuration(audioRef.current.duration); }} 
      />
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
      <motion.div animate={{ scale: active ? 1.2 : 1, y: active ? -2 : 0 }}>{icon}</motion.div>
      <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'opacity-100' : 'opacity-50'}`}>{label}</span>
    </button>
  );
}

const TrackList = ({ tracks, playTrack, downloadedTracks, removeDownload, downloadTrack, downloadingTracks, openAddModal, shareTrack, setConfirmModal, showRemove, playlistId, removeFromPlaylist }: any) => (
  <div className="space-y-2">
    {tracks.map((track: any, i: number) => (
      <motion.div 
        key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
        onClick={() => playTrack(track.permalink_url, track)} 
        className="flex items-center gap-4 p-2 hover:bg-zinc-900/50 rounded-2xl cursor-pointer group transition-all"
      >
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 relative flex-shrink-0 shadow-md">
          <img src={track.artwork_url || track.thumbnail || "https://picsum.photos/seed/m/100/100"} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-5 h-5 fill-white text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-xs truncate text-zinc-100 group-hover:text-emerald-400 transition-colors">{track.title}</h4>
          <p className="text-[10px] text-zinc-500 truncate font-medium">{track.user || track.artist}</p>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {downloadedTracks.some((d:any)=>d.permalink_url === track.permalink_url) ? (
            <button onClick={(e) => setConfirmModal({ isOpen: true, title: "Hapus Offline?", message: "Lagu ini akan dihapus dari penyimpanan perangkat.", onConfirm: () => removeDownload(e, track.permalink_url) })} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button>
          ) : (
            <button onClick={(e) => downloadTrack(e, track)} className="p-2 text-zinc-700 hover:text-emerald-500 transition-colors">
              {downloadingTracks.has(track.permalink_url) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </button>
          )}
          <button onClick={() => shareTrack(track)} className="p-2 text-zinc-700 hover:text-white transition-colors"><Share2 className="w-4 h-4" /></button>
          {showRemove ? (
            <button onClick={() => removeFromPlaylist(playlistId, track.permalink_url)} className="p-2 text-zinc-700 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
          ) : (
            <button onClick={(e) => openAddModal(e, track)} className="p-2 text-zinc-700 hover:text-emerald-500 transition-colors"><Plus className="w-4 h-4" /></button>
          )}
        </div>
      </motion.div>
    ))}
  </div>
);
