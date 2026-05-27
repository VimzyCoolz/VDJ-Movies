import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Library, Upload, User, Search, Play, X, CheckCircle2, DownloadCloud, ChevronRight, AlertTriangle, Settings, Pause, Maximize, Minimize, Trash2, Image as ImageIcon, TrendingUp, Menu } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

// --- Components ---

const VideoPlayer = ({ movie, onClose, user }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const [zoomMode, setZoomMode] = useState('fit'); // 'fit', 'stretch', 'crop'
  const [watchedTime, setWatchedTime] = useState(0);
  const [viewRegistered, setViewRegistered] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const controlsTimeoutRef = useRef(null);

  useEffect(() => {
    // Check if already viewed in this session/device to prevent redundant logic
    const userId = user?.username || localStorage.getItem('vdj_anon_id') || 'anon';
    const viewedKey = `viewed_${movie.id}_${userId}`;
    if (localStorage.getItem(viewedKey)) {
      setViewRegistered(true);
    }
  }, [movie.id, user]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Accumulator logic: count actual seconds played
    const interval = setInterval(() => {
      if (video && !video.paused && !video.seeking && !viewRegistered && duration > 0) {
        setWatchedTime(prev => {
          const nextTime = prev + 1;
          const threshold = duration * 0.375;
          
          if (nextTime >= threshold) {
            registerView();
            return nextTime;
          }
          return nextTime;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [duration, viewRegistered]);

  const registerView = async () => {
    if (viewRegistered) return;
    
    // Mark as registered locally first to prevent race conditions
    setViewRegistered(true);
    
    // Get or create a persistent anonymous ID if not logged in
    let userId = user?.username;
    if (!userId) {
      userId = localStorage.getItem('vdj_anon_id');
      if (!userId) {
        userId = `anon_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('vdj_anon_id', userId);
      }
    }

    const viewedKey = `viewed_${movie.id}_${userId}`;
    localStorage.setItem(viewedKey, 'true');

    try {
      await axios.post(`${API_BASE_URL}/movies/${movie.id}/view`, {
        userId: userId
      });
      console.log("View registered successfully for threshold 37.5%");
    } catch (err) {
      console.error("Failed to register view:", err);
    }
  };

  useEffect(() => {
    // Request full screen on mount
    const enterFullscreen = async () => {
      try {
        if (playerRef.current?.requestFullscreen) {
          await playerRef.current.requestFullscreen();
        } else if (playerRef.current?.webkitRequestFullscreen) {
          await playerRef.current.webkitRequestFullscreen();
        } else if (playerRef.current?.msRequestFullscreen) {
          await playerRef.current.msRequestFullscreen();
        }
      } catch (err) {
        console.warn("Fullscreen request failed:", err);
      }
    };

    enterFullscreen();

    // Attempt to lock to landscape if supported
    if (window.screen?.orientation?.lock) {
      window.screen.orientation.lock('landscape').catch(() => {});
    }
    
    const handleOrientationChange = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    
    window.addEventListener('resize', handleOrientationChange);
    handleOrientationChange();
    
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      if (window.screen?.orientation?.unlock) {
        window.screen.orientation.unlock();
      }
      // Exit fullscreen on unmount
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
    };
  }, []);

  const togglePlay = () => {
    if (isLocked) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetControlsTimeout();
  };

  const handleVideoClick = () => {
    if (isLocked) {
      if (showControls) {
        setShowControls(false);
      } else {
        resetControlsTimeout();
      }
    } else {
      togglePlay();
    }
  };

  const toggleZoomMode = () => {
    if (isLocked) return;
    const modes = ['fit', 'stretch', 'crop'];
    const nextIndex = (modes.indexOf(zoomMode) + 1) % modes.length;
    setZoomMode(modes[nextIndex]);
    resetControlsTimeout();
  };

  const toggleLock = (e) => {
    e.stopPropagation();
    const newLockedState = !isLocked;
    setIsLocked(newLockedState);
    if (newLockedState) {
      setShowControls(false);
    } else {
      resetControlsTimeout();
    }
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getObjectFitClass = () => {
    switch (zoomMode) {
      case 'stretch': return 'object-fill';
      case 'crop': return 'object-cover';
      default: return 'object-contain';
    }
  };

  const getZoomLabel = () => {
    switch (zoomMode) {
      case 'stretch': return 'STRETCH (Fill)';
      case 'crop': return 'CROP (Zoom)';
      default: return 'FIT (Original)';
    }
  };

  return (
    <div 
      ref={playerRef}
      className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center overflow-hidden"
    >
      <video
        ref={videoRef}
        src={`${API_BASE_URL}/stream/${movie.telegram_message_id}`}
        className={`w-full h-full transition-all duration-300 ${getObjectFitClass()}`}
        playsInline
        autoPlay
        onClick={handleVideoClick}
        onMouseMove={resetControlsTimeout}
      />

      {/* Close Button */}
      {showControls && (
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white z-[110] hover:bg-black/80 transition-colors"
        >
          <X size={24} />
        </button>
      )}

      {/* Play/Pause Overlay Icon */}
      {showControls && !isLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 p-6 rounded-full animate-fade-out">
            {isPlaying ? <Pause size={48} fill="white" /> : <Play size={48} fill="white" />}
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-4">
          {!isLocked ? (
            <>
              <div className="flex items-center gap-4">
                <span className="text-white text-xs font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <div className="flex-1 h-1.5 bg-gray-600/50 rounded-full overflow-hidden cursor-pointer">
                  <div 
                    className="h-full bg-gold transition-all duration-300 relative" 
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
                  </div>
                </div>
                
                <button 
                  onClick={toggleZoomMode}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-[10px] font-black uppercase tracking-tighter transition-all"
                >
                  <Maximize size={14} />
                  <span>{getZoomLabel()}</span>
                </button>

                <button 
                  onClick={toggleLock}
                  className="flex items-center gap-1 text-white text-xs font-bold"
                >
                  <Settings size={16} />
                  <span>Hide</span>
                </button>
              </div>
              
              <div className="flex justify-between items-center">
                <h3 className="text-white font-bold text-sm truncate max-w-[70%]">{movie.title}</h3>
                <div className="flex gap-4">
                  {/* Future controls like volume/speed can go here */}
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-end">
              <button 
                onClick={toggleLock}
                className="flex items-center gap-1 text-white text-xs font-bold bg-white/10 px-4 py-2 rounded-xl border border-white/20 transition-all active:scale-95"
              >
                <Settings size={16} />
                <span>Unhide</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const MovieBottomSheet = ({ movie, isOpen, onClose, onPlay }) => {
  if (!isOpen || !movie) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="relative w-full max-w-md bg-[#121212] rounded-t-[32px] overflow-hidden flex flex-col h-[70vh] shadow-2xl animate-slide-up">
        {/* Banner */}
        <div className="relative w-full aspect-video">
          <img 
            src={movie.thumbnail_url || movie.thumbnail || `https://picsum.photos/seed/${movie.id}/600/340`} 
            alt={movie.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent" />
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 -mt-8 relative z-10">
          <h2 className="text-2xl font-black text-white leading-tight mb-1">
            {movie.title} – {movie.dj_name}
          </h2>
          
          <div className="flex items-center gap-3 text-xs font-bold text-gray-400 mb-4">
            <span className="flex items-center gap-1">⭐ {movie.views || 0} WATCHED</span>
            <span className="w-1 h-1 bg-gray-600 rounded-full" />
            <span className="text-gold uppercase tracking-widest">{movie.genre}</span>
            <span className="w-1 h-1 bg-gray-600 rounded-full" />
            <span>{movie.size || '205 MB'}</span>
          </div>

          <p className="text-sm text-gray-300 leading-relaxed mb-8">
            {movie.summary || "No description available for this movie."}
            <br />
            <div className="flex flex-col gap-1 mt-4">
              <span className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1">
                🎙️ Narrator: <span className="text-gray-300">{movie.dj_name}</span>
              </span>
              <span className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1">
                👤 VDJ Publisher: <span className="text-gold">{movie.publisher_name || 'Anonymous'}</span>
              </span>
            </div>
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => onPlay(movie)}
              className="w-full bg-gold hover:bg-[#e6b800] text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-gold/20"
            >
              <Play size={24} fill="black" />
              PLAY
            </button>
            
            <div className="flex gap-3">
              <button 
                onClick={() => console.log('Download link requested')}
                className="flex-1 bg-[#252525] text-gray-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm active:scale-95 transition-all"
              >
                <DownloadCloud size={18} />
                Download
              </button>
              
              <button 
                onClick={() => console.log('Report tool requested')}
                className="w-[30%] border border-gray-800 text-gray-500 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-[10px] active:scale-95 transition-all"
              >
                <AlertTriangle size={14} />
                REPORT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Navigation = ({ isDesktopOpen, setIsDesktopOpen }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  const NavLinks = () => (
    <>
      <Link to="/" onClick={() => setIsDesktopOpen(false)} className={`flex flex-col md:flex-row items-center gap-1 md:gap-4 md:px-6 md:py-4 md:w-full md:hover:bg-white/5 transition-all ${isActive('/') ? 'text-gold' : 'text-gray-500'}`}>
        <Home size={24} />
        <span className="text-[10px] md:text-sm font-black md:uppercase md:tracking-widest">Home</span>
      </Link>
      <Link to="/library" onClick={() => setIsDesktopOpen(false)} className={`flex flex-col md:flex-row items-center gap-1 md:gap-4 md:px-6 md:py-4 md:w-full md:hover:bg-white/5 transition-all ${isActive('/library') ? 'text-gold' : 'text-gray-500'}`}>
        <Library size={24} />
        <span className="text-[10px] md:text-sm font-black md:uppercase md:tracking-widest">Library</span>
      </Link>
      <Link to="/upload" onClick={() => setIsDesktopOpen(false)} className={`flex flex-col md:flex-row items-center gap-1 md:gap-4 md:px-6 md:py-4 md:w-full md:hover:bg-white/5 transition-all ${isActive('/upload') ? 'text-gold' : 'text-gray-500'}`}>
        <Upload size={24} />
        <span className="text-[10px] md:text-sm font-black md:uppercase md:tracking-widest">Upload</span>
      </Link>
      <Link to="/profile" onClick={() => setIsDesktopOpen(false)} className={`flex flex-col md:flex-row items-center gap-1 md:gap-4 md:px-6 md:py-4 md:w-full md:hover:bg-white/5 transition-all ${isActive('/profile') ? 'text-gold' : 'text-gray-500'}`}>
        <User size={24} />
        <span className="text-[10px] md:text-sm font-black md:uppercase md:tracking-widest">Profile</span>
      </Link>
    </>
  );

  return (
    <>
      {/* Mobile Navigation - Horizontal Bottom Bar (Unchanged) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-gray-800 flex items-center justify-around px-4 z-50 md:hidden">
        <NavLinks />
      </nav>

      {/* Desktop Navigation - Vertical Side Bar */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 w-72 bg-[#0a0a0a] border-r border-white/5 z-[60] transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hidden md:flex flex-col pt-24 shadow-2xl ${
          isDesktopOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 mb-8">
          <img src="/images/VDJ LOGO.png" alt="VDJ Logo" className="h-12 w-auto" />
        </div>
        <div className="flex flex-col gap-2">
          <NavLinks />
        </div>
        
        <div className="mt-auto p-6 border-t border-white/5">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">© 2026 VDJ MOVIES</p>
        </div>
      </aside>
      
      {/* Desktop Overlay for no-shift slide-out */}
      {isDesktopOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] hidden md:block animate-in fade-in duration-500" 
          onClick={() => setIsDesktopOpen(false)}
        />
      )}
    </>
  );
};

const MovieCard = ({ movie, onClick }) => (
  <div 
    className="flex-shrink-0 w-32 md:w-44 aspect-[2/3] bg-gray-900 rounded-md overflow-hidden relative group movie-card cursor-pointer"
    onClick={() => onClick(movie)}
  >
    <img 
      src={movie.thumbnail_url || movie.thumbnail || `https://picsum.photos/seed/${movie.id}/300/450`} 
      alt={movie.title}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
    />
    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
      <Play fill="white" size={32} />
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent">
      <p className="text-[10px] font-bold truncate">{movie.title}</p>
      <p className="text-[8px] text-gray-300">{movie.dj_name}</p>
    </div>
  </div>
);

const GenreRow = ({ title, movies, onMovieClick }) => (
  <div className="flex flex-col gap-3 py-4">
    <div className="flex items-center justify-between px-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        {title === 'Action' && '💥'}
        {title === 'Kihindi' && '💃'}
        {title === 'Comedy' && '🎭'}
        {title === 'Horror' && '👻'}
        {title}
      </h2>
      <ChevronRight size={20} className="text-gray-500" />
    </div>
    <div className="flex gap-3 overflow-x-auto px-4 no-scrollbar scroll-smooth">
      {movies.map(movie => (
        <MovieCard key={movie.id} movie={movie} onClick={onMovieClick} />
      ))}
    </div>
  </div>
);

// --- Utilities ---

/**
 * Calculates the similarity score between two strings using Levenshtein distance
 * and Damerau-Levenshtein logic (for transpositions).
 * Returns a score between 0 and 1.
 */
const getSimilarity = (s1, s2) => {
  if (!s1 || !s2) return 0;
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
  }

  const l1 = s1.length;
  const l2 = s2.length;
  const matrix = Array(l1 + 1).fill(null).map(() => Array(l2 + 1).fill(0));

  for (let i = 0; i <= l1; i++) matrix[i][0] = i;
  for (let j = 0; j <= l2; j++) matrix[0][j] = j;

  for (let i = 1; i <= l1; i++) {
    for (let j = 1; j <= l2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
      
      // Damerau adjustment for transpositions
      if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }

  const distance = matrix[l1][l2];
  const maxLen = Math.max(l1, l2);
  return 1 - distance / maxLen;
};

// --- Pages ---

const DEFAULT_QUERIES = [
  "DJ Afro Action",
  "DJ Smith Comedy",
  "Latest Kihindi 2024",
  "Best Horror Movies"
];

const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] w-full p-8 animate-in fade-in duration-700">
    <div className="relative w-48 h-48 md:w-64 md:h-64 mb-6">
      {/* Mobile Loading Image */}
      <img 
        src="/images/VDJ LOADING.png" 
        className="w-full h-full object-contain md:hidden animate-pulse" 
        alt="Loading..." 
      />
      {/* Desktop Loading Image */}
      <img 
        src="/images/LOADING_PC.png" 
        className="w-full h-full object-contain hidden md:block animate-pulse" 
        alt="Loading..." 
      />
    </div>
    <div className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden relative">
      <div className="absolute inset-0 bg-gold animate-shimmer" />
    </div>
    <p className="mt-4 text-[10px] font-black text-gold uppercase tracking-[0.3em] opacity-50">Syncing Archives...</p>
  </div>
);

const HomeScreen = ({ onMovieClick }) => {
  const [movies, setMovies] = useState([]);
  const [suggestions, setSuggestions] = useState(DEFAULT_QUERIES);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [trendingIndex, setTrendingIndex] = useState(0);
  const [isFuzzyMatch, setIsFuzzyMatch] = useState(false);
  const searchInputRef = useRef(null);
  
  // Trending rotation logic (5 seconds)
  useEffect(() => {
    if (isFocused || searchQuery || suggestions.length === 0) return;
    
    const interval = setInterval(() => {
      setTrendingIndex((prev) => (prev + 1) % suggestions.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isFocused, searchQuery, suggestions]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [moviesRes, suggestionsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/movies`),
          axios.get(`${API_BASE_URL}/suggestions`)
        ]);
        
        setMovies(Array.isArray(moviesRes.data) ? moviesRes.data : []);
        
        if (Array.isArray(suggestionsRes.data) && suggestionsRes.data.length > 0) {
          setSuggestions(suggestionsRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setMovies([]); 
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const { filteredMovies, isFuzzy } = React.useMemo(() => {
    if (!searchQuery.trim()) return { filteredMovies: movies, isFuzzy: false };
    
    const query = searchQuery.toLowerCase().trim();
    
    // 1. Try Exact/Substring Matching
    const exactMatches = movies.filter(movie => 
      (movie.title && movie.title.toLowerCase().includes(query)) || 
      (movie.dj_name && movie.dj_name.toLowerCase().includes(query)) ||
      (movie.genre && movie.genre.toLowerCase().includes(query))
    );

    if (exactMatches.length > 0) {
      return { filteredMovies: exactMatches, isFuzzy: false };
    }

    // 2. Fuzzy Matching (Triggered only if no exact matches)
    const fuzzyResults = movies.map(movie => {
      const titleScore = getSimilarity(movie.title || '', query);
      const djScore = getSimilarity(movie.dj_name || '', query);
      const genreScore = getSimilarity(movie.genre || '', query);
      const maxScore = Math.max(titleScore, djScore, genreScore);
      
      return { ...movie, score: maxScore };
    })
    .filter(movie => movie.score >= 0.1) // 10% threshold
    .sort((a, b) => b.score - a.score);

    return { filteredMovies: fuzzyResults, isFuzzy: fuzzyResults.length > 0 };
  }, [movies, searchQuery]);

  // Sync isFuzzyMatch state for UI feedback
  useEffect(() => {
    setIsFuzzyMatch(isFuzzy);
  }, [isFuzzy]);

  const getMoviesByGenre = (genre) => {
    if (!Array.isArray(filteredMovies)) return [];
    return filteredMovies.filter(m => m.genre === genre);
  };

  const handleSuggestionClick = (query) => {
    setSearchQuery(query);
    setIsFocused(false);
    if (searchInputRef.current) searchInputRef.current.blur();
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="pb-20">
      {/* Search Bar at the very top */}
      <div className="sticky top-0 bg-[#0f0f0f] z-40 p-4 pt-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 z-10" size={20} />
          <input 
            ref={searchInputRef}
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={!isFocused && !searchQuery ? "" : "Search DJ Afro, DJ Smith, or movie titles..."} 
            className="w-full bg-[#1e1e1e] border-none rounded-full py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-gold outline-none placeholder:text-gray-500 transition-all duration-300"
          />
          
          {/* Rotating Suggestion Label (Idle state) */}
           {!isFocused && !searchQuery && (
             <div className="absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2 overflow-hidden w-[calc(100%-4rem)]">
               <span className="text-gray-500 text-sm whitespace-nowrap">Try:</span>
               <div className="relative h-5 flex-1">
                 {suggestions.map((q, idx) => (
                   <span 
                     key={q}
                     className={`absolute inset-0 text-gray-400 text-sm font-medium transition-all duration-700 transform ${
                       idx === trendingIndex ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                     }`}
                   >
                     {q}
                   </span>
                 ))}
               </div>
             </div>
           )}

           {/* Dropdown Suggestions Panel */}
          {isFocused && !searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1e1e1e] rounded-2xl border border-gray-800 shadow-2xl overflow-hidden animate-slide-up z-50">
               <div className="p-3 border-b border-gray-800/50 flex items-center justify-between">
                 <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Trending Searches</span>
                 <TrendingUp size={12} className="text-green-500" />
               </div>
               <div className="max-h-[350px] overflow-y-auto no-scrollbar">
                 {suggestions.map((query, index) => (
                   <button
                     key={index}
                     type="button"
                     onClick={() => handleSuggestionClick(query)}
                     className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-white/5 active:bg-white/10 transition-colors border-b border-gray-800/30 last:border-none group text-left"
                   >
                     <div className="p-1.5 rounded-lg bg-green-500/10 text-green-500 group-hover:scale-110 transition-transform">
                       <TrendingUp size={14} />
                     </div>
                     <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">{query}</span>
                   </button>
                 ))}
               </div>
             </div>
           )}
        </div>
      </div>

      {filteredMovies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-10 text-center opacity-50">
          <Play size={48} className="mb-4 text-gray-600" />
          <p className="text-sm font-medium">
            {searchQuery ? `No results for "${searchQuery}"` : "No movies published yet."}<br/>
            {searchQuery ? "Try searching for something else." : "Upload content to see it here."}
          </p>
        </div>
      ) : (
        <>
          {searchQuery ? (
            <div className="px-4 py-2 flex flex-col gap-6 animate-slide-up">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest">Search Results ({filteredMovies.length})</h2>
                  <button onClick={() => setSearchQuery('')} className="text-[10px] font-black text-gold uppercase tracking-widest">Clear</button>
                </div>
                {isFuzzyMatch && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-blue-500" />
                    <p className="text-[10px] font-bold text-blue-400">No exact matches found. Showing results for matching search instead.</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredMovies.map(movie => (
                  <MovieCard key={movie.id} movie={movie} onClick={onMovieClick} />
                ))}
              </div>
            </div>
          ) : (
            <>
              <GenreRow title="Action" movies={getMoviesByGenre('Action')} onMovieClick={onMovieClick} />
              <GenreRow title="Kihindi" movies={getMoviesByGenre('Kihindi')} onMovieClick={onMovieClick} />
              <GenreRow title="Comedy" movies={getMoviesByGenre('Comedy')} onMovieClick={onMovieClick} />
              <GenreRow title="Horror" movies={getMoviesByGenre('Horror')} onMovieClick={onMovieClick} />
              <GenreRow title="Sci-Fi" movies={getMoviesByGenre('Sci-Fi')} onMovieClick={onMovieClick} />
            </>
          )}
        </>
      )}
    </div>
  );
};

const LibraryScreen = () => {
  // Empty states for production
  const downloading = [];
  const downloaded = [];


  return (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">Your Offline Vault</h1>
      
      {/* Currently Downloading */}
      <section className="mb-8">
        <h2 className="text-secondary text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          <DownloadCloud size={16} /> Currently Downloading
        </h2>
        <div className="flex flex-col gap-4">
          {downloading.map(item => (
            <div key={item.id} className="bg-[#1e1e1e] p-4 rounded-xl border border-gray-800">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm truncate mr-4">{item.title}</span>
                <button className="text-red-500 p-1"><X size={18} /></button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${item.progress}%` }}></div>
                </div>
                <span className="text-[10px] font-bold text-gold">{item.progress}% Done</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Downloaded Videos */}
      <section>
        <h2 className="text-secondary text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} /> Downloaded Videos
        </h2>
        <div className="flex flex-col gap-3">
          {downloaded.map(item => (
            <div key={item.id} className="bg-[#1e1e1e] p-4 rounded-xl flex items-center justify-between border border-gray-800 active:bg-gray-800 transition-colors">
              <div className="flex flex-col">
                <span className="font-bold text-sm">{item.title}</span>
                <span className="text-[10px] text-gray-500">{item.size} • Ready to watch offline</span>
              </div>
              <Play size={20} className="text-gold" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const UploadScreen = ({ user }) => {
  const [formData, setFormData] = useState({
    dj_name: '',
    title: '',
    summary: '',
    genre: 'Action'
  });
  const [file, setFile] = useState(null);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cloudProgress, setCloudProgress] = useState(0);
  const [error, setError] = useState(null);
  const [coverMode, setCoverMode] = useState('upload'); // 'upload' or 'frame'
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);

  const genres = ['Action', 'Kihindi', 'Comedy', 'Horror', 'Sci-Fi'];

  // Calculate Overall Progress: 50% Step 1, 50% Step 2
  const overallProgress = progress < 100 
    ? Math.floor(progress / 2) 
    : 50 + Math.floor(cloudProgress / 2);

  const handleFileChange = (e) => {
     const selectedFile = e.target.files[0];
     if (selectedFile) {
       if (selectedFile.size > 2000 * 1024 * 1024) {
         setError("File is too large (Max 2GB). Please compress the movie or use a smaller file.");
         setFile(null);
         setVideoUrl(null);
       } else {
         setError(null);
         setFile(selectedFile);
         setVideoUrl(URL.createObjectURL(selectedFile));
       }
     }
   };

  const handleCoverChange = (e) => {
    const selectedCover = e.target.files[0];
    if (selectedCover) {
      if (selectedCover.size > 5 * 1024 * 1024) {
        setError("Cover image too large (Max 5MB).");
      } else {
        setCoverImage(selectedCover);
        setCoverPreview(URL.createObjectURL(selectedCover));
      }
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        const frameFile = new File([blob], "cover_frame.jpg", { type: "image/jpeg" });
        setCoverImage(frameFile);
        setCoverPreview(URL.createObjectURL(frameFile));
      }, 'image/jpeg', 0.95);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    if (!user) {
      setError("You must be logged in to publish movies.");
      return;
    }

    setError(null);
    const data = new FormData();
    data.append('dj_name', formData.dj_name);
    data.append('title', formData.title);
    data.append('summary', formData.summary);
    data.append('genre', formData.genre);
    data.append('movie_file', file);
    if (coverImage) {
      data.append('cover_image', coverImage);
    }
    data.append('publisher_name', user.username);

    setUploading(true);
    setProgress(0);
    setCloudProgress(0);

    let cloudInterval = null;

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000, 
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);

          if (percentCompleted === 100 && !cloudInterval) {
            cloudInterval = setInterval(() => {
              setCloudProgress(prev => {
                if (prev >= 98) return 98;
                return prev + 1;
              });
            }, 1500); 
          }
        }
      });

      if (response.data.success) {
        if (cloudInterval) clearInterval(cloudInterval);
        setCloudProgress(100);
        setFormData({ dj_name: '', title: '', summary: '', genre: 'Action' });
        setFile(null);
        setCoverImage(null);
        setCoverPreview(null);
        setVideoUrl(null);
        setProgress(0);
        window.location.href = '/'; 
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
      setProgress(0);
      setError(error.response?.data?.details || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">Creator Content Portal</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">DJ Name</label>
          <input 
            type="text" 
            placeholder="e.g., DJ Afro, DJ Smith, DJ Sky"
            className="bg-[#1e1e1e] border-none rounded-xl p-4 text-sm focus:ring-1 focus:ring-gold outline-none"
            value={formData.dj_name}
            onChange={(e) => setFormData({...formData, dj_name: e.target.value})}
            required
            disabled={uploading}
          />
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Movie Title</label>
          <input 
            type="text" 
            placeholder="e.g., Transporter 3"
            className="bg-[#1e1e1e] border-none rounded-xl p-4 text-sm focus:ring-1 focus:ring-gold outline-none"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
            disabled={uploading}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Summary of the Movie</label>
          <textarea 
            rows={3}
            placeholder="A short, catchy description..."
            className="bg-[#1e1e1e] border-none rounded-xl p-4 text-sm focus:ring-1 focus:ring-gold resize-none outline-none"
            value={formData.summary}
            onChange={(e) => setFormData({...formData, summary: e.target.value})}
            disabled={uploading}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Genre / Type</label>
          <select 
            className="bg-[#1e1e1e] border-none rounded-xl p-4 text-sm focus:ring-1 focus:ring-gold appearance-none outline-none"
            value={formData.genre}
            onChange={(e) => setFormData({...formData, genre: e.target.value})}
            disabled={uploading}
          >
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Movie File (Direct Uplift)</label>
          <div className="relative group">
            {uploading && (
              <div 
                className="absolute -inset-1 rounded-2xl border-2 border-green-500/50 animate-pulse pointer-events-none z-10"
                style={{ opacity: Math.max(0.3, overallProgress / 100) }}
              />
            )}
            <input 
              type="file" 
              accept="video/*"
              className="hidden"
              id="file-upload"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <label 
              htmlFor="file-upload" 
              className={`relative flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${file ? 'border-gold bg-gold/5 text-gold' : 'border-gray-700 hover:border-gray-500 text-gray-500'} ${error ? 'border-red-500 bg-red-500/5 text-red-500' : ''}`}
            >
              {file ? <CheckCircle2 size={20} /> : <Upload size={20} />}
              <span className="text-sm font-bold truncate max-w-[200px]">
                {file ? file.name : (error ? 'File too large' : 'Select movie file from device')}
              </span>
              
              {uploading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end">
                  <span className="text-green-500 font-black text-sm leading-none">{overallProgress}%</span>
                  <span className="text-[7px] text-green-500 font-black uppercase tracking-tighter">OVERALL</span>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Custom Video Cover Section */}
        <div className="flex flex-col gap-3 p-4 bg-[#1e1e1e] rounded-2xl border border-gray-800">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Video Cover / Thumbnail</label>
            <div className="flex bg-black/40 rounded-lg p-1">
              <button 
                type="button"
                onClick={() => setCoverMode('upload')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${coverMode === 'upload' ? 'bg-gold text-black' : 'text-gray-500'}`}
              >UPLOAD</button>
              <button 
                type="button"
                onClick={() => setCoverMode('frame')}
                disabled={!file}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${coverMode === 'frame' ? 'bg-gold text-black' : 'text-gray-500 disabled:opacity-30'}`}
              >SELECT FRAME</button>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <div className="w-32 aspect-video bg-black rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center relative">
              {coverPreview ? (
                <img src={coverPreview} className="w-full h-full object-cover" alt="Cover Preview" />
              ) : (
                <ImageIcon className="text-gray-700" size={24} />
              )}
            </div>
            
            <div className="flex-1 flex flex-col gap-2">
              {coverMode === 'upload' ? (
                <>
                  <p className="text-[10px] text-gray-500">Upload a custom high-quality JPG/PNG cover image (Max 5MB).</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    id="cover-upload" 
                    onChange={handleCoverChange}
                    disabled={uploading}
                  />
                  <label 
                    htmlFor="cover-upload"
                    className="bg-[#252525] text-gray-300 text-xs font-bold py-2 px-4 rounded-lg cursor-pointer hover:bg-[#333] transition-all text-center"
                  >
                    CHOOSE IMAGE
                  </label>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-gray-500">Seek through the video and capture the perfect frame.</p>
                  <button 
                    type="button"
                    onClick={captureFrame}
                    className="bg-gold/10 text-gold text-xs font-bold py-2 px-4 rounded-lg hover:bg-gold/20 transition-all text-center border border-gold/20"
                  >
                    CAPTURE CURRENT FRAME
                  </button>
                </>
              )}
            </div>
          </div>

          {coverMode === 'frame' && videoUrl && (
            <div className="mt-2 flex flex-col gap-2">
              <video 
                ref={videoRef}
                src={videoUrl}
                className="w-full rounded-xl border border-gray-800 bg-black max-h-[200px]"
                controls
                onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>

        {uploading && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between text-[10px] font-black text-gold uppercase tracking-tighter">
              <span>{progress < 100 ? `Step 1: Uplink (${progress}%)` : `Step 2: Syncing (${cloudProgress}%)`}</span>
              <span className="text-green-500">{overallProgress}% TOTAL</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-gold transition-all duration-300" 
                style={{ width: progress < 100 ? `${progress}%` : '100%' }}
              >
                {progress === 100 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                )}
              </div>
            </div>
            <p className="text-[10px] text-gray-500 italic text-center font-medium">
              {progress < 100 
                ? 'Step 1 of 2: Sending files to our secure server...' 
                : 'Step 2 of 2: Almost ready! Finalizing cloud storage sync...'}
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-500 font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

        <button 
          type="submit"
          className={`bg-gold text-black font-black py-4 rounded-xl mt-4 shadow-lg shadow-gold/20 active:scale-95 transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
          disabled={uploading || !file}
        >
          {uploading ? 'UPLIFTING...' : 'PUBLISH MOVIE'}
        </button>
      </form>
    </div>
  );
};

const ProfileScreen = ({ user, onMovieClick }) => {
  const [userMovies, setUserMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    // Only mount CoolzTech Shared UI if user is NOT logged in
    // This prevents the "client.getSessions is not a function" error
    if (!user && window.ctMount) {
      window.ctMount('#coolztech-auth-root', {
        baseUrl: 'https://authcoolztech.vercel.app'
      });
    }
  }, [user]);

  const fetchUserMovies = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/movies/publisher/${user.username}`);
      setUserMovies(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to fetch user movies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserMovies();
  }, [user]);

  const handleDelete = async (e, movieId) => {
    e.stopPropagation(); // Prevent opening the movie sheet
    
    if (!window.confirm("Are you sure you want to delete this movie? This action cannot be undone.")) {
      return;
    }

    setDeletingId(movieId);
    try {
      await axios.delete(`${API_BASE_URL}/movies/${movieId}`, {
        data: { publisher_name: user.username }
      });
      // Refresh list
      fetchUserMovies();
    } catch (err) {
      console.error("Failed to delete movie:", err);
      alert("Error deleting movie: " + (err.response?.data?.error || err.message));
    } finally {
      setDeletingId(null);
    }
  };

  const totalViews = userMovies.reduce((acc, movie) => acc + (movie.views || 0), 0);

  return (
    <div className="pb-20 min-h-screen bg-[#0a0a0a]">
      <div id="coolztech-auth-root">
        {/* CoolzTech Shared UI mounts here for Login/Signup */}
      </div>

      {user && (
        <div className="flex flex-col gap-8 animate-slide-up">
          {/* Hero Profile Header */}
          <div className="relative h-64 flex items-end px-6 pb-6">
            {/* Background Aesthetic */}
            <div className="absolute inset-0 bg-gradient-to-b from-gold/20 via-[#121212] to-[#0a0a0a]" />
            
            <div className="flex items-center gap-5 relative z-10 w-full">
              <div className="w-24 h-24 rounded-3xl bg-[#1e1e1e] border-4 border-[#0a0a0a] flex items-center justify-center text-gold shadow-2xl overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <User size={48} strokeWidth={1.5} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-3xl text-white tracking-tight uppercase italic">{user.username}</h2>
                  <CheckCircle2 size={20} className="text-blue-500 fill-blue-500/20" />
                </div>
                <p className="text-[10px] text-gold font-black uppercase tracking-[0.2em] mt-1 bg-gold/10 px-2 py-0.5 rounded-md border border-gold/20 inline-block">
                  Official VDJ Publisher
                </p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="px-6 grid grid-cols-2 gap-4">
            <div className="bg-[#121212] p-5 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center text-center shadow-lg">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Publications</p>
              <p className="text-3xl font-black text-white">{userMovies.length}</p>
            </div>
            <div className="bg-[#121212] p-5 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center text-center shadow-lg">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Total Reach</p>
              <p className="text-3xl font-black text-gold">{totalViews.toLocaleString()}</p>
            </div>
          </div>

          {/* My Collection Section */}
          <div className="px-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.1em] flex items-center gap-2">
                <Play size={18} className="text-gold" fill="currentColor" />
                Your Uplifts
              </h3>
              <Link to="/upload" className="text-[10px] font-black text-gold border-b border-gold/30 pb-0.5">NEW UPLOAD</Link>
            </div>
            
            {loading ? (
              <LoadingScreen />
            ) : userMovies.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                {userMovies.map(movie => (
                  <div 
                      key={movie.id} 
                      className="flex flex-col gap-3 group active:scale-95 transition-transform relative"
                      onClick={() => onMovieClick(movie)}
                    >
                      {/* Delete Button Overlay */}
                      <button 
                        onClick={(e) => handleDelete(e, movie.id)}
                        disabled={deletingId === movie.id}
                        className="absolute top-2 right-2 z-20 p-2 bg-red-600/90 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-700 active:scale-90"
                      >
                        {deletingId === movie.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>

                      <div className="aspect-[4/5] rounded-[1.5rem] overflow-hidden relative border border-white/5 shadow-xl bg-gray-900">
                      <img 
                        src={movie.thumbnail_url || movie.thumbnail || `https://picsum.photos/seed/${movie.id}/400/500`} 
                        className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500" 
                        alt={movie.title} 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
                        <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-1">
                          <Play size={10} className="text-gold" fill="currentColor" />
                          <span className="text-[10px] font-black text-white">{movie.views}</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-1">
                      <p className="text-xs font-black text-white truncate uppercase tracking-tight">{movie.title}</p>
                      <p className="text-[8px] text-gray-500 font-black mt-0.5 uppercase tracking-widest">{movie.genre}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#121212] rounded-[2.5rem] p-12 text-center border border-dashed border-white/10">
                <DownloadCloud size={48} className="mx-auto mb-4 text-gray-800" strokeWidth={1} />
                <p className="text-sm font-black text-gray-500 uppercase tracking-tighter">Your library is empty</p>
                <p className="text-[10px] text-gray-600 mt-1 mb-6">Start uploading to build your VDJ profile</p>
                <Link 
                  to="/upload" 
                  className="bg-gold text-black text-[10px] font-black px-6 py-3 rounded-full uppercase tracking-widest hover:scale-105 active:scale-95 transition-all inline-block shadow-lg shadow-gold/20"
                >
                  Publish Now
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions / Settings */}
          <div className="px-6 flex flex-col gap-3 pb-10">
            <button className="flex items-center justify-between p-5 bg-[#121212] rounded-[1.5rem] text-[11px] font-black text-gray-400 border border-white/5 hover:bg-[#1a1a1a] transition-all">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Settings size={18} />
                </div>
                ACCOUNT CONFIGURATION
              </div>
              <ChevronRight size={18} className="text-gray-700" />
            </button>
            
            <button 
              onClick={() => {
                if (window.CoolzAuthClient) {
                  const client = new window.CoolzAuthClient({ baseUrl: 'https://authcoolztech.vercel.app' });
                  client.logout();
                  window.location.reload();
                }
              }}
              className="flex items-center justify-center p-5 bg-red-500/5 rounded-[1.5rem] text-[11px] font-black text-red-500 border border-red-500/10 active:bg-red-500/10 transition-all uppercase tracking-widest"
            >
              Terminate Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- App Root ---

const App = () => {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [playingMovie, setPlayingMovie] = useState(null);
  const [user, setUser] = useState(null);
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (window.CoolzAuthClient) {
        try {
          const client = new window.CoolzAuthClient({ 
            baseUrl: 'https://authcoolztech.vercel.app' 
          });
          const profile = await client.getProfile();
          setUser(profile);
        } catch (err) {
          console.warn("User not logged in or session expired");
        }
      }
    };
    
    // Initial fetch
    fetchUser();
    
    // Listen for storage changes (login/logout in other tabs)
    window.addEventListener('storage', fetchUser);
    return () => window.removeEventListener('storage', fetchUser);
  }, []);

  const handleMovieClick = (movie) => {
    setSelectedMovie(movie);
    setIsSheetOpen(true);
  };

  const handlePlayMovie = (movie) => {
    // Logic for Reward Ad would go here
    console.log("Triggering Rewarded Ad for movie:", movie.title);
    setIsSheetOpen(false);
    setPlayingMovie(movie);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row max-w-md md:max-w-none mx-auto shadow-2xl relative bg-[#0f0f0f] overflow-hidden">
      {/* Dynamic Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Mobile Background */}
        <img 
          src="/images/VDJ BACKGROUND.png" 
          className="w-full h-full object-cover opacity-10 grayscale contrast-125 md:hidden" 
          alt="" 
        />
        {/* Desktop Background */}
        <img 
          src="/images/BACKGROUND_PC.png" 
          className="w-full h-full object-cover opacity-5 grayscale contrast-150 hidden md:block" 
          alt="" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0f0f]/50 via-transparent to-[#0f0f0f]" />
      </div>

      {/* Desktop Hamburger Menu */}
      <button 
        onClick={() => setIsSideNavOpen(!isSideNavOpen)}
        className="fixed top-6 left-6 z-[70] p-3 bg-black/50 backdrop-blur-md rounded-2xl text-white border border-white/10 hidden md:flex items-center justify-center hover:bg-gold hover:text-black transition-all active:scale-90"
      >
        {isSideNavOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <main className="flex-1 overflow-y-auto relative z-10">
        <Routes>
          <Route path="/" element={<HomeScreen onMovieClick={handleMovieClick} />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/upload" element={<UploadScreen user={user} />} />
          <Route path="/profile" element={<ProfileScreen user={user} onMovieClick={handleMovieClick} />} />
        </Routes>
      </main>
      
      <Navigation isDesktopOpen={isSideNavOpen} setIsDesktopOpen={setIsSideNavOpen} />

      {/* Overlays */}
      <MovieBottomSheet 
        movie={selectedMovie} 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)}
        onPlay={handlePlayMovie}
      />

      {playingMovie && (
        <VideoPlayer 
          movie={playingMovie} 
          onClose={() => setPlayingMovie(null)} 
          user={user}
        />
      )}
    </div>
  );
};

export default App;
