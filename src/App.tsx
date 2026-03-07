import React, { useState, useRef, useEffect } from 'react';
import { Search, Play, Pause, Volume2, Loader2, Music, SkipBack, SkipForward, Mic2, X, Plus, ListMusic, Trash2, ArrowLeft, History, Repeat, Repeat1, Shuffle, Download, CheckCircle2, HardDriveDownload } from 'lucide-react';
import localforage from 'localforage';

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
  const [isSearching, setIsSearching] = useState(false);
  
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
  const [activeTab, setActiveTab] = useState<'search' | 'playlists' | 'history'>('search');
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

      // Trigger actual file download to user's device
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
    if (!query.trim()) return;
    
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
      // Clean up title to improve search results
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
      // Check if offline
      const offlineData: any = await localforage.getItem(`track_${permalink_url}`);
      if (offlineData && offlineData.blob) {
        const objectUrl = URL.createObjectURL(offlineData.blob);
        const trackWithLocalUrl = { ...offlineData.metadata, url: objectUrl };
        setCurrentTrack(trackWithLocalUrl);
        setIsPlaying(true);
        
        // Save to history
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
        
        // Save to history
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
          return; // End of queue, no repeat
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
          prevIndex = 0; // Just restart current song if at beginning
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
        // Create a shuffled copy of the queue
        const shuffled = [...queue];
        // Keep current track at index 0 if something is playing
        let currentTrackItem = null;
        if (queueIndex >= 0 && queueIndex < queue.length) {
          currentTrackItem = queue[queueIndex];
          shuffled.splice(queueIndex, 1);
        }
        
        // Fisher-Yates shuffle
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
        // Restore original queue index
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
      } else {
        audioRef.current.play();
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

      // Media Session API for background playback and lock screen controls
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.user,
          album: 'SoundStream',
          artwork: [
            { src: currentTrack.thumbnail || 'https://picsum.photos/seed/music/512/512', sizes: '512x512', type: 'image/png' }
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => {
          audioRef.current?.play();
          setIsPlaying(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audioRef.current?.pause();
          setIsPlaying(false);
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

  // Update Media Session position state periodically
  useEffect(() => {
    if ('mediaSession' in navigator && audioRef.current && !isNaN(audioRef.current.duration)) {
      navigator.mediaSession.setPositionState({
        duration: audioRef.current.duration,
        playbackRate: audioRef.current.playbackRate,
        position: audioRef.current.currentTime
      });
    }
  }, [progress, isPlaying]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col font-sans">
      {/* Header & Search */}
      <header className="p-4 sm:p-6 border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xl">
              <Music className="w-6 h-6" />
              <span>SoundStream</span>
            </div>
            <div className="flex bg-zinc-800/50 rounded-lg p-1 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => { setActiveTab('search'); setActivePlaylist(null); }}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'search' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Search
              </button>
              <button 
                onClick={() => setActiveTab('playlists')}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'playlists' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Playlists
              </button>
              <button 
                onClick={() => { setActiveTab('history'); setActivePlaylist(null); }}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'history' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                History
              </button>
              <button 
                onClick={() => { setActiveTab('downloads'); setActivePlaylist(null); }}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'downloads' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Downloads
              </button>
            </div>
          </div>
          {activeTab === 'search' && (
            <form onSubmit={handleSearch} className="flex-1 w-full relative" role="search" aria-label="Search music">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs, artists..."
                aria-label="Search query"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-full py-2.5 sm:py-3 px-5 pl-10 sm:pl-12 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm sm:text-base"
              />
              <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 h-5 text-zinc-400" aria-hidden="true" />
              <button 
                type="submit" 
                aria-label="Submit search"
                className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 p-1.5 sm:p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={isSearching}
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
              </button>
            </form>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-32 relative">
        {isLyricsOpen && currentTrack ? (
          <div className="absolute inset-x-0 top-0 bottom-0 bg-zinc-950/98 backdrop-blur-xl z-20 p-4 sm:p-8 md:p-12 overflow-y-auto rounded-xl border border-zinc-800/50 mx-2 sm:mx-6 mb-32 flex flex-col shadow-2xl">
            <div className="flex justify-between items-start mb-6 sm:mb-8 sticky top-0 bg-zinc-950/90 py-2 sm:py-4 backdrop-blur-md z-10 border-b border-zinc-800/50">
              <div className="pr-8">
                <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 line-clamp-2">{currentTrack.title}</h2>
                <p className="text-sm sm:text-base text-zinc-400">{currentTrack.user}</p>
              </div>
              <button 
                onClick={toggleLyrics}
                aria-label="Close lyrics"
                className="p-1.5 sm:p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-start py-4 sm:py-8">
              {isLoadingLyrics ? (
                <div className="flex flex-col items-center gap-4 text-zinc-400 my-auto">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  <p className="text-sm">Searching for lyrics...</p>
                </div>
              ) : lyrics ? (
                <div className="w-full max-w-2xl mx-auto">
                  <p className="whitespace-pre-wrap text-base sm:text-lg md:text-xl leading-relaxed text-zinc-300 font-medium text-center sm:text-left">
                    {lyrics}
                  </p>
                </div>
              ) : (
                <div className="my-auto text-zinc-500 text-center">
                  <Mic2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Lyrics not found for this track</p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'search' && (
          results.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-6">Search Results</h2>
              <div className="grid gap-3">
                {results.map((result, idx) => {
                  const artistMatch = result.permalink_url.match(/soundcloud\.com\/([^\/]+)/);
                  const artistName = artistMatch ? artistMatch[1].replace(/-/g, ' ') : 'Unknown Artist';
                  
                  return (
                  <div key={idx} className="flex items-center gap-2 group">
                    <button 
                      onClick={() => {
                        setQueue(results);
                        if (isShuffle) {
                          const shuffled = [...results];
                          shuffled.splice(idx, 1);
                          for (let i = shuffled.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                          }
                          shuffled.unshift(results[idx]);
                          setShuffledQueue(shuffled);
                          setQueueIndex(0);
                        } else {
                          setQueueIndex(idx);
                        }
                        playTrack(result.permalink_url);
                      }}
                      className="flex-1 text-left flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-800/50 cursor-pointer transition-colors border border-transparent hover:border-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label={`Play ${result.permalink.replace(/-/g, ' ')} by ${artistName}`}
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                        {result.artwork_url ? (
                          <img src={result.artwork_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Music className="w-6 h-6" aria-hidden="true" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-6 h-6 text-white fill-white" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-zinc-100 truncate">{result.permalink.replace(/-/g, ' ')}</h3>
                        <p className="text-sm text-zinc-400 truncate capitalize">{artistName}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-400">
                        {result.playback_count && <span className="hidden sm:inline-block">{(result.playback_count / 1000000).toFixed(1)}M plays</span>}
                        {result.duration && <span>{formatTime(result.duration / 1000)}</span>}
                      </div>
                    </button>
                    {downloadedTracks.some(t => t.permalink_url === result.permalink_url) ? (
                      <button 
                        onClick={(e) => removeDownload(e, result.permalink_url)}
                        className="p-3 text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl"
                        aria-label="Remove download"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => downloadTrack(e, result)}
                        disabled={downloadingTracks.has(result.permalink_url)}
                        className="p-3 text-zinc-400 hover:text-emerald-400 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl"
                        aria-label="Download track"
                      >
                        {downloadingTracks.has(result.permalink_url) ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                      </button>
                    )}
                    <button 
                      onClick={(e) => openAddModal(e, result)}
                      className="p-3 text-zinc-400 hover:text-emerald-400 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl"
                      aria-label="Add to playlist"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                )})}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <Music className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg">Search for a track to start listening</p>
            </div>
          )
        )}

        {activeTab === 'playlists' && !activePlaylist && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Playlists</h2>
            </div>
            
            <form onSubmit={createPlaylist} className="flex gap-2">
              <input 
                type="text" 
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value)}
                placeholder="New playlist name..."
                className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg py-2 px-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create
              </button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {playlists.length === 0 ? (
                <div className="col-span-full text-center py-12 text-zinc-500">
                  <ListMusic className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No playlists yet. Create one above!</p>
                </div>
              ) : (
                playlists.map(playlist => (
                  <div key={playlist.id} className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-4 flex items-center justify-between group hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => setActivePlaylist(playlist)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center text-emerald-500">
                        <ListMusic className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-medium text-zinc-100">{playlist.name}</h3>
                        <p className="text-sm text-zinc-400">{playlist.tracks.length} tracks</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id); }}
                      className="p-2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 focus:outline-none"
                      aria-label={`Delete playlist ${playlist.name}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'playlists' && activePlaylist && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActivePlaylist(null)}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                aria-label="Back to playlists"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-semibold">{activePlaylist.name}</h2>
              <span className="text-zinc-400 text-sm">{activePlaylist.tracks.length} tracks</span>
            </div>

            <div className="grid gap-3">
              {activePlaylist.tracks.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <p>This playlist is empty. Search for songs to add them!</p>
                </div>
              ) : (
                activePlaylist.tracks.map((result, idx) => {
                  const artistMatch = result.permalink_url.match(/soundcloud\.com\/([^\/]+)/);
                  const artistName = artistMatch ? artistMatch[1].replace(/-/g, ' ') : 'Unknown Artist';
                  
                  return (
                  <div key={idx} className="flex items-center gap-2 group">
                    <button 
                      onClick={() => {
                        setQueue(activePlaylist.tracks);
                        if (isShuffle) {
                          const shuffled = [...activePlaylist.tracks];
                          shuffled.splice(idx, 1);
                          for (let i = shuffled.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                          }
                          shuffled.unshift(activePlaylist.tracks[idx]);
                          setShuffledQueue(shuffled);
                          setQueueIndex(0);
                        } else {
                          setQueueIndex(idx);
                        }
                        playTrack(result.permalink_url);
                      }}
                      className="flex-1 text-left flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-800/50 cursor-pointer transition-colors border border-transparent hover:border-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label={`Play ${result.permalink.replace(/-/g, ' ')} by ${artistName}`}
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                        {result.artwork_url ? (
                          <img src={result.artwork_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Music className="w-6 h-6" aria-hidden="true" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-6 h-6 text-white fill-white" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-zinc-100 truncate">{result.permalink.replace(/-/g, ' ')}</h3>
                        <p className="text-sm text-zinc-400 truncate capitalize">{artistName}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-400">
                        {result.duration && <span>{formatTime(result.duration / 1000)}</span>}
                      </div>
                    </button>
                    {downloadedTracks.some(t => t.permalink_url === result.permalink_url) ? (
                      <button 
                        onClick={(e) => removeDownload(e, result.permalink_url)}
                        className="p-3 text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl"
                        aria-label="Remove download"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => downloadTrack(e, result)}
                        disabled={downloadingTracks.has(result.permalink_url)}
                        className="p-3 text-zinc-400 hover:text-emerald-400 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl"
                        aria-label="Download track"
                      >
                        {downloadingTracks.has(result.permalink_url) ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                      </button>
                    )}
                    <button 
                      onClick={() => removeFromPlaylist(activePlaylist.id, result.permalink_url)}
                      className="p-3 text-zinc-500 hover:text-red-400 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-xl"
                      aria-label="Remove from playlist"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )})
              )}
            </div>
          </div>
        )}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Listening History</h2>
              {history.length > 0 && (
                <button 
                  onClick={clearHistory}
                  className="text-sm text-zinc-400 hover:text-red-400 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" /> Clear History
                </button>
              )}
            </div>

            <div className="grid gap-3">
              {isLoadingHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No listening history yet. Play some tracks!</p>
                </div>
              ) : (
                history.map((track, idx) => (
                  <div key={idx} className="flex items-center gap-2 group">
                    <button 
                      onClick={() => {
                        if (track.permalink_url) {
                          setQueue(history);
                          if (isShuffle) {
                            const shuffled = [...history];
                            shuffled.splice(idx, 1);
                            for (let i = shuffled.length - 1; i > 0; i--) {
                              const j = Math.floor(Math.random() * (i + 1));
                              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                            }
                            shuffled.unshift(history[idx]);
                            setShuffledQueue(shuffled);
                            setQueueIndex(0);
                          } else {
                            setQueueIndex(idx);
                          }
                          playTrack(track.permalink_url);
                        }
                      }}
                      className="flex-1 text-left flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-800/50 cursor-pointer transition-colors border border-transparent hover:border-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label={`Play ${track.title} by ${track.user}`}
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                        {track.thumbnail ? (
                          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Music className="w-6 h-6" aria-hidden="true" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-6 h-6 text-white fill-white" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-zinc-100 truncate">{track.title}</h3>
                        <p className="text-sm text-zinc-400 truncate capitalize">{track.user}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-400">
                        {track.played_at && <span className="hidden sm:inline-block text-xs">{new Date(track.played_at).toLocaleString()}</span>}
                        {track.duration && <span>{formatTime(track.duration / 1000)}</span>}
                      </div>
                    </button>
                    {downloadedTracks.some(t => t.permalink_url === track.permalink_url) ? (
                      <button 
                        onClick={(e) => removeDownload(e, track.permalink_url!)}
                        className="p-3 text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl"
                        aria-label="Remove download"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => downloadTrack(e, track)}
                        disabled={downloadingTracks.has(track.permalink_url!)}
                        className="p-3 text-zinc-400 hover:text-emerald-400 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl"
                        aria-label="Download track"
                      >
                        {downloadingTracks.has(track.permalink_url!) ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {activeTab === 'downloads' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Offline Downloads</h2>
            </div>

            <div className="grid gap-3">
              {downloadedTracks.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <HardDriveDownload className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No downloaded tracks yet. Download some songs to listen offline!</p>
                </div>
              ) : (
                downloadedTracks.map((track, idx) => (
                  <div key={idx} className="flex items-center gap-2 group">
                    <button 
                      onClick={() => {
                        if (track.permalink_url) {
                          setQueue(downloadedTracks);
                          if (isShuffle) {
                            const shuffled = [...downloadedTracks];
                            shuffled.splice(idx, 1);
                            for (let i = shuffled.length - 1; i > 0; i--) {
                              const j = Math.floor(Math.random() * (i + 1));
                              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                            }
                            shuffled.unshift(downloadedTracks[idx]);
                            setShuffledQueue(shuffled);
                            setQueueIndex(0);
                          } else {
                            setQueueIndex(idx);
                          }
                          playTrack(track.permalink_url);
                        }
                      }}
                      className="flex-1 text-left flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-800/50 cursor-pointer transition-colors border border-transparent hover:border-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label={`Play ${track.title} by ${track.user}`}
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
                        {track.thumbnail ? (
                          <img src={track.thumbnail} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <Music className="w-6 h-6" aria-hidden="true" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-6 h-6 text-white fill-white" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-zinc-100 truncate">{track.title}</h3>
                        <p className="text-sm text-zinc-400 truncate capitalize">{track.user}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-zinc-400">
                        {track.duration && <span>{formatTime(track.duration / 1000)}</span>}
                      </div>
                    </button>
                    <button 
                      onClick={(e) => removeDownload(e, track.permalink_url!)}
                      className="p-3 text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl"
                      aria-label="Remove download"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add to Playlist Modal */}
      {isAddModalOpen && trackToAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Add to Playlist</h3>
              <button 
                onClick={() => { setIsAddModalOpen(false); setTrackToAdd(null); }}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-zinc-400 mb-2">Select a playlist:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {playlists.length === 0 ? (
                  <p className="text-zinc-500 text-sm italic">No playlists available.</p>
                ) : (
                  playlists.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => addToPlaylist(p.id, trackToAdd)}
                      className="w-full text-left px-4 py-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors flex items-center justify-between group focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <span className="font-medium">{p.name}</span>
                      <Plus className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400" />
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-400 mb-2">Or create a new one:</p>
              <form onSubmit={createPlaylist} className="flex gap-2">
                <input 
                  type="text" 
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  placeholder="Playlist name..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg py-2 px-4 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-2 rounded-lg font-medium transition-colors">
                  Create
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Player */}
      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-3 sm:p-4 z-50">
          <canvas 
            ref={canvasRef} 
            width={1024} 
            height={64} 
            className="absolute bottom-full left-0 w-full h-16 pointer-events-none opacity-80"
          />
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-6 relative z-10">
            <div className="flex items-center gap-3 w-full sm:w-1/3 min-w-0">
              <img 
                src={currentTrack.thumbnail || "https://picsum.photos/seed/music/100/100"} 
                alt={currentTrack.title} 
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-md object-cover flex-shrink-0"
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-zinc-100 truncate text-xs sm:text-sm">{currentTrack.title}</div>
                <div className="text-[10px] sm:text-xs text-zinc-400 truncate">{currentTrack.user}</div>
              </div>
              <div className="flex sm:hidden items-center gap-1">
                <button 
                  onClick={toggleLyrics}
                  className={`p-2 rounded-full ${isLyricsOpen ? 'text-emerald-400' : 'text-zinc-400'}`}
                >
                  <Mic2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="w-full sm:flex-1 flex flex-col items-center gap-1 sm:gap-2">
              <div className="flex items-center gap-3 sm:gap-4">
                <button 
                  onClick={toggleShuffle}
                  className={`transition-colors p-1.5 sm:p-2 rounded-full ${isShuffle ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400'}`}
                >
                  <Shuffle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button 
                  onClick={playPrevious}
                  className="text-zinc-400 hover:text-zinc-100 disabled:opacity-50 p-1"
                >
                  <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                </button>
                <button 
                  onClick={togglePlay}
                  className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
                >
                  {isLoadingTrack ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
                  )}
                </button>
                <button 
                  onClick={playNext}
                  className="text-zinc-400 hover:text-zinc-100 disabled:opacity-50 p-1"
                >
                  <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                </button>
                <button 
                  onClick={toggleRepeat}
                  className={`transition-colors p-1.5 sm:p-2 rounded-full ${repeatMode !== 'off' ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400'}`}
                >
                  {repeatMode === 'one' ? <Repeat1 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Repeat className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </button>
              </div>
              <div className="w-full flex items-center gap-2 text-[10px] sm:text-xs text-zinc-400">
                <span className="w-8 text-right">{formatTime(progress)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={progress}
                  onChange={handleSeek}
                  className="flex-1 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer"
                />
                <span className="w-8">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="w-1/3 hidden sm:flex items-center justify-end gap-4">
              <button 
                onClick={toggleLyrics}
                className={`transition-colors p-2 rounded-full ${isLyricsOpen ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400 hover:text-zinc-100'}`}
              >
                <Mic2 className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-16 md:w-24 h-1 bg-zinc-700 rounded-full appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
          <audio
            ref={audioRef}
            src={currentTrack.url}
            crossOrigin="anonymous"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleTrackEnd}
            onLoadedMetadata={() => {
              if (audioRef.current) {
                setDuration(audioRef.current.duration);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
