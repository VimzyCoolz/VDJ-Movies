import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Library, Upload, User, Search, Play, X, CheckCircle2, DownloadCloud, ChevronRight, AlertTriangle, Settings, Pause, Maximize, Minimize } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

// --- Components ---

const VideoPlayer = ({ movie, onClose }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const [zoomMode, setZoomMode] = useState('fit'); // 'fit', 'stretch', 'crop'
  const controlsTimeoutRef = useRef(null);

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
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetControlsTimeout();
  };

  const toggleZoomMode = () => {
    const modes = ['fit', 'stretch', 'crop'];
    const nextIndex = (modes.indexOf(zoomMode) + 1) % modes.length;
    setZoomMode(modes[nextIndex]);
    resetControlsTimeout();
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
        onClick={togglePlay}
        onMouseMove={resetControlsTimeout}
      />

      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white z-[110] hover:bg-black/80 transition-colors"
      >
        <X size={24} />
      </button>

      {/* Play/Pause Overlay Icon */}
      {showControls && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 p-6 rounded-full animate-fade-out">
            {isPlaying ? <Pause size={48} fill="white" /> : <Play size={48} fill="white" />}
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-4">
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

            <button className="flex items-center gap-1 text-white text-xs font-bold opacity-50">
              <Settings size={16} />
              <span>Quality</span>
            </button>
          </div>
          
          <div className="flex justify-between items-center">
            <h3 className="text-white font-bold text-sm truncate max-w-[70%]">{movie.title}</h3>
            <div className="flex gap-4">
              {/* Future controls like volume/speed can go here */}
            </div>
          </div>
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
            src={movie.thumbnail || `https://picsum.photos/seed/${movie.id}/600/340`} 
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
            <span>205 MB</span>
          </div>

          <p className="text-sm text-gray-300 leading-relaxed mb-8">
            {movie.summary || "No description available for this movie."}
            <br />
            <span className="text-[10px] text-gray-500 uppercase font-bold mt-2 block">
              UPLOADED BY: {movie.dj_name}
            </span>
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

const BottomNav = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-black border-t border-gray-800 flex items-center justify-around px-4 z-50">
      <Link to="/" className={`flex flex-col items-center gap-1 ${isActive('/') ? 'text-gold' : 'text-gray-500'}`}>
        <Home size={24} />
        <span className="text-[10px] font-medium">Home</span>
      </Link>
      <Link to="/library" className={`flex flex-col items-center gap-1 ${isActive('/library') ? 'text-gold' : 'text-gray-500'}`}>
        <Library size={24} />
        <span className="text-[10px] font-medium">Library</span>
      </Link>
      <Link to="/upload" className={`flex flex-col items-center gap-1 ${isActive('/upload') ? 'text-gold' : 'text-gray-500'}`}>
        <Upload size={24} />
        <span className="text-[10px] font-medium">Upload</span>
      </Link>
      <Link to="/profile" className={`flex flex-col items-center gap-1 ${isActive('/profile') ? 'text-gold' : 'text-gray-500'}`}>
        <User size={24} />
        <span className="text-[10px] font-medium">Profile</span>
      </Link>
    </nav>
  );
};

