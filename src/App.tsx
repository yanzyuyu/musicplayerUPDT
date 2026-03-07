import React, { useState, useRef, useEffect } from 'react';
import { Search, Play, Pause, Volume2, Loader2, Music, SkipBack, SkipForward, Mic2, X, Plus, ListMusic, Trash2, ArrowLeft, History, Repeat, Repeat1, Shuffle, Download, CheckCircle2, HardDriveDownload, Flame } from 'lucide-react';
import localforage from 'localforage';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';
import { BatteryOptimization } from '@capawesome-team/capacitor-android-battery-optimization';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  genre?: string;
  created_at?: string;
  duration?: number;
  permalink: string;
  comment_count?: number;
  artwork_url?: string;
  permalink_url: string;
  playback_count?: number;
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
  const [activeTab, setActiveTab] = useState<'search' | 'playlists' | 'history' | 'downloads'>('search');
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState<SearchResult | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [history, setHistory] = useState<TrackDetails[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [queue, setQueue] = useState<any[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffle, setIsShuffle] = useState(false);
  const [shuffledQueue, setShuffledQueue] = useState<any[]>([]);
  const [originalQueueIndex, setOriginalQueueIndex] = useState<number>(-1);
  
  const [downloadedTracks, setDownloadedTracks] = useState<TrackDetails[]>([]);
  const [downloadingTracks, setDownloadingTracks] = useState<Set<string>>(new Set());
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number>(0);

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

  const stopForeground = async () => {
    if (Capacitor.getPlatform() === 'android') {
      try {
        await ForegroundService.stopForegroundService();
      } catch (e) {
        console.error('Failed to stop foreground service', e);
      }
    }
  };

  useEffect(() => {
    startForeground();
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    const initApp = async () => {
      try {
        if (Capacitor.getPlatform() === 'android') {
          // 1. Request notification permissions (Android 13+)
          await ForegroundService.requestPermissions();
          
          // 2. Request Ignore Battery Optimization
          const { enabled } = await BatteryOptimization.isBatteryOptimizationEnabled();
          if (enabled) {
            await BatteryOptimization.requestIgnoreBatteryOptimization();
          }

          // 3. Start initial service
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
  }, []);

  const fetchTrending = async () => {
    setIsLoadingTrending(true);
    try {
      const res = await fetch(`https://api.siputzx.my.id/api/s/soundcloud?query=top%20hits%202026`);
      const data = await res.json();
      if (data.status && data.data) {
        setTrendingResults(data.data.slice(0, 15));
      }
    } catch (error) {
      console.error("Failed to fetch trending:", error);
    } finally {
      setIsLoadingTrending(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('soundstream_playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'downloads') {
      loadDownloadedTracks();
    }
  }, [activeTab]);

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

  const downloadTrack = async (e: React.MouseEvent, track: SearchResult | TrackDetails) => {
    e.stopPropagation();
    if (!track.permalink_url) return;
    
    setDownloadingTracks(prev => new Set(prev).add(track.permalink_url!));
    
    try {
      const metaRes = await fetch(`https://api.siputzx.my.id/api/d/soundcloud?url=${encodeURIComponent(track.permalink_url)}`);
      const metaData = await metaRes.json();
      
      if (!metaData.status || !metaData.data) {
        throw new Error("Failed to fetch metadata");
      }

      const metadata = { ...metaData.data, permalink_url: track.permalink_url };

      const audioRes = await fetch(metadata.url);
      if (!audioRes.ok) throw new Error("Failed to fetch audio");
      const blob = await audioRes.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const safeTitle = (metadata.title || 'soundcloud_track').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      a.download = `${safeTitle}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      await localforage.setItem(`track_${track.permalink_url}`, {
        metadata,
        blob
      });

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
      if (Array.isArray(data)) {
        setHistory(data);
      }
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
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
      } catch (e) {
        console.error("Audio context init failed:", e);
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

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

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentTrack]);

  const createPlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: newPlaylistName.trim(),
      tracks: []
    };
    const updatedPlaylists = [...playlists, newPlaylist];
    setPlaylists(updatedPlaylists);
    setNewPlaylistName('');
    if (trackToAdd) {
      addToPlaylist(newPlaylist.id, trackToAdd, updatedPlaylists);
    }
  };

  const addToPlaylist = (playlistId: string, track: SearchResult, currentPlaylists = playlists) => {
    setPlaylists(currentPlaylists.map(p => {
      if (p.id === playlistId) {
        if (!p.tracks.some(t => t.permalink_url === track.permalink_url)) {
          return { ...p, tracks: [...p.tracks, track] };
        }
      }
      return p;
    }));
    setIsAddModalOpen(false);
    setTrackToAdd(null);
  };

  const removeFromPlaylist = (playlistId: string, trackUrl: string) => {
    setPlaylists(playlists.map(p => {
      if (p.id === playlistId) {
        return { ...p, tracks: p.tracks.filter(t => t.permalink_url !== trackUrl) };
      }
      return p;
    }));
    if (activePlaylist && activePlaylist.id === playlistId) {
      setActivePlaylist({
        ...activePlaylist,
        tracks: activePlaylist.tracks.filter(t => t.permalink_url !== trackUrl)
      });
    }
  };

  const deletePlaylist = (playlistId: string) => {
    setPlaylists(playlists.filter(p => p.id !== playlistId));
    if (activePlaylist?.id === playlistId) {
      setActivePlaylist(null);
    }
  };

  const openAddModal = (e: React.MouseEvent, track: SearchResult) => {
    e.stopPropagation();
    setTrackToAdd(track);
    setIsAddModalOpen(true);
  };

  const audioRef = useRef<HTMLAudioElement>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await fetch(`https://api.siputzx.my.id/api/s/soundcloud?query=${encodeURIComponent(query)}`, {
        headers: {
          'content-type': 'application/json',
          'priority': 'u=1,i'
        }
      });
      const data = await res.json();
      if (data.status && data.data) {
        setResults(data.data);
      } else {
        setResults([]);
      }
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
        if (trackWithLyrics) {
          setLyrics(trackWithLyrics.plainLyrics);
        } else {
          setLyrics("No lyrics found for this track.");
        }
      } else {
        setLyrics("No lyrics found for this track.");
      }
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

        if (isLyricsOpen) {
          fetchLyrics(offlineData.metadata.title);
        } else {
          setLyrics(null);
        }
        setIsLoadingTrack(false);
        return;
      }

      const res = await fetch(`https://api.siputzx.my.id/api/d/soundcloud?url=${encodeURIComponent(permalink_url)}`, {
        headers: {
          'content-type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.status && data.data) {
        setCurrentTrack(data.data);
        setIsPlaying(true);
        
        fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data.data, permalink_url })
        }).catch(console.error);

        if (isLyricsOpen) {
          fetchLyrics(data.data.title);
        } else {
          setLyrics(null);
        }
      }
    } catch (error) {
      console.error("Play error:", error);
    } finally {
      setIsLoadingTrack(false);
    }
  };

  const toggleLyrics = () => {
    if (!isLyricsOpen && currentTrack && !lyrics) {
      fetchLyrics(currentTrack.title);
    }
    setIsLyricsOpen(!isLyricsOpen);
  };

  const playNext = () => {
    const activeQueue = isShuffle ? shuffledQueue : queue;
    if (activeQueue.length > 0) {
      let nextIndex = queueIndex + 1;
      
      if (nextIndex >= activeQueue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          return;
        }
      }
      
      const nextTrack = activeQueue[nextIndex];
      if (nextTrack && nextTrack.permalink_url) {
        setQueueIndex(nextIndex);
        playTrack(nextTrack.permalink_url);
      }
    }
  };

  const playPrevious = () => {
    const activeQueue = isShuffle ? shuffledQueue : queue;
    if (activeQueue.length > 0) {
      let prevIndex = queueIndex - 1;
      
      if (prevIndex < 0) {
        if (repeatMode === 'all') {
          prevIndex = activeQueue.length - 1;
        } else {
          prevIndex = 0;
        }
      }
      
      const prevTrack = activeQueue[prevIndex];
      if (prevTrack && prevTrack.permalink_url) {
        setQueueIndex(prevIndex);
        playTrack(prevTrack.permalink_url);
      }
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
      if (queueIndex < activeQueue.length - 1 || repeatMode === 'all') {
        playNext();
      } else {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
    }
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

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
          setOriginalQueueIndex(queueIndex);
          setQueueIndex(0);
        }
        setShuffledQueue(shuffled);
      } else if (!newShuffle && queue.length > 0) {
        if (currentTrack) {
          const originalIndex = queue.findIndex(t => t.permalink_url === currentTrack.permalink_url);
          if (originalIndex !== -1) {
            setQueueIndex(originalIndex);
          }
        }
      }
      return newShuffle;
    });
  };

  const togglePlay = () => {
    if (audioRef.current) {
      initAudioContext();
      if (isPlaying) {
        audioRef.current.pause();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      } else {
        audioRef.current.play();
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
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
          artwork: [
            { src: currentTrack.thumbnail || 'https://picsum.photos/seed/music/512/512', sizes: '512x512', type: 'image/png' }
          ]
        });
        
        navigator.mediaSession.playbackState = 'playing';

        navigator.mediaSession.setActionHandler('play', () => {
          audioRef.current?.play();
          setIsPlaying(true);
          navigator.mediaSession.playbackState = 'playing';
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audioRef.current?.pause();
          setIsPlaying(false);
          navigator.mediaSession.playbackState = 'paused';
        });
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

  useEffect(() => {
    if ('mediaSession' in navigator && audioRef.current && !isNaN(audioRef.current.duration)) {
      navigator.mediaSession.setPositionState({
        duration: audioRef.current.duration,
        playbackRate: audioRef.current.playbackRate,
        position: audioRef.current.currentTime
      });
    }
  }, [progress, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let resumeInterval: any;

    const handleSystemPause = () => {
      if (isPlaying) {
        if (resumeInterval) clearInterval(resumeInterval);
        resumeInterval = setInterval(() => {
          if (isPlaying && audio.paused) {
            audio.play().then(() => {
              clearInterval(resumeInterval);
            }).catch(() => {});
          } else {
            clearInterval(resumeInterval);
          }
        }, 2000);
      }
    };

    audio.addEventListener('pause', handleSystemPause);
    return () => {
      audio.removeEventListener('pause', handleSystemPause);
      if (resumeInterval) clearInterval(resumeInterval);
    };
  }, [isPlaying]);

  return (
    <div className="h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans overflow-hidden">
      <header className="p-4 sm:p-6 border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-md flex-shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xl">
              <Music className="w-6 h-6" />
              <span>SoundStream</span>
            </div>
            <div className="flex bg-zinc-800/50 rounded-lg p-1 overflow-x-auto no-scrollbar">
              <button onClick={() => { setActiveTab('search'); setActivePlaylist(null); }} className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all active:scale-95 whitespace-nowrap ${activeTab === 'search' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'}`}>Search</button>
              <button onClick={() => setActiveTab('playlists')} className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all active:scale-95 whitespace-nowrap ${activeTab === 'playlists' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'}`}>Playlists</button>
              <button onClick={() => { setActiveTab('history'); setActivePlaylist(null); }} className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all active:scale-95 whitespace-nowrap ${activeTab === 'history' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'}`}>History</button>
              <button onClick={() => { setActiveTab('downloads'); setActivePlaylist(null); }} className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all active:scale-95 whitespace-nowrap ${activeTab === 'downloads' ? 'bg-zinc-700 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'}`}>Downloads</button>
            </div>
          </div>
          {activeTab === 'search' && (
            <form onSubmit={handleSearch} className="flex-1 w-full relative">
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search songs, artists..." className="w-full bg-zinc-800/50 border border-zinc-700 rounded-full py-2.5 sm:py-3 px-5 pl-10 sm:pl-12 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm sm:text-base" />
              <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 h-5 text-zinc-400" />
              <button type="submit" className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 p-1.5 sm:p-2 rounded-full transition-all active:scale-90" disabled={isSearching}>
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 overflow-y-auto no-scrollbar relative pb-32">
        <AnimatePresence mode="wait">
          {isLyricsOpen && currentTrack && (
            <motion.div 
              key="lyrics"
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
              className="fixed inset-0 bg-zinc-950 z-[60] overflow-y-auto flex flex-col"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 via-zinc-950 to-zinc-950 pointer-events-none" />
              <div className="relative flex flex-col min-h-full p-6 sm:p-12">
                <div className="flex justify-between items-start mb-12 sticky top-0 py-4 z-10">
                  <div className="flex gap-4 items-center">
                    <img src={currentTrack.thumbnail} alt="" className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg shadow-2xl object-cover" />
                    <div>
                      <h2 className="text-xl sm:text-3xl font-bold text-zinc-100 line-clamp-1">{currentTrack.title}</h2>
                      <p className="text-sm sm:text-lg text-emerald-400 font-medium">{currentTrack.user}</p>
                    </div>
                  </div>
                  <button onClick={toggleLyrics} className="p-2 bg-white/10 hover:bg-white/20 active:scale-90 rounded-full transition-all backdrop-blur-md"><X className="w-6 h-6 sm:w-8 sm:h-8" /></button>
                </div>
                <div className="flex-1 flex flex-col items-center justify-start max-w-3xl mx-auto w-full">
                  {isLoadingLyrics ? (
                    <div className="flex flex-col items-center gap-4 text-zinc-400 my-auto"><Loader2 className="w-10 h-10 animate-spin text-emerald-500" /><p className="text-lg font-medium">Fetching lyrics...</p></div>
                  ) : lyrics ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full pb-32">
                      <p className="whitespace-pre-wrap text-2xl sm:text-4xl md:text-5xl leading-tight sm:leading-tight text-zinc-300 font-bold text-center sm:text-left selection:bg-emerald-500/30">{lyrics}</p>
                    </motion.div>
                  ) : (
                    <div className="my-auto text-zinc-500 text-center"><Mic2 className="w-20 h-20 mx-auto mb-6 opacity-10" /><p className="text-xl font-medium">Instruments only, no lyrics found.</p></div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          key={activeTab + (activePlaylist?.id || '')} 
          initial={{ opacity: 0, x: 10 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'search' && (
            <>
              {results.length > 0 ? (
                <div className="space-y-4"><h2 className="text-xl font-semibold mb-6 flex items-center gap-2"><Search className="w-5 h-5 text-emerald-400" /> Search Results</h2><TrackList 
  tracks={results} 
  isShuffle={isShuffle}
  setQueue={setQueue}
  setShuffledQueue={setShuffledQueue}
  setQueueIndex={setQueueIndex}
  playTrack={playTrack}
  downloadedTracks={downloadedTracks}
  removeDownload={removeDownload}
  downloadTrack={downloadTrack}
  downloadingTracks={downloadingTracks}
  removeFromPlaylist={removeFromPlaylist}
  openAddModal={openAddModal}
  formatTime={formatTime}
/></div>
              ) : query.trim() ? (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">{isSearching ? <Loader2 className="w-12 h-12 animate-spin text-emerald-500" /> : <p>No results found for "{query}"</p>}</div>
              ) : (
                <div className="space-y-8">
                  <div className="flex items-center justify-between"><h2 className="text-xl font-bold flex items-center gap-2"><Flame className="w-6 h-6 text-orange-500 fill-orange-500" /> Trending Today</h2></div>
                  {isLoadingTrending ? (
                    <div className="grid gap-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-zinc-900/50 rounded-xl animate-pulse" />)}</div>
                  ) : (
                    <TrackList 
  tracks={trendingResults} 
  isShuffle={isShuffle}
  setQueue={setQueue}
  setShuffledQueue={setShuffledQueue}
  setQueueIndex={setQueueIndex}
  playTrack={playTrack}
  downloadedTracks={downloadedTracks}
  removeDownload={removeDownload}
  downloadTrack={downloadTrack}
  downloadingTracks={downloadingTracks}
  removeFromPlaylist={removeFromPlaylist}
  openAddModal={openAddModal}
  formatTime={formatTime}
/>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'playlists' && !activePlaylist && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Your Playlists</h2>
              <form onSubmit={createPlaylist} className="flex gap-2">
                <input type="text" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="New playlist name..." className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg py-2 px-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 flex items-center gap-2 shadow-lg"><Plus className="w-4 h-4" /> Create</button>
              </form>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {playlists.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-zinc-500"><ListMusic className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No playlists yet.</p></div>
                ) : (
                  playlists.map(playlist => (
                    <div key={playlist.id} className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4 flex items-center justify-between group hover:bg-zinc-800/50 active:scale-[0.98] transition-all cursor-pointer shadow-md" onClick={() => setActivePlaylist(playlist)}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center text-emerald-500"><ListMusic className="w-6 h-6" /></div>
                        <div><h3 className="font-medium text-zinc-100">{playlist.name}</h3><p className="text-sm text-zinc-400">{playlist.tracks.length} tracks</p></div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id); }} className="p-2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 active:scale-75 transition-all focus:opacity-100"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'playlists' && activePlaylist && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <button onClick={() => setActivePlaylist(null)} className="p-2 hover:bg-zinc-800 active:scale-75 rounded-full transition-all"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="text-xl font-semibold">{activePlaylist.name}</h2>
                <span className="text-zinc-400 text-sm">{activePlaylist.tracks.length} tracks</span>
              </div>
              {activePlaylist.tracks.length === 0 ? <div className="text-center py-12 text-zinc-500"><p>Playlist is empty.</p></div> : <TrackList 
  tracks={activePlaylist.tracks} 
  showRemove={true} 
  playlistId={activePlaylist.id}
  isShuffle={isShuffle}
  setQueue={setQueue}
  setShuffledQueue={setShuffledQueue}
  setQueueIndex={setQueueIndex}
  playTrack={playTrack}
  downloadedTracks={downloadedTracks}
  removeDownload={removeDownload}
  downloadTrack={downloadTrack}
  downloadingTracks={downloadingTracks}
  removeFromPlaylist={removeFromPlaylist}
  openAddModal={openAddModal}
  formatTime={formatTime}
/>}
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">History</h2>
                {history.length > 0 && <button onClick={clearHistory} className="text-sm text-zinc-400 hover:text-red-400 active:scale-95 transition-all flex items-center gap-1"><Trash2 className="w-4 h-4" /> Clear</button>}
              </div>
              {isLoadingHistory ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div> : history.length === 0 ? <div className="text-center py-12 text-zinc-500"><History className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No history yet.</p></div> : <TrackList 
  tracks={history} 
  isShuffle={isShuffle}
  setQueue={setQueue}
  setShuffledQueue={setShuffledQueue}
  setQueueIndex={setQueueIndex}
  playTrack={playTrack}
  downloadedTracks={downloadedTracks}
  removeDownload={removeDownload}
  downloadTrack={downloadTrack}
  downloadingTracks={downloadingTracks}
  removeFromPlaylist={removeFromPlaylist}
  openAddModal={openAddModal}
  formatTime={formatTime}
/>}
            </div>
          )}
          
          {activeTab === 'downloads' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Downloads</h2>
              {downloadedTracks.length === 0 ? <div className="text-center py-12 text-zinc-500"><HardDriveDownload className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No downloads yet.</p></div> : <TrackList 
  tracks={downloadedTracks} 
  isShuffle={isShuffle}
  setQueue={setQueue}
  setShuffledQueue={setShuffledQueue}
  setQueueIndex={setQueueIndex}
  playTrack={playTrack}
  downloadedTracks={downloadedTracks}
  removeDownload={removeDownload}
  downloadTrack={downloadTrack}
  downloadingTracks={downloadingTracks}
  removeFromPlaylist={removeFromPlaylist}
  openAddModal={openAddModal}
  formatTime={formatTime}
/>}
            </div>
          )}
        </motion.div>
      </main>

      {isAddModalOpen && trackToAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Add to Playlist</h3>
              <button onClick={() => { setIsAddModalOpen(false); setTrackToAdd(null); }} className="p-2 hover:bg-zinc-800 active:scale-90 rounded-full transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 mb-6">
              {playlists.length === 0 ? <p className="text-zinc-500 text-sm italic">No playlists.</p> : playlists.map(p => (
                <button key={p.id} onClick={() => addToPlaylist(p.id, trackToAdd)} className="w-full text-left px-4 py-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center justify-between shadow-sm">
                  <span className="font-medium">{p.name}</span><Plus className="w-4 h-4" />
                </button>
              ))}
            </div>
            <form onSubmit={createPlaylist} className="flex gap-2 pt-4 border-t border-zinc-800">
              <input type="text" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="New playlist..." className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 rounded-lg font-medium transition-all active:scale-95">Create</button>
            </form>
          </motion.div>
        </div>
      )}

      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-lg border-t border-white/5 p-3 sm:p-4 z-50">
          <canvas ref={canvasRef} width={1024} height={64} className="absolute bottom-full left-0 w-full h-16 pointer-events-none opacity-40" />
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-6 relative z-10">
            <div className="flex items-center gap-3 w-full sm:w-1/3 min-w-0">
              <img src={currentTrack.thumbnail || "https://picsum.photos/seed/music/100/100"} alt={currentTrack.title} className="w-10 h-10 sm:w-12 sm:h-12 rounded-md object-cover flex-shrink-0 shadow-lg" referrerPolicy="no-referrer" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-zinc-100 truncate text-xs sm:text-sm">{currentTrack.title}</div>
                <div className="text-[10px] sm:text-xs text-emerald-400 truncate font-medium">{currentTrack.user}</div>
              </div>
              <div className="flex sm:hidden items-center gap-1">
                <button onClick={toggleLyrics} className={`p-2 rounded-full active:scale-90 transition-all ${isLyricsOpen ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400'}`}><Mic2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="w-full sm:flex-1 flex flex-col items-center gap-1 sm:gap-2">
              <div className="flex items-center gap-4 sm:gap-6">
                <button onClick={toggleShuffle} className={`transition-all p-1.5 sm:p-2 rounded-full active:scale-75 ${isShuffle ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400'}`}><Shuffle className="w-4 h-4" /></button>
                <button onClick={playPrevious} className="text-zinc-400 hover:text-zinc-100 active:scale-75 p-1 transition-all"><SkipBack className="w-5 h-5 fill-current" /></button>
                <button onClick={togglePlay} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 active:scale-90 transition-all shadow-xl">
                  {isLoadingTrack ? <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-current" /> : <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />}
                </button>
                <button onClick={playNext} className="text-zinc-400 hover:text-zinc-100 active:scale-75 p-1 transition-all"><SkipForward className="w-5 h-5 fill-current" /></button>
                <button onClick={toggleRepeat} className={`transition-all p-1.5 sm:p-2 rounded-full active:scale-75 ${repeatMode !== 'off' ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400'}`}>
                  {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </button>
              </div>
              <div className="w-full flex items-center gap-2 text-[10px] sm:text-xs text-zinc-400">
                <span className="w-8 text-right font-medium">{formatTime(progress)}</span>
                <div className="flex-1 relative h-6 flex items-center">
                  <input type="range" min={0} max={duration || 100} value={progress} onChange={handleSeek} className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500" />
                </div>
                <span className="w-8 font-medium">{formatTime(duration)}</span>
              </div>
            </div>
            <div className="w-1/3 hidden sm:flex items-center justify-end gap-4">
              <button onClick={toggleLyrics} className={`transition-all p-2 rounded-full active:scale-75 ${isLyricsOpen ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400 hover:text-zinc-100'}`}><Mic2 className="w-5 h-5" /></button>
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={handleVolumeChange} className="w-16 md:w-24 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500" />
              </div>
            </div>
          </div>
          <audio ref={audioRef} src={currentTrack.url} crossOrigin="anonymous" onTimeUpdate={handleTimeUpdate} onEnded={handleTrackEnd} onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }} />
        </div>
      )}
    </div>
  );
}

const TrackList = ({ 
  tracks, 
  showRemove = false, 
  playlistId = null,
  isShuffle,
  setQueue,
  setShuffledQueue,
  setQueueIndex,
  playTrack,
  downloadedTracks,
  removeDownload,
  downloadTrack,
  downloadingTracks,
  removeFromPlaylist,
  openAddModal,
  formatTime
}: { 
  tracks: any[], 
  showRemove?: boolean, 
  playlistId?: string | null,
  isShuffle: boolean,
  setQueue: (t: any[]) => void,
  setShuffledQueue: (t: any[]) => void,
  setQueueIndex: (i: number) => void,
  playTrack: (url: string) => void,
  downloadedTracks: any[],
  removeDownload: (e: React.MouseEvent, url: string) => void,
  downloadTrack: (e: React.MouseEvent, track: any) => void,
  downloadingTracks: Set<string>,
  removeFromPlaylist: (pid: string, url: string) => void,
  openAddModal: (e: React.MouseEvent, track: any) => void,
  formatTime: (s: number) => string
}) => (
  <div className="grid gap-3">
    {tracks.map((result, idx) => {
      const artistMatch = result.permalink_url?.match(/soundcloud\.com\/([^\/]+)/);
      const artistName = result.user || (artistMatch ? artistMatch[1].replace(/-/g, ' ') : 'Unknown Artist');
      
      return (
        <motion.div 
          key={result.permalink_url || idx} 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.03 }}
          className="flex items-start sm:items-center gap-1 sm:gap-2 group bg-zinc-900/30 hover:bg-zinc-800/40 active:scale-[0.98] transition-all rounded-xl border border-transparent hover:border-zinc-800/50 shadow-sm"
        >
          <button 
            onClick={() => {
              setQueue(tracks);
              if (isShuffle) {
                const shuffled = [...tracks];
                shuffled.splice(idx, 1);
                for (let i = shuffled.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                shuffled.unshift(tracks[idx]);
                setShuffledQueue(shuffled);
                setQueueIndex(0);
              } else {
                setQueueIndex(idx);
              }
              playTrack(result.permalink_url);
            }}
            className="flex-1 text-left flex items-start sm:items-center gap-2 sm:gap-4 p-2 sm:p-3 min-w-0 focus:outline-none"
          >
            <div className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 shadow-lg mt-1 sm:mt-0">
              {(result.artwork_url || result.thumbnail) ? (
                <img src={result.artwork_url || result.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <Music className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-5 h-5 text-white fill-white" aria-hidden="true" />
              </div>
            </div>
            <div className="flex-1 min-w-0 py-1">
              <h3 className="font-medium text-zinc-100 text-sm sm:text-base line-clamp-2 leading-tight mb-0.5">{result.title || result.permalink?.replace(/-/g, ' ')}</h3>
              <p className="text-xs sm:text-sm text-zinc-400 truncate capitalize">{artistName}</p>
            </div>
            <div className="hidden xs:flex items-center gap-2 sm:gap-4 text-[10px] sm:text-sm text-zinc-400 flex-shrink-0 ml-2">
              {result.duration && <span>{formatTime(result.duration / (result.duration > 10000 ? 1000 : 1))}</span>}
            </div>
          </button>
          
          <div className="flex items-center pr-1 sm:pr-2 flex-shrink-0 mt-1 sm:mt-0">
            {downloadedTracks.some(t => t.permalink_url === result.permalink_url) ? (
              <button 
                onClick={(e) => removeDownload(e, result.permalink_url)}
                className="p-2 sm:p-3 text-emerald-400 hover:text-emerald-300 active:scale-75 transition-all rounded-xl"
                aria-label="Remove download"
              >
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            ) : (
              <button 
                onClick={(e) => downloadTrack(e, result)}
                disabled={downloadingTracks.has(result.permalink_url!)}
                className="p-2 sm:p-3 text-zinc-400 hover:text-emerald-400 active:scale-75 transition-all rounded-xl"
                aria-label="Download track"
              >
                {downloadingTracks.has(result.permalink_url!) ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
            )}
            {showRemove && playlistId ? (
              <button 
                onClick={() => removeFromPlaylist(playlistId, result.permalink_url!)}
                className="p-2 sm:p-3 text-zinc-500 hover:text-red-400 active:scale-75 transition-all rounded-xl"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            ) : (
              <button 
                onClick={(e) => openAddModal(e, result)}
                className="p-2 sm:p-3 text-zinc-400 hover:text-emerald-400 active:scale-75 transition-all rounded-xl"
                aria-label="Add to playlist"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
        </motion.div>
      );
    })}
  </div>
);
