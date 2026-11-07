import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Home, Library, Upload, User, Search, Play, X, CheckCircle2, DownloadCloud, ChevronRight, AlertTriangle, Settings, Pause, Maximize, Minimize, Trash2, Image as ImageIcon, TrendingUp, Menu, Clock, Loader2, AlertCircle, Mail, Phone, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

// Compact duration for the per-movie watch-time badges (seconds -> 45s / 12m / 1.5h)
const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
};

// Record a play - fires the moment playback starts, in either the inline preview or the
// fullscreen player. Reach and views are tied to registered users, and the backend
// dedupes to one play per user per movie (preview + player count once).
const recordPlay = (movie, user) => {
  if (!movie?.id || user?.id === undefined || user?.id === null || user?.id === '') return;
  axios.post(`${API_BASE_URL}/movies/${movie.id}/view`, {
    userId: user.id,
  }).catch(() => {});
};

const LoadingScreen = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-black bg-opacity-100 z-50">
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
  const [isLocked, setIsLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const controlsTimeoutRef = useRef(null);
  const watchedTimeRef = useRef(0);
  const playRecordedRef = useRef(false);

  // Record the play the moment the fullscreen player starts
  useEffect(() => {
    if (playRecordedRef.current) return;
    playRecordedRef.current = true;
    recordPlay(movie, user);
  }, [movie.id]);

  // Count every second the movie is actually playing (for watch time)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const interval = setInterval(() => {
      if (video && !video.paused && !video.seeking && video.duration > 0) {
        const nextTime = watchedTimeRef.current + 1;
        watchedTimeRef.current = nextTime;

        // Persist periodically so watch time survives the player closing
        if (nextTime % 5 === 0) {
          postWatchTime(nextTime);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [movie.id]);

  // Flush the final watch time when the player closes
  useEffect(() => {
    return () => {
      if (watchedTimeRef.current > 0) postWatchTime(watchedTimeRef.current);
    };
  }, []);

  // Persist accumulated watch time (analytics only, independent of the view counter).
  // Watch time is tied to registered users.
  const postWatchTime = async (watchedSeconds) => {
    const seconds = Math.round(watchedSeconds || 0);
    if (seconds <= 0 || user?.id === undefined || user?.id === null || user?.id === '') return;
    try {
      await axios.post(`${API_BASE_URL}/movies/${movie.id}/watch`, {
        userId: user.id,
        watchedSeconds: seconds,
      });
    } catch (err) {
      // Analytics only - never block playback
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
        onLoadStart={() => setIsLoading(true)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[105]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={56} className="text-gold animate-spin" />
            <span className="text-[10px] font-black text-gold uppercase tracking-[0.3em] opacity-70">Loading...</span>
          </div>
        </div>
      )}

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

const MovieBottomSheet = ({ movie, isOpen, onClose, onFullscreen, user }) => {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const videoRef = useRef(null);
  const watchedRef = useRef(0);

  // Persist watch time accrued in the inline preview (analytics only, registered users)
  const flushPreviewWatchTime = () => {
    const seconds = Math.round(watchedRef.current);
    if (seconds <= 0 || !movie?.id || user?.id === undefined || user?.id === null || user?.id === '') return;
    axios.post(`${API_BASE_URL}/movies/${movie.id}/watch`, {
      userId: user.id,
      watchedSeconds: seconds,
    }).catch(() => {});
  };

  // Reset inline playback whenever the sheet closes or a new movie opens
  useEffect(() => {
    setStarted(false);
    setIsPlaying(false);
    setPreviewLoading(false);
  }, [movie?.id, isOpen]);

  // Count every second the inline preview is actually playing (for watch time)
  useEffect(() => {
    if (!started || !movie) return;
    const video = videoRef.current;
    if (!video) return;

    watchedRef.current = 0;
    const interval = setInterval(() => {
      if (video.paused || video.seeking || !video.duration) return;
      watchedRef.current += 1;
      if (watchedRef.current % 5 === 0) {
        flushPreviewWatchTime();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      flushPreviewWatchTime();
    };
  }, [started, movie, user]);

  if (!isOpen || !movie) return null;

  // Watching is restricted to signed-in accounts
  const requireAccount = () => {
    if (user) return true;
    onClose();
    navigate('/profile');
    return false;
  };

  const togglePlay = () => {
    if (!requireAccount()) return;

    if (!started) {
      // Record the play the moment the viewer presses play
      recordPlay(movie, user);
      // Mount the inline player; autoPlay takes over from the user gesture
      setStarted(true);
      setIsPlaying(true);
      setPreviewLoading(true);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const goToDj = (e) => {
    e.stopPropagation();
    onClose();
    navigate(`/dj/${encodeURIComponent(movie.dj_name)}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-[#121212] rounded-t-[32px] overflow-hidden flex flex-col h-[85vh] shadow-2xl animate-slide-up">
        {/* 1. Movie preview (16:9, defaults to the movie thumbnail) */}
        <div
          className="relative w-full aspect-video bg-black flex-shrink-0 cursor-pointer"
          onClick={togglePlay}
        >
          {!started ? (
            <>
              <img
                src={movie.telegram_file_id ? `${API_BASE_URL}/thumbnail/${movie.id}` : movie.thumbnail_url || movie.thumbnail || `https://picsum.photos/seed/${movie.id}/600/340`}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/50 rounded-full p-4">
                  <Play size={48} fill="white" />
                </div>
              </div>
            </>
          ) : (
            <video
              ref={videoRef}
              src={`${API_BASE_URL}/stream/${movie.telegram_message_id}`}
              className="w-full h-full object-contain bg-black"
              playsInline
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadStart={() => setPreviewLoading(true)}
              onWaiting={() => setPreviewLoading(true)}
              onPlaying={() => setPreviewLoading(false)}
              onError={() => setPreviewLoading(false)}
            />
          )}

          {/* Loading Overlay */}
          {started && previewLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={40} className="text-gold animate-spin" />
                <span className="text-[10px] font-black text-gold uppercase tracking-[0.3em] opacity-70">Loading...</span>
              </div>
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-8">
          {/* 2. Movie actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={togglePlay}
              className="w-full bg-gold hover:bg-[#e6b800] text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-gold/20"
            >
              {isPlaying ? <Pause size={24} fill="black" /> : <Play size={24} fill="black" />}
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>

            <div className="flex gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!requireAccount()) return;
                  videoRef.current?.pause();
                  onFullscreen(movie);
                }}
                className="flex-1 bg-[#252525] text-gray-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm active:scale-95 transition-all"
              >
                <Maximize size={18} />
                Fullscreen
              </button>

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

          {/* 3. DJ name, uploader and movie summary */}
          <div className="mt-6">
            <h2 className="text-2xl font-black text-white leading-tight mb-1">
              {movie.title}
            </h2>

            <div className="flex items-center gap-3 text-xs font-bold text-gray-400 mb-4">
              <span className="flex items-center gap-1">{movie.views || 0} WATCHED</span>
              <span className="w-1 h-1 bg-gray-600 rounded-full" />
              <span className="text-gold uppercase tracking-widest">{movie.genre}</span>
              <span className="w-1 h-1 bg-gray-600 rounded-full" />
              <span>{movie.size || '205 MB'}</span>
            </div>

            <div className="flex flex-col gap-1 mb-4">
              <span className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1">
                DJ Name: <button className="text-gray-300 hover:text-gold transition-colors" onClick={goToDj}>{movie.dj_name}</button>
              </span>
              <span className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1">
                Uploader: <span className="text-gold">{movie.publisher_name || 'Anonymous'}</span>
              </span>
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">
              {movie.summary || 'No description available for this movie.'}
            </p>
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

const MovieCard = ({ movie, onClick, onDJClick }) => {
  const navigate = useNavigate();
  
  return (
    <div 
      className="flex-shrink-0 w-32 md:w-44 aspect-[2/3] bg-gray-900 rounded-md overflow-hidden relative group movie-card cursor-pointer"
      onClick={() => onClick(movie)}
    >
      <img 
        src={movie.telegram_file_id ? `${API_BASE_URL}/thumbnail/${movie.id}` : movie.thumbnail_url || movie.thumbnail || `https://picsum.photos/seed/${movie.id}/300/450`} 
        alt={movie.title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
      
      {/* Pack Badge */}
      {movie.series_titles && movie.series_titles.length > 0 && (
        <div className="absolute top-2 right-2 bg-gold text-black text-[8px] font-bold px-2 py-1 rounded-full">
          [Pack]
        </div>
      )}

      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Play fill="white" size={32} />
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent">
        <p className="text-[10px] font-bold truncate">{movie.title}</p>
        {movie.dj_name && (
          <button 
            className="text-[8px] text-gold hover:text-gold/80 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/dj/${encodeURIComponent(movie.dj_name)}`);
            }}
          >
            {movie.dj_name}
          </button>
        )}
      </div>
    </div>
  );
};

const GenreRow = ({ title, movies, onMovieClick, onSeeMore }) => (
  <div className="flex flex-col gap-3 py-4">
    <div className="flex items-center justify-between px-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
        {title}
      </h2>
      {movies.length > 0 && (
        <button
          onClick={() => onSeeMore && onSeeMore(title)}
          className="text-[11px] font-black text-gold uppercase tracking-widest hover:text-gold/70 transition-colors"
        >
          See more
        </button>
      )}
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


const HomeScreen = ({ onMovieClick, onSeriesClick }) => {
  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [suggestions, setSuggestions] = useState(DEFAULT_QUERIES);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [trendingIndex, setTrendingIndex] = useState(0);
  const [isFuzzyMatch, setIsFuzzyMatch] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [showAllPacks, setShowAllPacks] = useState(false);
  const searchInputRef = useRef(null);
  
  const genres = ['All', 'Action', 'Kihindi', 'Comedy', 'Horror', 'Sci-Fi'];
  
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
        const [moviesRes, seriesRes, suggestionsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/movies`),
          axios.get(`${API_BASE_URL}/series`),
          axios.get(`${API_BASE_URL}/suggestions`)
        ]);
        
        setMovies(Array.isArray(moviesRes.data) ? moviesRes.data : []);
        setSeries(Array.isArray(seriesRes.data) ? seriesRes.data : []);
        
        if (Array.isArray(suggestionsRes.data) && suggestionsRes.data.length > 0) {
          setSuggestions(suggestionsRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setMovies([]); 
        setSeries([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const { filteredMovies, isFuzzy } = React.useMemo(() => {
    let result = movies;
    
    // Apply genre filter first
    if (selectedGenre !== 'All') {
      result = result.filter(movie => movie.genre === selectedGenre);
    }
    
    // Then apply search filter
    if (!searchQuery.trim()) {
      return { filteredMovies: result, isFuzzy: false };
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    // 1. Try Exact/Substring Matching
    const exactMatches = result.filter(movie => 
      (movie.title && movie.title.toLowerCase().includes(query)) || 
      (movie.dj_name && movie.dj_name.toLowerCase().includes(query)) ||
      (movie.genre && movie.genre.toLowerCase().includes(query))
    );

    if (exactMatches.length > 0) {
      return { filteredMovies: exactMatches, isFuzzy: false };
    }

    // 2. Fuzzy Matching (Triggered only if no exact matches)
    const fuzzyResults = result.map(movie => {
      const titleScore = getSimilarity(movie.title || '', query);
      const djScore = getSimilarity(movie.dj_name || '', query);
      const genreScore = getSimilarity(movie.genre || '', query);
      const maxScore = Math.max(titleScore, djScore, genreScore);
      
      return { ...movie, score: maxScore };
    })
    .filter(movie => movie.score >= 0.1) // 10% threshold
    .sort((a, b) => b.score - a.score);

    return { filteredMovies: fuzzyResults, isFuzzy: fuzzyResults.length > 0 };
  }, [movies, searchQuery, selectedGenre]);

  // Sync isFuzzyMatch state for UI feedback
  useEffect(() => {
    setIsFuzzyMatch(isFuzzy);
  }, [isFuzzy]);

  const getMoviesByGenre = (genre) => {
    if (!Array.isArray(filteredMovies)) return [];
    return filteredMovies
      .filter(m => m.genre === genre && (!m.series_titles || m.series_titles.length === 0))
      // Sort latest uploaded first (fall back to highest id for ties/missing dates)
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (dateB !== dateA) return dateB - dateA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });
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

        {/* Genre Subtabs - Desktop Only */}
        <div className="hidden lg:flex items-center justify-center gap-3 mt-4 px-4">
          {genres.map((genre, index) => (
            <React.Fragment key={genre}>
              <button
                onClick={() => {
                  setSelectedGenre(genre);
                  setSearchQuery('');
                }}
                className={`text-xs font-black uppercase tracking-widest transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-[#0f0f0f] rounded-md ${
                  selectedGenre === genre 
                    ? 'text-gold scale-105' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                aria-pressed={selectedGenre === genre}
              >
                {genre}
              </button>
              {index < genres.length - 1 && (
                <span className="text-gray-700 font-black text-xs">|</span>
              )}
            </React.Fragment>
          ))}
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
          {showAllPacks && !searchQuery && selectedGenre === 'All' ? (
            <div className="px-4 py-2 flex flex-col gap-6 animate-slide-up">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest">
                  Packs ({series.length})
                </h2>
                <button onClick={() => setShowAllPacks(false)} className="text-[10px] font-black text-gold uppercase tracking-widest">← Back</button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {series.map(s => (
                  <div
                    key={s.id}
                    className="aspect-[2/3] bg-gray-900 rounded-md overflow-hidden relative group cursor-pointer"
                    onClick={() => onSeriesClick(s)}
                  >
                    <img
                      src={s.thumbnail_telegram_file_id ? `${API_BASE_URL}/thumbnail/${s.thumbnail_telegram_file_id}` : `https://picsum.photos/seed/${s.id}/300/450`}
                      alt={s.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute top-2 right-2 bg-gold text-black text-[8px] font-bold px-2 py-1 rounded-full">
                      {s.movie_count} movies
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play fill="white" size={32} />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent">
                      <p className="text-[10px] font-bold truncate">{s.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : searchQuery || selectedGenre !== 'All' ? (
            <div className="px-4 py-2 flex flex-col gap-6 animate-slide-up">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest">
                    {searchQuery ? `Search Results (${filteredMovies.filter(m => !m.series_titles || m.series_titles.length === 0).length})` : `${selectedGenre} (${filteredMovies.filter(m => !m.series_titles || m.series_titles.length === 0).length})`}
                  </h2>
                  {searchQuery ? (
                    <button onClick={() => setSearchQuery('')} className="text-[10px] font-black text-gold uppercase tracking-widest">Clear</button>
                  ) : (
                    <button onClick={() => setSelectedGenre('All')} className="text-[10px] font-black text-gold uppercase tracking-widest">← All genres</button>
                  )}
                </div>
                {isFuzzyMatch && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-blue-500" />
                    <p className="text-[10px] font-bold text-blue-400">No exact matches found. Showing results for matching search instead.</p>
                  </div>
                )}
              </div>
              <div className={`grid gap-4 ${searchQuery ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-3'}`}>
                {filteredMovies.filter(m => !m.series_titles || m.series_titles.length === 0).map(movie => (
                  <MovieCard key={movie.id} movie={movie} onClick={onMovieClick} />
                ))}
              </div>
            </div>
          ) : (
            <>
              {series.length > 0 && (
                <div className="flex flex-col gap-3 py-4">
                  <div className="flex items-center justify-between px-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      Packs
                    </h2>
                    <button
                      onClick={() => setShowAllPacks(true)}
                      className="text-[11px] font-black text-gold uppercase tracking-widest hover:text-gold/70 transition-colors"
                    >
                      See more
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto px-4 no-scrollbar scroll-smooth">
                    {series.map(s => (
                      <div
                        key={s.id}
                        className="flex-shrink-0 w-32 md:w-44 aspect-[2/3] bg-gray-900 rounded-md overflow-hidden relative group cursor-pointer"
                        onClick={() => onSeriesClick(s)}
                      >
                        <img
                          src={s.thumbnail_telegram_file_id ? `${API_BASE_URL}/thumbnail/${s.thumbnail_telegram_file_id}` : `https://picsum.photos/seed/${s.id}/300/450`}
                          alt={s.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <div className="absolute top-2 right-2 bg-gold text-black text-[8px] font-bold px-2 py-1 rounded-full">
                          {s.movie_count} movies
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play fill="white" size={32} />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent">
                          <p className="text-[10px] font-bold truncate">{s.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <GenreRow title="Action" movies={getMoviesByGenre('Action')} onMovieClick={onMovieClick} onSeeMore={setSelectedGenre} />
              <GenreRow title="Kihindi" movies={getMoviesByGenre('Kihindi')} onMovieClick={onMovieClick} onSeeMore={setSelectedGenre} />
              <GenreRow title="Comedy" movies={getMoviesByGenre('Comedy')} onMovieClick={onMovieClick} onSeeMore={setSelectedGenre} />
              <GenreRow title="Horror" movies={getMoviesByGenre('Horror')} onMovieClick={onMovieClick} onSeeMore={setSelectedGenre} />
              <GenreRow title="Sci-Fi" movies={getMoviesByGenre('Sci-Fi')} onMovieClick={onMovieClick} onSeeMore={setSelectedGenre} />
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
    summary: '',
    genre: 'Action'
  });
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]); // For bulk upload
  const [uploadQueue, setUploadQueue] = useState([]); // Queue of files to upload
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0); // Which file is uploading
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [coverMode, setCoverMode] = useState('upload'); // 'upload' or 'frame'
  const [uploadType, setUploadType] = useState('single'); // 'single' or 'pack'
  const [selectedSeries, setSelectedSeries] = useState(null);
  const [userSeries, setUserSeries] = useState([]);
  const [newSeriesTitle, setNewSeriesTitle] = useState('');
  const [newSeriesDescription, setNewSeriesDescription] = useState('');
  const [createdSeriesId, setCreatedSeriesId] = useState(null); // Track created pack
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Pre-select a pack when arriving from a pack's "Upload another Movie" button
  useEffect(() => {
    const pack = location.state?.pack;
    if (pack) {
      setUploadType('pack');
      setSelectedSeries(pack);
    }
  }, [location.state]);

  // Fetch user's series
  useEffect(() => {
    const fetchSeries = async () => {
      if (!user) return;
      try {
        // In a real app, we'd get user ID from user object
        // For now, let's just initialize as empty
        setUserSeries([]);
      } catch (err) {
        console.error('Failed to fetch series:', err);
      }
    };
    fetchSeries();
  }, [user]);

  const genres = ['Action', 'Kihindi', 'Comedy', 'Horror', 'Sci-Fi'];

  // Overall progress reflects the real upload progress (finalizing shows 100%)
  const overallProgress = progress;

  // Total progress for bulk upload
  const totalProgress = uploadQueue.length > 0 
    ? Math.round(((currentUploadIndex + (progress / 200)) / uploadQueue.length) * 100)
    : 0;

  const handleFileChange = (e) => {
     if (uploadType === 'pack') {
       const selectedFiles = Array.from(e.target.files);
       const validFiles = selectedFiles.filter(f => {
         if (f.size > 2000 * 1024 * 1024) {
           setError(`${f.name} is too large (Max 2GB).`);
           return false;
         }
         return true;
       });
       
       if (validFiles.length > 0) {
         setFiles(validFiles);
         setUploadQueue(validFiles.map((f, idx) => ({
           id: Date.now() + idx,
           file: f,
           status: 'waiting', // waiting, uploading, completed, error
           progress: 0,
           title: f.name.replace(/\.[^/.]+$/, "")
         })));
         setError(null);
       }
     } else {
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

  // Upload a single file
  const uploadSingleFile = async (queueItem, seriesId = null) => {
    return new Promise(async (resolve, reject) => {
      try {
        const data = new FormData();
        data.append('dj_name', formData.dj_name);
        data.append('title', queueItem.title);
        data.append('summary', formData.summary);
        data.append('genre', formData.genre);
        data.append('movie_file', queueItem.file);
        data.append('publisher_name', user.username);

        setProgress(0);

        const response = await axios.post(`${API_BASE_URL}/upload`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 600000, 
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
            
            // Update queue item progress
            setUploadQueue(prev => prev.map(item => 
              item.id === queueItem.id 
                ? { ...item, progress: percentCompleted, status: 'uploading' }
                : item
            ));
          }
        });

        // If we have a series, add this movie to it
        if (seriesId && response.data.success) {
          const movieId = response.data.movie?.id;
          if (movieId) {
            await axios.post(`${API_BASE_URL}/series/${seriesId}/movies`, {
              movie_id: movieId
            });
          }
        }

        setUploadQueue(prev => prev.map(item => 
          item.id === queueItem.id 
            ? { ...item, status: 'completed', progress: 100 }
            : item
        ));

        resolve(response.data);
      } catch (error) {
        setUploadQueue(prev => prev.map(item => 
          item.id === queueItem.id 
            ? { ...item, status: 'error' }
            : item
        ));
        reject(error);
      }
    });
  };

  // Process the upload queue
  const processUploadQueue = async (seriesId) => {
    setUploading(true);
    
    for (let i = 0; i < uploadQueue.length; i++) {
      setCurrentUploadIndex(i);
      try {
        await uploadSingleFile(uploadQueue[i], seriesId);
      } catch (error) {
        console.error('Upload failed:', error);
        setError(`Failed to upload ${uploadQueue[i].title}`);
      }
      // Small delay between uploads
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setUploading(false);
    setUploadSuccess(true);
  };

  const handleUploadAnother = () => {
    setUploadSuccess(false);
    setFormData({ dj_name: '', summary: '', genre: 'Action' });
    setFile(null);
    setFiles([]);
    setUploadQueue([]);
    setCurrentUploadIndex(0);
    setCoverImage(null);
    setCoverPreview(null);
    setVideoUrl(null);
    setProgress(0);
    setError(null);
    setCreatedSeriesId(null);
    setNewSeriesTitle('');
    setNewSeriesDescription('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setError("You must be logged in to publish movies.");
      return;
    }

    setError(null);
    
    if (uploadType === 'pack' && uploadQueue.length > 0) {
      // Pack upload
      try {
        setUploading(true);
        
        let seriesIdToUse = selectedSeries?.id;
        
        // Create new series if needed
        if (!seriesIdToUse) {
          if (!newSeriesTitle.trim()) {
            setError("Please enter a pack title.");
            setUploading(false);
            return;
          }
          
          const seriesResponse = await axios.post(`${API_BASE_URL}/series`, {
            title: newSeriesTitle,
            description: newSeriesDescription,
            user_id: user.id, // Use user.id from CoolzAuth
            dj_name: formData.dj_name
          });
          seriesIdToUse = seriesResponse.data.id;
          setCreatedSeriesId(seriesIdToUse);
        }
        
        // Start processing queue
        await processUploadQueue(seriesIdToUse);
        
      } catch (error) {
        console.error('Pack upload failed:', error);
        setUploading(false);
        setError(error.response?.data?.details || "Failed to create pack.");
      }
    } else {
      // Single upload
      if (!file) return;
      
      try {
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

        const response = await axios.post(`${API_BASE_URL}/upload`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 600000, 
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percentCompleted);
          }
        });

        if (response.data.success) {
          setUploadSuccess(true);
        }
      } catch (error) {
        console.error('Upload failed:', error);
        setUploading(false);
        setProgress(0);
        setError(error.response?.data?.details || "Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    }
  };

  if (uploadSuccess) {
    return (
      <div className="p-4 pb-20 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-6">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Upload Successful</h1>
        <p className="text-sm text-gray-400 mb-8 max-w-xs">
          {uploadType === 'pack'
            ? 'Your pack has been published successfully.'
            : 'Your movie has been published successfully.'}
        </p>
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="bg-gold text-black font-black py-4 rounded-xl shadow-lg shadow-gold/20 hover:scale-[1.02] active:scale-95 transition-all"
          >
            BACK TO HOME
          </button>
          <button
            type="button"
            onClick={handleUploadAnother}
            className="bg-[#252525] text-gray-300 font-bold py-4 rounded-xl hover:bg-[#333] active:scale-95 transition-all"
          >
            UPLOAD ANOTHER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      <h1 className="text-2xl font-bold mb-6">Creator Content Portal</h1>
      
      {/* Upload Type Selector */}
      <div className="flex bg-black/50 rounded-2xl p-1 mb-6">
        <button
          type="button"
          onClick={() => setUploadType('single')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            uploadType === 'single' ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          Single
        </button>
        <button
          type="button"
          onClick={() => setUploadType('pack')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            uploadType === 'pack' ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'
          }`}
        >
          Pack
        </button>
      </div>

      {/* Pack Options */}
      {uploadType === 'pack' && (
        <div className="flex flex-col gap-4 mb-6 p-4 bg-[#1e1e1e] rounded-2xl border border-gray-800">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Select or Create Pack
          </label>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedSeries(null)}
              className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition-all ${
                !selectedSeries ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-gray-800 text-gray-400'
              }`}
            >
              + Create New Pack
            </button>
          </div>

          {selectedSeries && !userSeries.some(s => s.id === selectedSeries.id) && (
            <div className="p-3 rounded-xl bg-gold/20 border border-gold/50">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-white">{selectedSeries.title}</span>
                <button
                  type="button"
                  onClick={() => setSelectedSeries(null)}
                  className="text-[10px] text-gray-400"
                >
                  Change
                </button>
              </div>
              <p className="text-[10px] text-gold mt-1">New movies will be added to this pack</p>
            </div>
          )}

          {userSeries.length > 0 && (
            <div className="flex flex-col gap-2">
              {userSeries.map(series => (
                <button
                  key={series.id}
                  type="button"
                  onClick={() => setSelectedSeries(series)}
                  className={`p-3 rounded-xl text-left transition-all ${
                    selectedSeries?.id === series.id
                      ? 'bg-gold/20 border border-gold/50'
                      : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">{series.title}</span>
                    <span className="text-[10px] text-gray-400">[{series.movie_count} packed]</span>
                  </div>
                  {series.description && (
                    <p className="text-[10px] text-gray-500 mt-1">{series.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {!selectedSeries && (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Pack title"
                value={newSeriesTitle}
                onChange={(e) => setNewSeriesTitle(e.target.value)}
                className="bg-[#252525] border-none rounded-xl p-3 text-sm focus:ring-1 focus:ring-gold outline-none"
              />
              <textarea
                rows={2}
                placeholder="Pack description (optional)"
                value={newSeriesDescription}
                onChange={(e) => setNewSeriesDescription(e.target.value)}
                className="bg-[#252525] border-none rounded-xl p-3 text-sm focus:ring-1 focus:ring-gold resize-none outline-none"
              />
            </div>
          )}
        </div>
      )}

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
        
        {uploadType === 'single' && (
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
        )}

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {uploadType === 'single' ? 'Summary of the Movie' : 'Description for Pack'}
          </label>
          <textarea 
            rows={3}
            placeholder={uploadType === 'single' ? "A short, catchy description..." : "Describe what this pack contains..."}
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

        {/* File Selection - Single or Pack */}
        {uploadType === 'single' ? (
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
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Movie Files (Bulk Upload)
            </label>
            <div className="relative group">
              <input 
                type="file" 
                accept="video/*"
                multiple
                className="hidden"
                id="files-upload"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <label 
                htmlFor="files-upload" 
                className={`relative flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${files.length > 0 ? 'border-gold bg-gold/5 text-gold' : 'border-gray-700 hover:border-gray-500 text-gray-500'} ${error ? 'border-red-500 bg-red-500/5 text-red-500' : ''}`}
              >
                {files.length > 0 ? <CheckCircle2 size={20} /> : <Upload size={20} />}
                <span className="text-sm font-bold truncate max-w-[200px]">
                  {files.length > 0 
                    ? `${files.length} file${files.length > 1 ? 's' : ''} selected` 
                    : (error || 'Select multiple movie files')}
                </span>
              </label>
            </div>

            {/* Upload Queue */}
            {uploadQueue.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-gray-400">Upload Queue</span>
                  {uploading && (
                    <span className="text-xs font-bold text-gold">{totalProgress}% Complete</span>
                  )}
                </div>
                {uploadQueue.map((item, index) => (
                  <div 
                    key={item.id}
                    className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
                      item.status === 'uploading' 
                        ? 'bg-gold/10 border-gold/50' 
                        : item.status === 'completed'
                        ? 'bg-green-500/10 border-green-500/50'
                        : item.status === 'error'
                        ? 'bg-red-500/10 border-red-500/50'
                        : 'bg-[#1e1e1e] border-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {item.status === 'waiting' && <Clock size={16} className="text-gray-400" />}
                        {item.status === 'uploading' && <Loader2 size={16} className="text-gold animate-spin" />}
                        {item.status === 'completed' && <CheckCircle2 size={16} className="text-green-500" />}
                        {item.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                        <span className="text-xs font-bold truncate max-w-[200px]">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </div>
                    
                    {item.status === 'uploading' && (
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div 
                          className="bg-gold h-1.5 rounded-full transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {uploadType === 'single' && (
          /* Custom Video Cover Section */
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
        )}

        {/* Single Upload Progress */}
        {uploading && uploadType === 'single' && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between text-[10px] font-black text-gold uppercase tracking-tighter">
              <span>{progress < 100 ? `Step 1: Uplink (${progress}%)` : 'Finalizing'}</span>
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
                ? 'Sending files to our secure server...' 
                : 'Finalizing cloud storage sync...'}
            </p>
          </div>
        )}

        {error && <p className="text-xs text-red-500 font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

        <button 
          type="submit"
          className={`bg-gold text-black font-black py-4 rounded-xl mt-4 shadow-lg shadow-gold/20 active:scale-95 transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
          disabled={
            uploading || 
            (uploadType === 'single' && !file) || 
            (uploadType === 'pack' && uploadQueue.length === 0)
          }
        >
          {uploading 
            ? (uploadType === 'pack' 
                ? `UPLOADING ${currentUploadIndex + 1}/${uploadQueue.length}...` 
                : 'UPLIFTING...')
            : (uploadType === 'pack' 
                ? `PUBLISH PACK (${uploadQueue.length} ${uploadQueue.length === 1 ? 'movie' : 'movies'})`
                : 'PUBLISH MOVIE')
          }
        </button>
      </form>
    </div>
  );
};

const DJProfileScreen = ({ user, onMovieClick, onSeriesClick }) => {
  const { djName } = useParams();
  const [dj, setDj] = useState(null);
  const [movies, setMovies] = useState([]);
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('movies'); // 'movies', 'packs', 'popular', 'latest'
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDJProfile = async () => {
      if (!djName) return;
      
      try {
        const djResponse = await axios.get(`${API_BASE_URL}/djs/name/${encodeURIComponent(djName)}`);
        setDj(djResponse.data);
        
        if (activeTab === 'movies' || activeTab === 'popular' || activeTab === 'latest') {
          const sort = activeTab === 'popular' ? 'popular' : 'latest';
          const moviesResponse = await axios.get(`${API_BASE_URL}/djs/${djResponse.data.id}/movies?sort=${sort}`);
          setMovies(Array.isArray(moviesResponse.data) ? moviesResponse.data : []);
        } else if (activeTab === 'packs') {
          // Fetch packs/series for this user
          if (user?.id) {
            const packsResponse = await axios.get(`${API_BASE_URL}/series/user/${user.id}`);
            setPacks(Array.isArray(packsResponse.data) ? packsResponse.data : []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch DJ profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDJProfile();
  }, [djName, activeTab]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="pb-20 min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 py-6 pt-10 bg-gradient-to-b from-gold/10 to-[#0a0a0a]">
        <button onClick={() => navigate(-1)} className="mb-4 p-2 rounded-full bg-black/50 text-white w-fit">
          <ChevronRight className="rotate-180" size={20} />
        </button>
        
        {dj && (
          <>
            <h1 className="text-3xl font-black text-white mb-2">{dj.name}</h1>
            
            {/* Manager Info */}
            <div className="flex items-center gap-2 mb-4">
              {dj.manager ? (
                <span className="text-sm text-gray-400">
                  Managed by <span className="text-gold font-bold">{dj.manager.username}</span>
                </span>
              ) : (
                <button className="text-sm text-gold font-bold border border-gold/30 px-3 py-1 rounded-full hover:bg-gold/10 transition-all">
                  Be {dj.name}'s manager
                </button>
              )}
            </div>
            
            {/* Stats */}
            <div className="flex gap-6 mb-6">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{dj.followerCount}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Followers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{dj.movieCount}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Movies</p>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Tabs */}
      <div className="sticky top-0 bg-[#0a0a0a] z-10 border-b border-white/5">
        <div className="flex gap-1 px-4 py-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'movies', label: 'Movies' },
            { id: 'packs', label: 'Packs' },
            { id: 'popular', label: 'Popular' },
            { id: 'latest', label: 'Latest' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'text-gold border-b-2 border-gold' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4 py-6">
        {activeTab === 'packs' ? (
          packs.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {packs.map(pack => (
                <div 
                  key={pack.id} 
                  className="flex flex-col gap-2 cursor-pointer group"
                  onClick={() => onSeriesClick(pack)}
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-900 relative">
                    <img 
                      src={pack.thumbnail_telegram_file_id ? `${API_BASE_URL}/thumbnail/${pack.thumbnail_telegram_file_id}` : `https://picsum.photos/seed/${pack.id}/300/450`}
                      alt={pack.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-all"
                    />
                    <div className="absolute top-2 right-2 bg-gold text-black text-[10px] font-bold px-2 py-1 rounded-full">
                      [{pack.movie_count} packed]
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play fill="white" size={32} />
                    </div>
                  </div>
                  <p className="text-xs font-bold text-white truncate">{pack.title}</p>
                  {pack.description && (
                    <p className="text-[10px] text-gray-500 truncate">{pack.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No packs yet</p>
            </div>
          )
        ) : (
          movies.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {movies.filter(movie => (!movie.series_titles || movie.series_titles.length === 0)).map(movie => (
                <div 
                  key={movie.id} 
                  className="flex flex-col gap-2 cursor-pointer"
                  onClick={() => onMovieClick(movie)}
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-900 relative">
                    <img 
                      src={movie.telegram_file_id ? `${API_BASE_URL}/thumbnail/${movie.id}` : movie.thumbnail_url || movie.thumbnail || `https://picsum.photos/seed/${movie.id}/300/450`}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                    {movie.series_titles && movie.series_titles.length > 0 && (
                      <div className="absolute top-2 right-2 bg-gold text-black text-[8px] font-bold px-2 py-1 rounded-full">
                        [Pack]
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-bold text-white truncate">{movie.title}</p>
                  <p className="text-[10px] text-gray-500">{movie.views} views</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No movies yet</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

const ProfileScreen = ({ user, onMovieClick, onSeriesClick }) => {
  const [userMovies, setUserMovies] = useState([]);
  const [userSeries, setUserSeries] = useState([]);
  const [watchTimeSeconds, setWatchTimeSeconds] = useState(0);
  const [reach, setReach] = useState(0);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'packs'

  useEffect(() => {
    const authRoot = document.getElementById('coolztech-auth-root');
    
    if (!user && window.ctMount) {
      // Mount auth UI if user is not logged in
      window.ctMount('#coolztech-auth-root', {
        baseUrl: 'https://authcoolztech.vercel.app'
      });
    } else if (authRoot) {
      // Clear auth UI if user IS logged in
      authRoot.innerHTML = '';
    }
  }, [user]);

  const fetchUserMovies = async (showSpinner = true) => {
    if (!user) return;
    if (showSpinner) setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/movies/publisher/${user.username}`);
      setUserMovies(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to fetch user movies:", err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const fetchUserSeries = async () => {
    if (!user || !user.id) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/series/user/${user.id}`);
      setUserSeries(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Failed to fetch user series:", err);
    }
  };

  const fetchWatchTime = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/stats/watch-time/${encodeURIComponent(user.username)}`);
      setWatchTimeSeconds(response.data.totalSeconds || 0);
    } catch (err) {
      console.error("Failed to fetch watch time:", err);
    }
  };

  const fetchReach = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/stats/reach/${encodeURIComponent(user.username)}`);
      setReach(response.data.reach || 0);
    } catch (err) {
      console.error("Failed to fetch reach:", err);
    }
  };

  // Manual refresh for the profile stat cards (and the per-movie numbers)
  const refreshStats = async () => {
    if (statsRefreshing) return;
    setStatsRefreshing(true);
    await Promise.all([fetchReach(), fetchWatchTime(), fetchUserMovies(false)]);
    setStatsRefreshing(false);
  };

  useEffect(() => {
    fetchUserMovies();
    fetchUserSeries();
    fetchWatchTime();
    fetchReach();
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

  const watchTimeHours = (watchTimeSeconds / 3600).toFixed(2);

  return (
    <div className="pb-20 min-h-screen bg-[#0a0a0a]">
      {!user && (
        <div id="coolztech-auth-root">
          {/* CoolzTech Shared UI mounts here for Login/Signup */}
        </div>
      )}

      {user && (
        <div className="max-w-5xl mx-auto animate-slide-up">
          {/* Profile Header */}
          <div className="relative px-6 pt-12 pb-6">
            <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-gold/10 to-transparent pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-24 h-24 rounded-2xl bg-[#151515] ring-1 ring-white/10 shadow-xl overflow-hidden flex items-center justify-center text-gold shrink-0">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <User size={44} strokeWidth={1.5} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">{user.username}</h1>
                  <CheckCircle2 size={20} className="text-blue-500 fill-blue-500/20 shrink-0" />
                </div>
                <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-[0.15em] text-gold bg-gold/10 border border-gold/20 px-3 py-1 rounded-full">
                  Official VDJ Publisher
                </span>

                {(user.email || user.phone_number || user.phone) && (
                  <div className="mt-4 flex flex-col gap-1.5 text-xs text-gray-400">
                    {user.email && (
                      <span className="flex items-center gap-2">
                        <Mail size={14} className="text-gray-500 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </span>
                    )}
                    {(user.phone_number || user.phone) && (
                      <span className="flex items-center gap-2">
                        <Phone size={14} className="text-gray-500 shrink-0" />
                        <span>{user.phone_number || user.phone}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <Link
                to="/upload"
                className="hidden sm:inline-flex items-center gap-2 bg-gold text-black text-xs font-black uppercase tracking-wider px-5 py-3 rounded-xl shadow-lg shadow-gold/20 hover:scale-[1.03] active:scale-95 transition-all shrink-0"
              >
                <Upload size={16} /> New Upload
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="px-6 mt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
              <div className="p-4 bg-[#121212] flex flex-col items-center justify-center text-center gap-1">
                <Play size={16} className="text-gray-500" fill="currentColor" />
                <p className="text-xl sm:text-2xl font-black text-white">{userMovies.length}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Publications</p>
              </div>
              <div className="relative p-4 bg-[#121212] flex flex-col items-center justify-center text-center gap-1">
                <button
                  onClick={refreshStats}
                  disabled={statsRefreshing}
                  title="Refresh stats"
                  aria-label="Refresh stats"
                  className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gold transition-colors disabled:opacity-60"
                >
                  <RefreshCw size={13} className={statsRefreshing ? 'animate-spin' : ''} />
                </button>
                <TrendingUp size={16} className="text-gold" />
                <p className="text-xl sm:text-2xl font-black text-gold">{reach.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Reach</p>
              </div>
              <div className="p-4 bg-[#121212] flex flex-col items-center justify-center text-center gap-1">
                <Library size={16} className="text-gray-500" />
                <p className="text-xl sm:text-2xl font-black text-white">{userSeries.length}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Packs</p>
              </div>
              <div className="relative p-4 bg-[#121212] flex flex-col items-center justify-center text-center gap-1">
                <button
                  onClick={refreshStats}
                  disabled={statsRefreshing}
                  title="Refresh stats"
                  aria-label="Refresh stats"
                  className="absolute top-2 right-2 p-1 text-gray-500 hover:text-gold transition-colors disabled:opacity-60"
                >
                  <RefreshCw size={13} className={statsRefreshing ? 'animate-spin' : ''} />
                </button>
                <Clock size={16} className="text-gold" />
                <p className="text-xl sm:text-2xl font-black text-white">{watchTimeHours} hrs</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Watch Time</p>
                <p className="text-[10px] text-gray-600">Gained monthly</p>
              </div>
            </div>
          </div>

          {/* Library */}
          <div className="px-6 mt-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.12em]">Your Library</h3>
              <Link to="/upload" className="sm:hidden text-[11px] font-bold text-gold flex items-center gap-1">
                <Upload size={14} /> Upload
              </Link>
            </div>

            {/* Segmented tabs */}
            <div className="inline-flex bg-[#121212] border border-white/5 rounded-xl p-1 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`py-2 px-6 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'single' ? 'bg-gold text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('packs')}
                className={`py-2 px-6 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === 'packs' ? 'bg-gold text-black shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Packs
              </button>
            </div>
            
            {loading ? (
              <LoadingScreen />
            ) : activeTab === 'single' && userMovies.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {userMovies.filter(movie => (!movie.series_titles || movie.series_titles.length === 0)).map(movie => (
                  <div 
                      key={movie.id} 
                      className="flex flex-col gap-2 group active:scale-95 transition-transform relative"
                      onClick={() => onMovieClick(movie)}
                    >
                      {/* Delete Button Overlay */}
                      <button 
                        onClick={(e) => handleDelete(e, movie.id)}
                        disabled={deletingId === movie.id}
                        className="absolute top-2 right-2 z-20 p-1.5 bg-red-600/90 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-700 active:scale-90"
                      >
                        {deletingId === movie.id ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>

                      <div className="aspect-[2/3] rounded-lg overflow-hidden relative border border-white/5 shadow-lg bg-gray-900">
                        <img 
                          src={movie.telegram_file_id ? `${API_BASE_URL}/thumbnail/${movie.id}` : movie.thumbnail_url || movie.thumbnail || `https://picsum.photos/seed/${movie.id}/300/450`} 
                          className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110" 
                          alt={movie.title} 
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center gap-1">
                          <div
                            title="Total Reach (users who pressed play)"
                            className="px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 flex items-center gap-1"
                          >
                            <Play size={8} className="text-gold" fill="currentColor" />
                            <span className="text-[9px] font-black text-white">{movie.views || 0}</span>
                          </div>
                          <div
                            title="Watch Time this month"
                            className="px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md border border-white/10 flex items-center gap-1"
                          >
                            <Clock size={8} className="text-gold" />
                            <span className="text-[9px] font-black text-white">{formatDuration(movie.watch_seconds)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="px-0.5">
                        <p className="text-[10px] font-black text-white truncate uppercase tracking-tight">{movie.title}</p>
                        <p className="text-[7px] text-gray-500 font-black mt-0.5 uppercase tracking-widest">{movie.genre}</p>
                      </div>
                  </div>
                ))}
              </div>
            ) : activeTab === 'packs' && userSeries.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {userSeries.map(series => (
                  <div 
                    key={series.id} 
                    className="flex flex-col gap-2 cursor-pointer group"
                    onClick={() => onSeriesClick(series)}
                  >
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-900 relative">
                      <img 
                        src={series.thumbnail_telegram_file_id ? `${API_BASE_URL}/thumbnail/${series.thumbnail_telegram_file_id}` : `https://picsum.photos/seed/${series.id}/300/450`}
                        alt={series.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute top-2 right-2 bg-gold text-black text-[10px] font-bold px-2 py-1 rounded-full">
                        [{series.movie_count} packed]
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play fill="white" size={32} />
                      </div>
                    </div>
                    <p className="text-xs font-bold text-white truncate">{series.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#121212] rounded-[2.5rem] p-12 text-center border border-dashed border-white/10">
                <DownloadCloud size={48} className="mx-auto mb-4 text-gray-800" strokeWidth={1} />
                <p className="text-sm font-black text-gray-500 uppercase tracking-tighter">
                  {activeTab === 'single' ? 'Your library is empty' : 'No packs yet'}
                </p>
                <p className="text-[10px] text-gray-600 mt-1 mb-6">
                  {activeTab === 'single' ? 'Start uploading to build your VDJ profile' : 'Create a pack by uploading multiple movies'}
                </p>
                <Link 
                  to="/upload" 
                  className="bg-gold text-black text-[10px] font-black px-6 py-3 rounded-full uppercase tracking-widest hover:scale-105 active:scale-95 transition-all inline-block shadow-lg shadow-gold/20"
                >
                  {activeTab === 'single' ? 'Publish Now' : 'Create Pack'}
                </Link>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="px-6 mt-10 pb-10">
            <h3 className="text-sm font-black text-white uppercase tracking-[0.12em] mb-4">Account</h3>
            <div className="flex flex-col gap-2">
              <button className="group flex items-center justify-between p-4 bg-[#121212] rounded-2xl text-xs font-bold text-gray-300 border border-white/5 hover:border-white/10 hover:bg-[#171717] transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Settings size={18} />
                  </div>
                  Account Configuration
                </div>
                <ChevronRight size={18} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
              </button>

              <button
                onClick={() => {
                  if (window.CoolzAuthClient) {
                    const client = new window.CoolzAuthClient({ baseUrl: 'https://authcoolztech.vercel.app' });
                    client.logout();
                    window.location.reload();
                  }
                }}
                className="flex items-center justify-center gap-2 p-4 rounded-2xl text-xs font-bold text-red-400 border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 active:scale-[0.99] transition-all"
              >
                <X size={16} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SeriesDetailScreen = ({ series, onMovieClick, user, onBack }) => {
  const [seriesData, setSeriesData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editingMovieId, setEditingMovieId] = useState(null);
  const [movieTitle, setMovieTitle] = useState('');
  const [movieGenre, setMovieGenre] = useState('Action');
  const [movieSummary, setMovieSummary] = useState('');
  const navigate = useNavigate();

  const genres = ['Action', 'Kihindi', 'Comedy', 'Horror', 'Sci-Fi'];
  const isOwner = !!(user && seriesData && seriesData.user_id === user.id);

  useEffect(() => {
    const fetchSeries = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/series/${series.id}`);
        setSeriesData(response.data);
        setEditTitle(response.data.title);
        setEditDescription(response.data.description || '');
      } catch (error) {
        console.error('Failed to fetch series:', error);
      }
    };
    fetchSeries();
  }, [series.id]);

  const handleSave = async () => {
    try {
      await axios.put(`${API_BASE_URL}/series/${series.id}`, {
        title: editTitle,
        description: editDescription,
        user_id: user?.id
      });
      // Mirror the backend: movies still using their default name follow the new pack title
      setSeriesData(prev => ({
        ...prev,
        title: editTitle,
        description: editDescription,
        movies: prev.movies.map(m =>
          m.title === `${prev.title} ${m.order_in_series}` ? { ...m, title: `${editTitle} ${m.order_in_series}` } : m
        )
      }));
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update series:', error);
    }
  };

  const startEditMovie = (movie) => {
    setEditingMovieId(movie.id);
    setMovieTitle(movie.title || '');
    setMovieGenre(movie.genre || 'Action');
    setMovieSummary(movie.summary || '');
  };

  const saveMovie = async () => {
    try {
      const response = await axios.put(`${API_BASE_URL}/movies/${editingMovieId}`, {
        title: movieTitle,
        genre: movieGenre,
        summary: movieSummary,
        user_id: user?.id
      });
      setSeriesData(prev => ({
        ...prev,
        movies: prev.movies.map(m => (m.id === editingMovieId ? { ...m, ...response.data } : m))
      }));
      setEditingMovieId(null);
    } catch (error) {
      console.error('Failed to update movie:', error);
    }
  };

  if (!seriesData) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <div className="px-4 pt-10">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6">
          <ChevronRight className="rotate-180" size={20} />
          Back
        </button>
        <div className="mb-6">
          {isEditing ? (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-[#1e1e1e] border border-[#333] rounded-xl p-3 text-white font-bold text-2xl"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-[#1e1e1e] border border-[#333] rounded-xl p-3 text-gray-300 resize-none"
                rows={3}
              />
              <div className="flex gap-3">
                <button onClick={handleSave} className="bg-gold text-black font-bold py-2 px-6 rounded-xl">
                  Save
                </button>
                <button onClick={() => setIsEditing(false)} className="bg-[#333] text-white font-bold py-2 px-6 rounded-xl">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-white">{seriesData.title}</h1>
                {isOwner && (
                  <button onClick={() => setIsEditing(true)} className="text-gold font-bold text-sm">
                    Edit
                  </button>
                )}
              </div>
              {seriesData.description && (
                <p className="text-gray-400 mt-2">{seriesData.description}</p>
              )}
              <p className="text-gray-500 text-sm mt-1">{seriesData.movies?.length || 0} movies</p>
            </div>
          )}

          {isOwner && !isEditing && (
            <button
              onClick={() => navigate('/upload', {
                state: { pack: { id: seriesData.id, title: seriesData.title, description: seriesData.description } }
              })}
              className="mt-4 w-full bg-gold text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Upload size={18} />
              Upload another Movie on this pack
            </button>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {seriesData.movies?.map((movie, index) => (
            <div
              key={movie.id}
              className="bg-[#121212] p-4 rounded-2xl border border-white/5"
            >
              {editingMovieId === movie.id ? (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={movieTitle}
                    onChange={(e) => setMovieTitle(e.target.value)}
                    placeholder="Movie title"
                    className="bg-[#1e1e1e] border border-[#333] rounded-xl p-3 text-white font-bold"
                  />
                  <select
                    value={movieGenre}
                    onChange={(e) => setMovieGenre(e.target.value)}
                    className="bg-[#1e1e1e] border border-[#333] rounded-xl p-3 text-white"
                  >
                    {genres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <textarea
                    value={movieSummary}
                    onChange={(e) => setMovieSummary(e.target.value)}
                    placeholder="Summary"
                    rows={3}
                    className="bg-[#1e1e1e] border border-[#333] rounded-xl p-3 text-gray-300 resize-none"
                  />
                  <div className="flex gap-3">
                    <button onClick={saveMovie} className="bg-gold text-black font-bold py-2 px-6 rounded-xl">
                      Save
                    </button>
                    <button onClick={() => setEditingMovieId(null)} className="bg-[#333] text-white font-bold py-2 px-6 rounded-xl">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex gap-4 active:opacity-80 cursor-pointer"
                  onClick={() => onMovieClick(movie)}
                >
                  <div className="text-4xl font-bold text-gold opacity-50">{index + 1}</div>
                  <div className="w-24 h-14 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={movie.telegram_file_id ? `${API_BASE_URL}/thumbnail/${movie.id}` : movie.thumbnail_url || `https://picsum.photos/seed/${movie.id}/120/68`}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold truncate">{movie.title}</h3>
                    <p className="text-gray-500 text-sm">{movie.dj_name}</p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditMovie(movie);
                      }}
                      className="self-center text-gold font-bold text-xs"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- App Root ---

const App = () => {
  const navigate = useNavigate();
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [playingMovie, setPlayingMovie] = useState(null);
  const [user, setUser] = useState(null);
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Add isLoading state
  const [selectedSeries, setSelectedSeries] = useState(null);

  useEffect(() => {
    // Simulate initial app loading
    const appLoadTimer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Show loading screen for 2 seconds

    const fetchUser = async () => {
      if (window.CoolzAuthClient) {
        try {
          const client = new window.CoolzAuthClient({ 
            baseUrl: 'https://authcoolztech.vercel.app' 
          });
          const profile = await client.getProfile();
          
          // Try to sync user with our backend, but don't fail the whole login if sync fails
          try {
            await axios.post(`${API_BASE_URL}/users/sync`, {
              id: profile.id,
              username: profile.username,
              email: profile.email,
              avatar_url: profile.avatar_url,
              phone_number: profile.phone_number
            });
            console.log("User synced successfully with backend");
          } catch (syncErr) {
            console.warn("User sync failed, but user is still logged in", syncErr);
          }
          
          setUser(profile);
        } catch (err) {
          console.warn("User not logged in or session expired", err);
        }
      }
    };
    
    // Initial fetch
    fetchUser();
    
    // Listen for storage changes (login/logout in other tabs)
    window.addEventListener('storage', fetchUser);
    return () => {
      clearTimeout(appLoadTimer); // Clear app load timer on unmount
      window.removeEventListener('storage', fetchUser);
    };
  }, []);

  const handleMovieClick = (movie) => {
  setSelectedMovie(movie);
  setIsSheetOpen(true);
};

const handleSeriesClick = (series) => {
  setSelectedSeries(series);
};

const handleFullscreen = (movie) => {
  // Watching requires an account
  if (!user) {
    setIsSheetOpen(false);
    navigate('/profile');
    return;
  }
  // Open the fullscreen player on top of the description sheet
  setPlayingMovie(movie);
};

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row max-w-md md:max-w-none mx-auto shadow-2xl relative bg-[#0f0f0f] overflow-hidden">
      {/* Dynamic Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Mobile Background */}
        <img 
          src="/images/VDJ BACKGROUND.png" 
          className="w-full h-full object-cover opacity-30 md:hidden" 
          alt="" 
        />
        {/* Desktop Background */}
        <img 
          src="/images/BACKGROUND_PC.png" 
          className="w-full h-full object-cover opacity-30 hidden md:block" 
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
          <Route path="/" element={
            selectedSeries ? (
              <SeriesDetailScreen 
                series={selectedSeries} 
                onMovieClick={handleMovieClick} 
                user={user} 
                onBack={() => setSelectedSeries(null)}
              />
            ) : (
              <HomeScreen onMovieClick={handleMovieClick} onSeriesClick={handleSeriesClick} />
            )
          } />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/upload" element={<UploadScreen user={user} />} />
          <Route path="/profile" element={
            selectedSeries ? (
              <SeriesDetailScreen 
                series={selectedSeries} 
                onMovieClick={handleMovieClick} 
                user={user} 
                onBack={() => setSelectedSeries(null)}
              />
            ) : (
              <ProfileScreen user={user} onMovieClick={handleMovieClick} onSeriesClick={handleSeriesClick} />
            )
          } />
          <Route 
            path="/dj/:djName" 
            element={
              selectedSeries ? (
                <SeriesDetailScreen 
                  series={selectedSeries} 
                  onMovieClick={handleMovieClick} 
                  user={user} 
                  onBack={() => setSelectedSeries(null)}
                />
              ) : (
                <DJProfileScreen user={user} onMovieClick={handleMovieClick} onSeriesClick={handleSeriesClick} />
              )
            } 
          />
        </Routes>
      </main>
      
      <Navigation isDesktopOpen={isSideNavOpen} setIsDesktopOpen={setIsSideNavOpen} />

      {/* Overlays */}
      <MovieBottomSheet 
        movie={selectedMovie} 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)}
        onFullscreen={handleFullscreen}
        user={user}
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