const MovieCard = ({ movie, onClick }) => (
  <div 
    className="flex-shrink-0 w-32 md:w-44 aspect-[2/3] bg-gray-900 rounded-md overflow-hidden relative group movie-card cursor-pointer"
    onClick={() => onClick(movie)}
  >
    <img 
      src={movie.thumbnail || `https://picsum.photos/seed/${movie.id}/300/450`} 
      alt={movie.title}
      className="w-full h-full object-cover"
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

// --- Pages ---

const HomeScreen = ({ onMovieClick }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/movies`);
        // Ensure we always have an array, even if API returns something else
        setMovies(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Failed to fetch movies:', error);
        setMovies([]); // Reset to empty array on error
      } finally {
        setLoading(false);
      }
    };
    fetchMovies();
  }, []);

  const getMoviesByGenre = (genre) => {
    if (!Array.isArray(movies)) return [];
    return movies.filter(m => m.genre === genre);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Search Bar at the very top */}
      <div className="sticky top-0 bg-[#0f0f0f] z-40 p-4 pt-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Search DJ Afro, DJ Smith, or movie titles..." 
            className="w-full bg-[#1e1e1e] border-none rounded-full py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-gold outline-none placeholder:text-gray-500"
          />
        </div>
      </div>

      {movies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-10 text-center opacity-50">
          <Play size={48} className="mb-4 text-gray-600" />
          <p className="text-sm font-medium">No movies published yet.<br/>Upload content to see it here.</p>
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

const UploadScreen = () => {
  const [formData, setFormData] = useState({
    dj_name: '',
    title: '',
    summary: '',
    genre: 'Action'
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const genres = ['Action', 'Kihindi', 'Comedy', 'Horror', 'Sci-Fi'];

  const handleFileChange = (e) => {
     const selectedFile = e.target.files[0];
     if (selectedFile) {
       // Files are now hosted on Render, which supports larger uploads
       if (selectedFile.size > 2000 * 1024 * 1024) {
         setError("File is too large (Max 2GB). Please compress the movie or use a smaller file.");
         setFile(null);
       } else {
         setError(null);
         setFile(selectedFile);
       }
     }
   };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setError(null);
    const data = new FormData();
    data.append('dj_name', formData.dj_name);
    data.append('title', formData.title);
    data.append('summary', formData.summary);
    data.append('genre', formData.genre);
    data.append('movie_file', file);

    setUploading(true);
    setProgress(0);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000, // 10 minute timeout for large movie uploads (increased from 5m)
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        }
      });

      if (response.data.success) {
        setFormData({ dj_name: '', title: '', summary: '', genre: 'Action' });
        setFile(null);
        setProgress(0);
        // Navigate to home or show a subtle success state instead of alert
        window.location.href = '/'; 
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
      setProgress(0);
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
          <div className="relative">
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
              className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${file ? 'border-gold bg-gold/5 text-gold' : 'border-gray-700 hover:border-gray-500 text-gray-500'} ${error ? 'border-red-500 bg-red-500/5 text-red-500' : ''}`}
            >
              {file ? <CheckCircle2 size={20} /> : <Upload size={20} />}
              <span className="text-sm font-bold truncate max-w-[200px]">
                {file ? file.name : (error ? 'File too large' : 'Select movie file from device')}
              </span>
            </label>
          </div>
          {error && <p className="text-[10px] text-red-500 font-bold mt-1">{error}</p>}
        </div>

        {uploading && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between text-[10px] font-black text-gold uppercase tracking-tighter">
              <span>{progress < 100 ? 'Step 1: Uploading to Server...' : 'Step 2: Syncing with Cloud...'}</span>
              <span>{progress < 100 ? `${progress}%` : 'ALMOST READY'}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative">
              <div 
                className={`h-full bg-gold transition-all duration-300 ${progress === 100 ? 'w-full' : ''}`} 
                style={{ width: progress < 100 ? `${progress}%` : '100%' }}
              >
                {progress === 100 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                )}
              </div>
            </div>
            <p className="text-[10px] text-gray-500 italic text-center font-medium">
              {progress < 100 
                ? 'Sending file to our secure server...' 
                : 'Uplifting to cloud storage. This is the final step, please stay on this page.'}
            </p>
          </div>
        )}

        <button 
          type="submit"
          className={`bg-gold text-black font-black py-4 rounded-xl mt-4 shadow-lg shadow-gold/20 active:scale-95 transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
          disabled={uploading}
        >
          {uploading ? 'UPLIFTING...' : 'PUBLISH MOVIE'}
        </button>
      </form>
    </div>
  );
};

const ProfileScreen = () => {
  useEffect(() => {
    // Mount CoolzTech Shared UI
    if (window.ctMount) {
      window.ctMount('#coolztech-auth-root', {
        baseUrl: 'https://authcoolztech.vercel.app'
      });
    }
  }, []);

  return (
    <div className="pb-20 min-h-screen">
      <div id="coolztech-auth-root" className="p-4">
        {/* The CoolzTech Shared UI will mount here */}
        <div className="bg-[#1e1e1e] rounded-2xl p-6 border border-gray-800 mb-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold flex items-center justify-center text-gold">
              <User size={32} />
            </div>
            <div>
              <h2 className="font-black text-xl">Account Settings</h2>
              <p className="text-xs text-gray-500">Manage your profile & preferences</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            <button className="flex items-center justify-between p-4 bg-[#252525] rounded-xl text-sm font-bold active:bg-gray-800 transition-colors">
              App Theme Preferences <ChevronRight size={18} />
            </button>
            <button className="flex items-center justify-between p-4 bg-[#252525] rounded-xl text-sm font-bold active:bg-gray-800 transition-colors">
              Clear Cache <ChevronRight size={18} />
            </button>
            <button className="flex items-center justify-between p-4 bg-[#252525] rounded-xl text-sm font-bold active:bg-gray-800 transition-colors">
              Legal & Privacy <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- App Root ---

const App = () => {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [playingMovie, setPlayingMovie] = useState(null);

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
    <div className="min-h-screen flex flex-col max-w-md mx-auto shadow-2xl relative bg-[#0f0f0f]">
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<HomeScreen onMovieClick={handleMovieClick} />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/upload" element={<UploadScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
        </Routes>
      </main>
      <BottomNav />

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
        />
      )}
    </div>
  );
};

export default App;
