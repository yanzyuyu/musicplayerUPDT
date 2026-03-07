import React, { useState, useRef, useEffect } from 'react';
import { Search, Play, Pause, Volume2, Loader2, Music, SkipBack, SkipForward, Mic2, X, Plus, ListMusic, Trash2, ArrowLeft, History, Repeat, Repeat1, Shuffle, Download, CheckCircle2, HardDriveDownload, Flame, Edit3, Image as ImageIcon, Upload, Zap, Share2 } from 'lucide-react';
import localforage from 'localforage';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';
import { BatteryOptimization } from '@capawesome-team/capacitor-android-battery-optimization';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { motion, AnimatePresence } from 'framer-motion';

// Ganti dengan API Key ImgBB Anda
const IMGBB_API_KEY = 'e18b5fb620e522fb9405cada79e56652'; // Contoh key, silakan ganti jika perlu

interface SearchResult {
  genre?: string;
  created_at?: string;
  duration?: number;
  permalink: string;
  comment_count?: number;
  artwork_url?: string;
  permalink_url: string;
  playback_count?: number;
  title?: string;
  user?: string;
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

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [trendingResults, setTrendingResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingTrending, setIsLoadingTrending] = useState(false);
  
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
  
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'library'>('home');
  const [isBassBoost, setIsBassBoost] = useState(false);
  const [libraryTab, setLibraryTab] = useState<'playlists' | 'downloads' | 'history'>('playlists');
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditPlaylistModalOpen, setIsEditPlaylistModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [sharedPlaylistData, setSharedPlaylistData] = useState<Playlist | null>(null);
  const [playlistToEdit, setPlaylistToEdit] = useState<Playlist | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistImage, setEditPlaylistImage] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
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
      } catch (e) {
        console.error('Failed to update foreground service info', e);
      }
    }
  };

  useEffect(() => {
    startForeground();
  }, [isPlaying, currentTrack]);

  const sharePlaylist = async (playlist: Playlist) => {
    try {
      const data = {
        n: playlist.name,
        a: playlist.artwork_url,
        t: playlist.tracks.map(t => ({
          p: t.permalink_url,
          t: t.title,
          u: t.user,
          a: t.artwork_url || t.thumbnail,
          d: t.duration
        }))
      };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      const shareUrl = `https://musicplayer-updt.vercel.app/?share=${encoded}`;
      
      if (navigator.share) {
        await navigator.share({
          title: `Playlist: ${playlist.name}`,
          text: `Cek playlist "${playlist.name}" di SoundStream!`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link playlist berhasil disalin ke clipboard!");
      }
    } catch (e) {
      console.error("Sharing failed", e);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('share');
    if (sharedData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(sharedData))));
        const playlist: Playlist = {
          id: `shared_${Date.now()}`,
          name: decoded.n,
          artwork_url: decoded.a,
          tracks: decoded.t.map((t: any) => ({
            permalink_url: t.p,
            title: t.t,
            user: t.u,
            artwork_url: t.a,
            thumbnail: t.a,
            duration: t.d,
            permalink: t.p.split('/').pop() || ''
          }))
        };
        setSharedPlaylistData(playlist);
        setIsImportModalOpen(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error("Failed to parse shared playlist", e);
      }
    }

    const initApp = async () => {
      try {
        if (Capacitor.getPlatform() === 'android') {
          await ForegroundService.requestPermissions();
          const { enabled } = await BatteryOptimization.isBatteryOptimizationEnabled();
          if (enabled) {
            await BatteryOptimization.requestIgnoreBatteryOptimization();
          }
          startForeground();
        }
        const status = await LocalNotifications.checkPermissions();
        if (status.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }
      } catch (e) {
        console.warn("Permissions not supported or failed", e);
      }
    };
    initApp();
    fetchTrending();
    fetchHistory();
    loadDownloadedTracks();
  }, []);

  const fetchTrending = async () => {
    setIsLoadingTrending(true);
    try {
      const res = await fetch(`https://api.siputzx.my.id/api/s/soundcloud?query=top%20hits%202026`);
      const data = await res.json();
      if (data.status && data.data) {
        const filtered = data.data.filter((t: any) => t.duration && t.duration > 0);
        setTrendingResults(filtered.slice(0, 15));
      }
    } catch (error) {
      console.error("Failed to fetch trending:", error);
    } finally {
      setIsLoadingTrending(false);
    }
  };

  const loadDownloadedTracks = async () => {
    try {
      const keys = await localforage.keys();
      const tracks: TrackDetails[] = [];
      for (const key of keys) {
        if (key.startsWith('track_')) {
          const item: any = await localforage.getItem(key);
          if (item && item.metadata) {
            tracks.push(item.metadata);
          }
        }
      }
      setDownloadedTracks(tracks);
    } catch (e) {
      console.error("Failed to load downloaded tracks", e);
    }
  };

  const getArtistFromUrl = (url: string) => {
    if (!url) return "Unknown Artist";
    try {
      const match = url.match(/soundcloud\.com\/([^/]+)/);
      if (match && match[1]) {
        return match[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      }
    } catch (e) {}
    return "Unknown Artist";
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setEditPlaylistImage(data.data.url);
      } else {
        alert("Gagal mengunggah gambar.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Terjadi kesalahan saat mengunggah.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const downloadTrack = async (e: React.MouseEvent, track: SearchResult | TrackDetails) => {
    e.stopPropagation();
    if (!track.permalink_url) return;
    setDownloadingTracks(prev => new Set(prev).add(track.permalink_url!));
    try {
      const metaRes = await fetch(`https://api.siputzx.my.id/api/d/soundcloud?url=${encodeURIComponent(track.permalink_url)}`);
      const metaData = await metaRes.json();
      if (!metaData.status || !metaData.data) throw new Error("Failed to fetch metadata");
      
      const artist = metaData.data.user || getArtistFromUrl(track.permalink_url);
      const metadata = { ...metaData.data, user: artist, permalink_url: track.permalink_url };
      
      const audioRes = await fetch(metadata.url);
      if (!audioRes.ok) throw new Error("Failed to fetch audio");
      const blob = await audioRes.blob();
      await localforage.setItem(`track_${track.permalink_url}`, { metadata, blob });
      await loadDownloadedTracks();
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download track.");
    } finally {
      setDownloadingTracks(prev => {
        const next = new Set(prev);
        next.delete(track.permalink_url!);
        return next;
      });
    }
  };

  const removeDownload = async (e: React.MouseEvent, permalink_url: string) => {
    e.stopPropagation();
    try {
      await localforage.removeItem(`track_${permalink_url}`);
      await loadDownloadedTracks();
    } catch (error) {
      console.error("Failed to remove download:", error);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const clearHistory = async () => {
    try {
      await fetch('/api/history', { method: 'DELETE' });
      setHistory([]);
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const initAudioContext = () => {
    if (!audioCtxRef.current && audioRef.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.value = 200;
        bassFilter.gain.value = isBassBoost ? 15 : 0;
        
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(bassFilter);
        bassFilter.connect(analyser);
        analyser.connect(ctx.destination);
        
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
        bassFilterRef.current = bassFilter;
      } catch (e) {
        console.error("Audio context init failed:", e);
      }
    }
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
  };

  useEffect(() => {
    if (bassFilterRef.current && audioCtxRef.current) {
      bassFilterRef.current.gain.setTargetAtTime(isBassBoost ? 15 : 0, audioCtxRef.current.currentTime, 0.1);
    }
  }, [isBassBoost]);

  useEffect(() => {
    if (!isPlaying || !analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.1)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };
    draw();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying, currentTrack, isPlayerExpanded]);

  const createPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      tracks: [],
      artwork_url: ''
    };
    const updatedPlaylists = [...playlists, newPlaylist];
    setPlaylists(updatedPlaylists);
    setNewPlaylistName('');
    if (trackToAdd) {
      addToPlaylist(newPlaylist.id, trackToAdd, updatedPlaylists);
    } else {
      setIsAddModalOpen(false);
    }
  };

  const updatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistToEdit || !editPlaylistName.trim()) return;
    const updatedPlaylists = playlists.map(p => {
      if (p.id === playlistToEdit.id) {
        return { ...p, name: editPlaylistName.trim(), artwork_url: editPlaylistImage.trim() };
      }
      return p;
    });
    setPlaylists(updatedPlaylists);
    setIsEditPlaylistModalOpen(false);
    setPlaylistToEdit(null);
    if (activePlaylist && activePlaylist.id === playlistToEdit.id) {
      setActivePlaylist({ ...activePlaylist, name: editPlaylistName.trim(), artwork_url: editPlaylistImage.trim() });
    }
  };

  const addToPlaylist = (playlistId: string, track: SearchResult, currentPlaylists = playlists) => {
    const updated = currentPlaylists.map(p => {
      if (p.id === playlistId) {
        if (!p.tracks.some(t => t.permalink_url === track.permalink_url)) {
          return { ...p, tracks: [...p.tracks, track] };
        }
      }
      return p;
    });
    setPlaylists(updated);
    setIsAddModalOpen(false);
    setTrackToAdd(null);
  };

  const removeFromPlaylist = (playlistId: string, trackUrl: string) => {
    const updated = playlists.map(p => {
      if (p.id === playlistId) return { ...p, tracks: p.tracks.filter(t => t.permalink_url !== trackUrl) };
      return p;
    });
    setPlaylists(updated);
    if (activePlaylist && activePlaylist.id === playlistId) {
      setActivePlaylist({ ...activePlaylist, tracks: activePlaylist.tracks.filter(t => t.permalink_url !== trackUrl) });
    }
  };

  const deletePlaylist = (playlistId: string) => {
    if (!confirm("Hapus playlist ini?")) return;
    const updated = playlists.filter(p => p.id !== playlistId);
    setPlaylists(updated);
    if (activePlaylist?.id === playlistId) setActivePlaylist(null);
  };

  const openAddModal = (e: React.MouseEvent, track: SearchResult | null) => {
    if (e) e.stopPropagation();
    setTrackToAdd(track);
    setIsAddModalOpen(true);
  };

  const openEditPlaylistModal = (e: React.MouseEvent, playlist: Playlist) => {
    e.stopPropagation();
    setPlaylistToEdit(playlist);
    setEditPlaylistName(playlist.name);
    setEditPlaylistImage(playlist.artwork_url || '');
    setIsEditPlaylistModalOpen(true);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`https://api.siputzx.my.id/api/s/soundcloud?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.status && data.data) {
        const filtered = data.data.filter((t: any) => t.duration && t.duration > 0);
        setResults(filtered);
      }
      else setResults([]);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchLyrics = async (title: string) => {
    setIsLoadingLyrics(true);
    setLyrics(null);
    try {
      const cleanTitle = title.replace(/\(.*\)|\[.*\]/g, '').replace(/original|cover|remix/gi, '').trim();
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const trackWithLyrics = data.find((t: any) => t.plainLyrics);
        setLyrics(trackWithLyrics ? trackWithLyrics.plainLyrics : "No lyrics found for this track.");
      } else setLyrics("No lyrics found for this track.");
    } catch (error) {
      console.error("Failed to fetch lyrics:", error);
      setLyrics("Failed to load lyrics.");
    } finally {
      setIsLoadingLyrics(false);
    }
  };

  const playTrack = async (permalink_url: string) => {
    setIsLoadingTrack(true);
    try {
      const offlineData: any = await localforage.getItem(`track_${permalink_url}`);
      if (offlineData && offlineData.blob) {
        const objectUrl = URL.createObjectURL(offlineData.blob);
        const trackWithLocalUrl = { ...offlineData.metadata, url: objectUrl };
        setCurrentTrack(trackWithLocalUrl);
        setIsPlaying(true);
        fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...offlineData.metadata, permalink_url })
        }).catch(console.error);
        if (isLyricsOpen) fetchLyrics(offlineData.metadata.title);
        else setLyrics(null);
        setIsLoadingTrack(false);
        return;
      }
      const res = await fetch(`https://api.siputzx.my.id/api/d/soundcloud?url=${encodeURIComponent(permalink_url)}`);
      const data = await res.json();
      if (data.status && data.data) {
        const artist = data.data.user || getArtistFromUrl(permalink_url);
        const trackWithArtist = { ...data.data, user: artist };
        setCurrentTrack(trackWithArtist);
        setIsPlaying(true);
        fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...trackWithArtist, permalink_url })
        }).catch(console.error);
        if (isLyricsOpen) fetchLyrics(data.data.title);
        else setLyrics(null);
      }
    } catch (error) {
      console.error("Play error:", error);
    } finally {
      setIsLoadingTrack(false);
    }
  };

  const playNext = () => {
    const activeQueue = isShuffle ? shuffledQueue : queue;
    if (activeQueue.length > 0) {
      let nextIndex = queueIndex + 1;
      if (nextIndex >= activeQueue.length) {
        if (repeatMode === 'all') nextIndex = 0;
        else return;
      }
      setQueueIndex(nextIndex);
      playTrack(activeQueue[nextIndex].permalink_url);
    }
  };

  const playPrevious = () => {
    const activeQueue = isShuffle ? shuffledQueue : queue;
    if (activeQueue.length > 0) {
      let prevIndex = queueIndex - 1;
      if (prevIndex < 0) {
        if (repeatMode === 'all') prevIndex = activeQueue.length - 1;
        else prevIndex = 0;
      }
      setQueueIndex(prevIndex);
      playTrack(activeQueue[prevIndex].permalink_url);
    }
  };

  const handleTrackEnd = () => {
    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      return;
    }
    const activeQueue = isShuffle ? shuffledQueue : queue;
    if (activeQueue.length > 0) {
      if (queueIndex < activeQueue.length - 1 || repeatMode === 'all') playNext();
      else setIsPlaying(false);
    } else setIsPlaying(false);
  };

  const toggleRepeat = () => setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');

  const toggleShuffle = () => {
    setIsShuffle(prev => {
      const newShuffle = !prev;
      if (newShuffle && queue.length > 0) {
        const shuffled = [...queue];
        let currentTrackItem = null;
        if (queueIndex >= 0 && queueIndex < queue.length) {
          currentTrackItem = queue[queueIndex];
          shuffled.splice(queueIndex, 1);
        }
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        if (currentTrackItem) {
          shuffled.unshift(currentTrackItem);
          setQueueIndex(0);
        }
        setShuffledQueue(shuffled);
      } else if (!newShuffle && queue.length > 0 && currentTrack) {
        const originalIndex = queue.findIndex(t => t.permalink_url === currentTrack.permalink_url);
        if (originalIndex !== -1) setQueueIndex(originalIndex);
      }
      return newShuffle;
    });
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (audioRef.current) {
      initAudioContext();
      if (isPlaying) {
        audioRef.current.pause();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      } else {
        audioRef.current.play();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (audioRef.current && currentTrack) {
      initAudioContext();
      audioRef.current.play().catch(e => console.error("Playback failed:", e));
      setIsPlaying(true);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.user,
          album: 'SoundStream',
          artwork: [{ src: currentTrack.thumbnail || 'https://picsum.photos/seed/music/512/512', sizes: '512x512', type: 'image/png' }]
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', () => togglePlay());
        navigator.mediaSession.setActionHandler('pause', () => togglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', playPrevious);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
            setProgress(details.seekTime);
          }
        });
      }
    }
  }, [currentTrack]);

  const isTrackInAnyPlaylist = currentTrack && playlists.some(p => 
    p.tracks.some(t => t.permalink_url === currentTrack.permalink_url)
  );

  const playPlaylist = (playlist: Playlist) => {
    if (playlist.tracks.length === 0) return;
    setQueue(playlist.tracks);
    setQueueIndex(0);
    playTrack(playlist.tracks[0].permalink_url);
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans overflow-hidden">
      {/* Header - Simplified */}
      <header className="px-6 py-4 flex items-center justify-between sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center gap-2 text-emerald-500 font-bold text-xl">
          <Music className="w-7 h-7" />
          <span className="tracking-tight">SoundStream</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 bg-zinc-900 rounded-full text-zinc-400" onClick={() => {setActiveTab('library'); setLibraryTab('history');}}>
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="p-6 space-y-8"
            >
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Flame className="w-6 h-6 text-orange-500 fill-orange-500" /> 
                    Trending Today
                  </h2>
                </div>
                {isLoadingTrending ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="space-y-2 animate-pulse">
                        <div className="aspect-square bg-zinc-900 rounded-2xl" />
                        <div className="h-4 bg-zinc-900 rounded w-3/4" />
                        <div className="h-3 bg-zinc-900 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {trendingResults.slice(0, 5).map((track, idx) => (
                      <motion.div 
                        key={track.permalink_url} 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setQueue(trendingResults);
                          setQueueIndex(idx);
                          playTrack(track.permalink_url);
                        }}
                        className="group cursor-pointer space-y-3"
                      >
                        <div className="relative aspect-square rounded-2xl overflow-hidden shadow-lg">
                          <img src={track.artwork_url || track.thumbnail || "https://picsum.photos/seed/music/300/300"} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-zinc-950 shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform">
                              <Play className="w-6 h-6 fill-current ml-1" />
                            </div>
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-100 truncate text-sm sm:text-base capitalize">{track.title || track.permalink.replace(/-/g, ' ')}</h3>
                          <p className="text-xs text-zinc-400 truncate">{getArtistFromUrl(track.permalink_url)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>

              {history.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold mb-4">Recently Played</h2>
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                    {history.slice(0, 8).map((track, idx) => (
                      <div 
                        key={track.permalink_url! + idx} 
                        onClick={() => playTrack(track.permalink_url!)}
                        className="flex-shrink-0 w-32 cursor-pointer space-y-2"
                      >
                        <img src={track.thumbnail} alt="" className="w-32 h-32 rounded-xl object-cover shadow-md" />
                        <p className="text-xs font-medium text-zinc-200 truncate">{track.title}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-xl font-bold mb-4">More Trending</h2>
                <TrackList 
                  tracks={trendingResults.slice(5)} 
                  isShuffle={isShuffle} setQueue={setQueue} setQueueIndex={setQueueIndex}
                  playTrack={playTrack} downloadedTracks={downloadedTracks} removeDownload={removeDownload}
                  downloadTrack={downloadTrack} downloadingTracks={downloadingTracks} removeFromPlaylist={removeFromPlaylist}
                  openAddModal={openAddModal} formatTime={formatTime} getArtist={getArtistFromUrl}
                />
              </section>
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div 
              key="search" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="p-6 space-y-6"
            >
              <h2 className="text-3xl font-bold">Search</h2>
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input 
                  type="search" 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Songs, artists, or podcasts" 
                  className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-emerald-500/50 rounded-2xl py-4 pl-12 pr-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 transition-all shadow-inner"
                />
              </form>
              
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                  <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                  <p>Searching the SoundStream...</p>
                </div>
              ) : results.length > 0 ? (
                <TrackList 
                  tracks={results} 
                  isShuffle={isShuffle} setQueue={setQueue} setQueueIndex={setQueueIndex}
                  playTrack={playTrack} downloadedTracks={downloadedTracks} removeDownload={removeDownload}
                  downloadTrack={downloadTrack} downloadingTracks={downloadingTracks} removeFromPlaylist={removeFromPlaylist}
                  openAddModal={openAddModal} formatTime={formatTime} getArtist={getArtistFromUrl}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4 pt-4">
                  {['Pop', 'Rock', 'Indie', 'Jazz', 'Electronic', 'Hip Hop'].map(genre => (
                    <div key={genre} className="h-24 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-4 font-bold text-lg flex items-end hover:scale-[1.02] transition-transform cursor-pointer shadow-md">
                      {genre}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'library' && (
            <motion.div 
              key="library" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold">Library</h2>
                <button onClick={(e) => openAddModal(e, null)} className="p-2 bg-emerald-500 text-zinc-950 rounded-full shadow-lg active:scale-90 transition-transform">
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="flex border-b border-zinc-900 overflow-x-auto no-scrollbar">
                {(['playlists', 'downloads', 'history'] as const).map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setLibraryTab(tab)}
                    className={`px-4 py-3 font-medium capitalize whitespace-nowrap border-b-2 transition-colors ${libraryTab === tab ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-zinc-500'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                {libraryTab === 'playlists' && (
                  <div className="space-y-4">
                    {activePlaylist ? (
                      <div className="space-y-6">
                        <div className="flex items-start gap-6">
                          <div className="relative w-32 h-32 sm:w-48 sm:h-48 rounded-3xl overflow-hidden shadow-2xl bg-zinc-900 flex-shrink-0 group">
                            {activePlaylist.artwork_url ? (
                              <img src={activePlaylist.artwork_url} alt="" className="w-full h-full object-cover" />
                            ) : activePlaylist.tracks.length > 0 ? (
                              <img src={activePlaylist.tracks[0].artwork_url || activePlaylist.tracks[0].thumbnail} alt="" className="w-full h-full object-cover opacity-50" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-800"><ListMusic className="w-16 h-16" /></div>
                            )}
                            <button 
                              onClick={(e) => openEditPlaylistModal(e, activePlaylist)}
                              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit3 className="w-8 h-8 text-white" />
                            </button>
                          </div>
                          <div className="flex-1 pt-2">
                            <div className="flex items-center gap-2 mb-1">
                              <button onClick={() => setActivePlaylist(null)} className="p-1 hover:bg-zinc-900 rounded-full transition-colors"><ArrowLeft className="w-5 h-5 text-zinc-400" /></button>
                              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Playlist</span>
                            </div>
                            <h3 className="text-3xl sm:text-5xl font-bold mb-4">{activePlaylist.name}</h3>
                            <div className="flex items-center gap-4">
                              <button 
                               onClick={() => playPlaylist(activePlaylist)}
                               className="bg-emerald-500 text-zinc-950 px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg"
                              >
                               <Play className="w-5 h-5 fill-current" /> Play
                              </button>
                              <button onClick={() => sharePlaylist(activePlaylist)} className="p-3 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors text-emerald-500"><Share2 className="w-5 h-5" /></button>
                              <button onClick={(e) => openEditPlaylistModal(e, activePlaylist)} className="p-3 bg-zinc-900 rounded-full hover:bg-zinc-800 transition-colors"><Edit3 className="w-5 h-5" /></button>
                              <button onClick={() => deletePlaylist(activePlaylist.id)} className="p-3 bg-zinc-900 rounded-full hover:bg-red-500/20 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>                            </div>
                          </div>
                        </div>
                        <div className="pt-4">
                          <TrackList 
                            tracks={activePlaylist.tracks} showRemove playlistId={activePlaylist.id}
                            isShuffle={isShuffle} setQueue={setQueue} setQueueIndex={setQueueIndex}
                            playTrack={playTrack} downloadedTracks={downloadedTracks} removeDownload={removeDownload}
                            downloadTrack={downloadTrack} downloadingTracks={downloadingTracks} removeFromPlaylist={removeFromPlaylist}
                            openAddModal={openAddModal} formatTime={formatTime} getArtist={getArtistFromUrl}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <button 
                          onClick={(e) => openAddModal(e, null)}
                          className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-500 flex items-center justify-center gap-2 hover:bg-zinc-900 hover:border-zinc-700 transition-all group"
                        >
                          <Plus className="w-5 h-5 group-hover:text-emerald-500 transition-colors" />
                          <span className="font-bold">Buat Playlist Baru</span>
                        </button>
                        
                        {playlists.length === 0 ? (
                          <div className="text-center py-12 text-zinc-600">
                            <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-10" />
                            <p>Belum ada playlist.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {playlists.map(p => (
                              <div key={p.id} onClick={() => setActivePlaylist(p)} className="flex flex-col p-4 bg-zinc-900/40 rounded-[2rem] hover:bg-zinc-900 transition-all cursor-pointer group shadow-lg border border-transparent hover:border-zinc-800">
                                <div className="relative aspect-square mb-4 rounded-2xl overflow-hidden bg-zinc-800 shadow-inner">
                                  {p.artwork_url ? (
                                    <img src={p.artwork_url} alt="" className="w-full h-full object-cover" />
                                  ) : p.tracks.length > 0 ? (
                                    <img src={p.tracks[0].artwork_url || p.tracks[0].thumbnail} alt="" className="w-full h-full object-cover opacity-60" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-700"><ListMusic className="w-10 h-10" /></div>
                                  )}
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-zinc-950 shadow-xl"><Play className="w-6 h-6 fill-current ml-1" /></div>
                                  </div>
                                </div>
                                <h4 className="font-bold text-lg truncate px-1">{p.name}</h4>
                                <p className="text-zinc-500 text-sm px-1">{p.tracks.length} lagu</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {libraryTab === 'downloads' && (
                  <div>
                    {downloadedTracks.length === 0 ? (
                      <div className="text-center py-20 text-zinc-500">
                        <HardDriveDownload className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>Belum ada unduhan.</p>
                      </div>
                    ) : (
                      <TrackList 
                        tracks={downloadedTracks} 
                        isShuffle={isShuffle} setQueue={setQueue} setQueueIndex={setQueueIndex}
                        playTrack={playTrack} downloadedTracks={downloadedTracks} removeDownload={removeDownload}
                        downloadTrack={downloadTrack} downloadingTracks={downloadingTracks} removeFromPlaylist={removeFromPlaylist}
                        openAddModal={openAddModal} formatTime={formatTime} getArtist={(url:any) => "Downloaded Track"}
                      />
                    )}
                  </div>
                )}

                {libraryTab === 'history' && (
                  <div>
                    {history.length === 0 ? (
                      <div className="text-center py-20 text-zinc-500">
                        <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>Riwayat dengar kosong.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex justify-end">
                          <button onClick={clearHistory} className="text-sm text-zinc-500 hover:text-red-500 flex items-center gap-1"><Trash2 className="w-4 h-4" /> Clear History</button>
                        </div>
                        <TrackList 
                          tracks={history} 
                          isShuffle={isShuffle} setQueue={setQueue} setQueueIndex={setQueueIndex}
                          playTrack={playTrack} downloadedTracks={downloadedTracks} removeDownload={removeDownload}
                          downloadTrack={downloadTrack} downloadingTracks={downloadingTracks} removeFromPlaylist={removeFromPlaylist}
                          openAddModal={openAddModal} formatTime={formatTime} getArtist={(url:any) => "History"}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mini Player */}
      {currentTrack && !isPlayerExpanded && (
        <motion.div 
          initial={{ y: 100 }} 
          animate={{ y: 0 }}
          className="fixed bottom-[72px] left-2 right-2 z-50 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-2xl flex items-center gap-3 backdrop-blur-xl"
          onClick={() => setIsPlayerExpanded(true)}
        >
          <img src={currentTrack.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover" />
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm truncate">{currentTrack.title}</h4>
            <p className="text-xs text-emerald-500 truncate">{currentTrack.user}</p>
          </div>
          <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
            <button onClick={playPrevious} className="p-2 text-zinc-400 active:text-white transition-colors">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button onClick={() => togglePlay()} className="p-3 text-white active:scale-90 transition-transform">
              {isLoadingTrack ? <Loader2 className="w-6 h-6 animate-spin" /> : isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
            </button>
            <button onClick={playNext} className="p-2 text-zinc-400 active:text-white transition-colors">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-100" style={{ width: `${(progress / duration) * 100}%` }} />
          </div>
        </motion.div>
      )}

      {/* Expanded Player */}
      <AnimatePresence>
        {isPlayerExpanded && currentTrack && (
          <motion.div 
            initial={{ y: '100%' }} 
            animate={{ y: 0 }} 
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/30 via-zinc-950 to-zinc-950 pointer-events-none" />
            
            <div className="relative flex-1 flex flex-col p-8 sm:p-12 overflow-y-auto no-scrollbar">
              <div className="flex justify-between items-center mb-10">
                <button onClick={() => setIsPlayerExpanded(false)} className="p-2 bg-white/5 rounded-full backdrop-blur-md"><ArrowLeft className="w-6 h-6 rotate-[-90deg]" /></button>
                <div className="text-center">
                  <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Sedang Diputar</p>
                  <p className="text-sm text-zinc-400 truncate max-w-[200px]">{activePlaylist?.name || 'SoundStream'}</p>
                </div>
                <button className="p-2 bg-white/5 rounded-full backdrop-blur-md" onClick={() => {setIsPlayerExpanded(false); setActiveTab('library');}}><ListMusic className="w-6 h-6" /></button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center gap-12">
                <motion.div 
                  animate={{ scale: isPlaying ? 1 : 0.9, opacity: isPlaying ? 1 : 0.8 }}
                  className="relative w-full max-w-[320px] aspect-square rounded-[2rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                >
                  <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
                </motion.div>

                <div className="w-full text-center space-y-2">
                  <h2 className="text-3xl font-bold text-white line-clamp-1">{currentTrack.title}</h2>
                  <p className="text-xl text-emerald-400 font-medium">{currentTrack.user}</p>
                </div>
              </div>

              {/* Controls */}
              <div className="w-full max-w-xl mx-auto space-y-8 mt-12">
                <div className="space-y-2">
                  <div className="relative h-2 bg-zinc-800/50 rounded-full group cursor-pointer">
                    <input 
                      type="range" min={0} max={duration || 100} value={progress} 
                      onChange={(e) => {
                        const time = Number(e.target.value);
                        if (audioRef.current) { audioRef.current.currentTime = time; setProgress(time); }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                    />
                    <div className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all" style={{ width: `${(progress / duration) * 100}%` }}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform" />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs font-medium text-zinc-500 tabular-nums">
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={toggleShuffle} className={`p-2 transition-colors ${isShuffle ? 'text-emerald-500' : 'text-zinc-600'}`}><Shuffle className="w-6 h-6" /></button>
                  <button onClick={playPrevious} className="p-2 text-white active:scale-90 transition-transform"><SkipBack className="w-10 h-10 fill-current" /></button>
                  <button onClick={() => togglePlay()} className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all">
                    {isLoadingTrack ? <Loader2 className="w-10 h-10 animate-spin" /> : isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
                  </button>
                  <button onClick={playNext} className="p-2 text-white active:scale-90 transition-transform"><SkipForward className="w-10 h-10 fill-current" /></button>
                  <button onClick={toggleRepeat} className={`p-2 transition-colors ${repeatMode !== 'off' ? 'text-emerald-500' : 'text-zinc-600'}`}>
                    {repeatMode === 'one' ? <Repeat1 className="w-6 h-6" /> : <Repeat className="w-6 h-6" />}
                  </button>
                </div>

                <div className="flex items-center justify-around pt-4">
                  <button onClick={() => { if(!lyrics) fetchLyrics(currentTrack.title); setIsLyricsOpen(true); }} className={`flex flex-col items-center gap-1 transition-colors ${isLyricsOpen ? 'text-emerald-500' : 'text-zinc-500'}`}>
                    <Mic2 className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Lirik</span>
                  </button>
                  
                  <button 
                    onClick={(e) => openAddModal(e, {
                      permalink_url: currentTrack.permalink_url!,
                      permalink: currentTrack.title,
                      artwork_url: currentTrack.thumbnail,
                      duration: currentTrack.duration,
                      title: currentTrack.title,
                      user: currentTrack.user
                    })} 
                    className={`flex flex-col items-center gap-1 transition-colors ${isTrackInAnyPlaylist ? 'text-emerald-500' : 'text-zinc-500'}`}
                  >
                    {isTrackInAnyPlaylist ? <CheckCircle2 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{isTrackInAnyPlaylist ? 'Tersimpan' : 'Tambah'}</span>
                  </button>

                  <button 
                    onClick={() => setIsBassBoost(!isBassBoost)} 
                    className={`flex flex-col items-center gap-1 transition-all ${isBassBoost ? 'text-emerald-500 scale-110' : 'text-zinc-500'}`}
                  >
                    <Zap className={`w-6 h-6 ${isBassBoost ? 'fill-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : ''}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Boost</span>
                  </button>

                  <button onClick={(e) => downloadTrack(e, currentTrack)} className="flex flex-col items-center gap-1 text-zinc-500">
                    {downloadingTracks.has(currentTrack.permalink_url!) ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
                    <span className="text-[10px] font-bold uppercase tracking-widest">Offline</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Lyrics Layer */}
            <AnimatePresence>
              {isLyricsOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 50 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: 50 }}
                  className="absolute inset-0 bg-zinc-950/95 z-10 p-8 flex flex-col"
                >
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-bold">Lirik</h3>
                    <button onClick={() => setIsLyricsOpen(false)} className="p-2 bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                    {isLoadingLyrics ? (
                      <div className="flex flex-col items-center justify-center h-full gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                        <p className="text-zinc-500">Memuat lirik...</p>
                      </div>
                    ) : lyrics ? (
                      <p className="text-3xl sm:text-4xl font-bold leading-tight whitespace-pre-wrap text-zinc-200">{lyrics}</p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-600">
                        <Mic2 className="w-20 h-20 mb-4 opacity-10" />
                        <p>Lirik tidak ditemukan.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900 px-6 py-3 flex justify-between items-center z-50">
        <NavButton active={activeTab === 'home'} icon={<Music className="w-6 h-6" />} label="Home" onClick={() => setActiveTab('home')} />
        <NavButton active={activeTab === 'search'} icon={<Search className="w-6 h-6" />} label="Search" onClick={() => setActiveTab('search')} />
        <NavButton active={activeTab === 'library'} icon={<ListMusic className="w-6 h-6" />} label="Library" onClick={() => setActiveTab('library')} />
      </nav>

      {/* Create/Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-zinc-800">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold">{trackToAdd ? 'Tambah ke Playlist' : 'Buat Playlist Baru'}</h3>
              <button onClick={() => { setIsAddModalOpen(false); setTrackToAdd(null); }} className="p-2 bg-zinc-800 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            {trackToAdd && (
              <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar pr-2 mb-8">
                {playlists.map(p => {
                  const isTrackInThisPlaylist = p.tracks.some(t => t.permalink_url === trackToAdd.permalink_url);
                  return (
                    <button key={p.id} onClick={() => addToPlaylist(p.id, trackToAdd)} className="w-full flex items-center gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-2xl transition-all">
                      <div className="w-10 h-10 bg-zinc-700 rounded-lg flex items-center justify-center">
                        {isTrackInThisPlaylist ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <ListMusic className="w-5 h-5 text-zinc-500" />}
                      </div>
                      <span className={`font-bold ${isTrackInThisPlaylist ? 'text-emerald-500' : 'text-white'}`}>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <form onSubmit={createPlaylist} className="flex gap-2">
              <input 
                type="text" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} 
                placeholder="Nama playlist..." 
                className="flex-1 bg-zinc-800/50 border border-zinc-700 focus:border-emerald-500/50 rounded-xl py-3 px-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20" 
              />
              <button type="submit" className="bg-emerald-500 text-zinc-950 p-3 rounded-xl font-bold active:scale-95 transition-transform"><Plus className="w-6 h-6" /></button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Modal with Image Upload */}
      {isEditPlaylistModalOpen && playlistToEdit && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-zinc-800">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold">Edit Playlist</h3>
              <button onClick={() => setIsEditPlaylistModalOpen(false)} className="p-2 bg-zinc-800 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex justify-center mb-8">
              <div 
                className="relative w-32 h-32 rounded-3xl overflow-hidden bg-zinc-800 group cursor-pointer border-2 border-zinc-700 hover:border-emerald-500 transition-all"
                onClick={() => fileInputRef.current?.click()}
              >
                {editPlaylistImage ? (
                  <img src={editPlaylistImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploadingImage ? <Loader2 className="w-8 h-8 animate-spin text-white" /> : <Upload className="w-8 h-8 text-white" />}
                </div>
              </div>
              <input 
                type="file" ref={fileInputRef} className="hidden" accept="image/*"
                onChange={handleImageUpload}
              />
            </div>

            <form onSubmit={updatePlaylist} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Nama Playlist</label>
                <input 
                  type="text" value={editPlaylistName} onChange={e => setEditPlaylistName(e.target.value)} 
                  placeholder="Masukkan nama..." 
                  className="w-full bg-zinc-800/50 border border-zinc-700 focus:border-emerald-500/50 rounded-xl py-4 px-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20" 
                />
              </div>
              <button 
                type="submit" disabled={isUploadingImage}
                className="w-full bg-emerald-500 text-zinc-950 py-4 rounded-xl font-bold active:scale-95 transition-transform shadow-lg disabled:opacity-50"
              >
                {isUploadingImage ? 'Mengunggah...' : 'Simpan Perubahan'}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      <audio ref={audioRef} src={currentTrack?.url} crossOrigin="anonymous" onTimeUpdate={handleTimeUpdate} onEnded={handleTrackEnd} onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }} />

      {/* Import Modal */}
      {isImportModalOpen && sharedPlaylistData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-zinc-800">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto text-emerald-500">
                <Share2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold">Impor Playlist?</h3>
              <p className="text-zinc-400">Seseorang membagikan playlist <b>"{sharedPlaylistData.name}"</b> dengan {sharedPlaylistData.tracks.length} lagu kepada Anda.</p>
              
              <div className="pt-4 space-y-3">
                <button 
                  onClick={() => {
                    setPlaylists(prev => [...prev, sharedPlaylistData]);
                    setIsImportModalOpen(false);
                    setSharedPlaylistData(null);
                    setActiveTab('library');
                    setLibraryTab('playlists');
                  }}
                  className="w-full bg-emerald-500 text-zinc-950 py-4 rounded-xl font-bold active:scale-95 transition-transform shadow-lg"
                >
                  Ya, Impor Playlist
                </button>
                <button 
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setSharedPlaylistData(null);
                  }}
                  className="w-full bg-zinc-800 text-white py-4 rounded-xl font-bold active:scale-95 transition-transform"
                >
                  Abaikan
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-emerald-500' : 'text-zinc-500'}`}>
      <motion.div animate={{ scale: active ? 1.2 : 1 }}>{icon}</motion.div>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

const TrackList = ({ 
  tracks, showRemove = false, playlistId = null, isShuffle, setQueue, setQueueIndex, playTrack, downloadedTracks, removeDownload, downloadTrack, downloadingTracks, removeFromPlaylist, openAddModal, formatTime, getArtist 
}: any) => (
  <div className="space-y-2">
    {tracks.map((track: any, idx: number) => (
      <motion.div 
        key={track.permalink_url || idx}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: idx * 0.05 }}
        onClick={() => {
          setQueue(tracks);
          setQueueIndex(idx);
          playTrack(track.permalink_url);
        }}
        className="flex items-center gap-4 p-2 hover:bg-zinc-900/50 rounded-2xl cursor-pointer group transition-colors"
      >
        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 shadow-md">
          <img src={track.artwork_url || track.thumbnail || "https://picsum.photos/seed/music/100/100"} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-zinc-100 truncate capitalize">{track.title || track.permalink.replace(/-/g, ' ')}</h4>
          <p className="text-xs text-zinc-500 truncate">{track.user || getArtist(track.permalink_url)}</p>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {downloadedTracks.some((t: any) => t.permalink_url === track.permalink_url) ? (
            <button onClick={(e) => removeDownload(e, track.permalink_url)} className="p-2 text-emerald-500"><CheckCircle2 className="w-5 h-5" /></button>
          ) : (
            <button onClick={(e) => downloadTrack(e, track)} className="p-2 text-zinc-700 hover:text-emerald-500 transition-colors">
              {downloadingTracks.has(track.permalink_url) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </button>
          )}
          {showRemove ? (
            <button onClick={() => removeFromPlaylist(playlistId, track.permalink_url)} className="p-2 text-zinc-700 hover:text-red-500"><Trash2 className="w-5 h-5" /></button>
          ) : (
            <button onClick={(e) => openAddModal(e, track)} className="p-2 text-zinc-700 hover:text-emerald-500"><Plus className="w-5 h-5" /></button>
          )}
        </div>
      </motion.div>
    ))}
  </div>
);
