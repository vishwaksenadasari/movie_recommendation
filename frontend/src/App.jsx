import { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

function App() {
  const [movies, setMovies] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('movie-recommendation-user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      console.error("Error restoring user session:", error);
      return null;
    }
  });
  const updateUserSession = (nextUser) => {
    try {
      if (nextUser) {
        localStorage.setItem('movie-recommendation-user', JSON.stringify(nextUser));
      } else {
        localStorage.removeItem('movie-recommendation-user');
      }
    } catch (error) {
      console.error("Error saving user session:", error);
    }
    setUser(nextUser);
  };
  const [view, setView] = useState('list');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Movie Detail State
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [hasWatched, setHasWatched] = useState(false);

  const fetchMovies = useCallback(async (query = '', pageNum = 1) => {
    try {
      let url = query ? `${API_URL}/movies/?query=${query}&page=${pageNum}` : `${API_URL}/movies/list?page=${pageNum}`;
      if (user) url += `&userId=${user.id}`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.movies) {
        if (pageNum === 1) {
          setMovies(data.movies);
        } else {
          setMovies(prev => [...prev, ...data.movies]);
        }
        setHasMore(data.hasMore ?? data.movies.length === 20);
      }
    } catch (error) {
      console.error("Error fetching movies:", error);
    }
  }, [user]);

  useEffect(() => {
    const loadInitialMovies = async () => {
      await fetchMovies('', 1);
    };
    loadInitialMovies();
  }, [fetchMovies]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchMovies(searchQuery, 1);
  };

  const handleShowMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMovies(searchQuery, nextPage);
  };

  const openMovieDetail = async (movie) => {
    setSelectedMovie(movie);
    setView('movie_detail');
    setRecommendations([]);
    setLoadingRecs(true);
    setIsWatching(false);
    setHasWatched(false);
    window.scrollTo(0, 0);
    
    if (user) {
      try {
        await fetch(`${API_URL}/movies/${movie.id}?userId=${user.id}`);
      } catch (err) {
        console.error("Error logging click:", err);
      }
    }

    try {
      let url = `${API_URL}/movies/${movie.id}/recommendations`;
      if (user) url += `?userId=${user.id}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.recommendations) {
        setRecommendations(data.recommendations);
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    } finally {
      setLoadingRecs(false);
    }
  };

  const handleWatch = () => {
    if (!user) {
      alert("Please login to watch movies");
      return;
    }
    setIsWatching(true);
    setTimeout(async () => {
      setIsWatching(false);
      setHasWatched(true);
      try {
        await fetch(`${API_URL}/movies/${selectedMovie.id}/watch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
      } catch (err) {
        console.error("Error saving watch history:", err);
      }
    }, 5000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.user) {
        updateUserSession(data.user);
        setView('list');
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error logging in:", error);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, gender: 'others', age: 20 })
      });
      const data = await res.json();
      if (data.user) {
        updateUserSession(data.user);
        setView('list');
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error signing up:", error);
    }
  };

  const handleLike = async (movieId) => {
    if (!user) {
      alert("Please login to like movies");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/movies/${movieId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else if (data.likes_count !== undefined) {
        const updateLikes = (m) => m.id === movieId ? { ...m, likes_count: data.likes_count, is_liked: data.is_liked } : m;
        setMovies(prev => prev.map(updateLikes));
        setRecommendations(prev => prev.map(updateLikes));
        if (selectedMovie && selectedMovie.id === movieId) {
           setSelectedMovie(prev => ({...prev, likes_count: data.likes_count, is_liked: data.is_liked}));
        }
      }
    } catch (error) {
      console.error("Error liking movie:", error);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1 onClick={() => { setView('list'); setPage(1); fetchMovies('', 1); }} style={{cursor: 'pointer'}}>
          Movie Recommendations
        </h1>
        <nav>
          {user ? (
            <div className="user-info">
              <span>Welcome, {user.name || user.email}!</span>
              <button onClick={() => { updateUserSession(null); setView('list'); setPage(1); }} className="btn-secondary">Logout</button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button onClick={() => setView('login')} className="btn-primary">Login</button>
              <button onClick={() => setView('signup')} className="btn-secondary">Sign Up</button>
            </div>
          )}
        </nav>
      </header>

      <main className="main-content">
        {view === 'login' && !user && (
          <div className="auth-form">
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="submit" className="btn-primary">Login</button>
              <button type="button" onClick={() => setView('list')} className="btn-text">Cancel</button>
            </form>
          </div>
        )}

        {view === 'signup' && !user && (
          <div className="auth-form">
            <h2>Sign Up</h2>
            <form onSubmit={handleSignup}>
              <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="submit" className="btn-primary">Sign Up</button>
              <button type="button" onClick={() => setView('list')} className="btn-text">Cancel</button>
            </form>
          </div>
        )}

        {view === 'list' && (
          <>
            <form className="search-bar" onSubmit={handleSearch}>
              <input 
                type="text" 
                placeholder="Search movies..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn-primary">Search</button>
            </form>

            <div className="movie-grid">
              {movies.map(movie => (
                <div key={movie.id} className="movie-card">
                  <img 
                    src={movie.poster || 'https://via.placeholder.com/300x450'} 
                    alt={movie.name} 
                    className="movie-poster" 
                    onClick={() => openMovieDetail(movie)}
                    style={{cursor: 'pointer'}}
                  />
                  <div className="movie-info">
                    <h3>{movie.name}</h3>
                    <p className="movie-genre">{movie.genre}</p>
                    <p className="movie-rating">⭐ {movie.rating || 'N/A'}</p>
                    <button 
                      onClick={() => handleLike(movie.id)} 
                      className="btn-like"
                      style={{ backgroundColor: movie.is_liked ? '#e50914' : '#222' }}
                    >
                      {movie.is_liked ? '❤️ Liked' : '🤍 Like'} ({movie.likes_count || 0})
                    </button>
                  </div>
                </div>
              ))}
              {movies.length === 0 && <p>No movies found.</p>}
            </div>
            
            {(hasMore || user) && movies.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <button className="btn-secondary" onClick={handleShowMore}>Show More</button>
              </div>
            )}
          </>
        )}

        {view === 'movie_detail' && selectedMovie && (
          <div className="movie-detail-view">
            <button className="btn-secondary" onClick={() => setView('list')} style={{marginBottom: '20px'}}>
              &larr; Back to List
            </button>
            
            <div className="detail-header-info" style={{ display: 'flex', gap: '30px', marginBottom: '40px' }}>
                <img 
                    src={selectedMovie.poster || 'https://via.placeholder.com/300x450'} 
                    alt={selectedMovie.name} 
                    style={{ width: '300px', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}
                />
                <div className="detail-text">
                    <h2 style={{ fontSize: '3rem', marginTop: 0, color: '#e50914' }}>{selectedMovie.name}</h2>
                    <p><strong>Genre:</strong> {selectedMovie.genre}</p>
                    <p><strong>Director:</strong> {selectedMovie.director}</p>
                    <p><strong>Cast:</strong> {selectedMovie.cast}</p>
                    <p><strong>Rating:</strong> ⭐ {selectedMovie.rating}</p>
                    
                    <div style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                      <button 
                          onClick={() => handleLike(selectedMovie.id)} 
                          className="btn-like" 
                          style={{ width: 'auto', padding: '10px 20px', margin: 0, backgroundColor: selectedMovie.is_liked ? '#e50914' : '#222' }}
                      >
                          {selectedMovie.is_liked ? '❤️ Liked' : '🤍 Like'} ({selectedMovie.likes_count || 0})
                      </button>

                      <button 
                          onClick={handleWatch} 
                          className="btn-primary" 
                          disabled={isWatching || hasWatched}
                          style={{ padding: '10px 20px', fontSize: '1rem', width: 'auto', position: 'relative' }}
                      >
                          {isWatching ? 'Watching... 🍿' : hasWatched ? 'Watched ✅' : '▶ Watch Now'}
                      </button>
                    </div>
                </div>
            </div>

            <div className="recommendations-section" style={{ borderTop: '1px solid #333', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '1.8rem', marginBottom: '20px' }}>Recommended for you</h3>
                {loadingRecs ? (
                    <p>Loading recommendations...</p>
                ) : (
                    <div className="movie-grid">
                        {recommendations.map(movie => (
                            <div key={movie.id} className="movie-card">
                                <img 
                                    src={movie.poster || 'https://via.placeholder.com/300x450'} 
                                    alt={movie.name} 
                                    className="movie-poster"
                                    onClick={() => openMovieDetail(movie)}
                                    style={{cursor: 'pointer'}}
                                />
                                <div className="movie-info">
                                    <h3>{movie.name}</h3>
                                    <button 
                                        onClick={() => handleLike(movie.id)} 
                                        className="btn-like"
                                        style={{ backgroundColor: movie.is_liked ? '#e50914' : '#222' }}
                                    >
                                        {movie.is_liked ? '❤️ Liked' : '🤍 Like'} ({movie.likes_count || 0})
                                    </button>
                                </div>
                            </div>
                        ))}
                        {recommendations.length === 0 && <p>No recommendations found.</p>}
                    </div>
                )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
