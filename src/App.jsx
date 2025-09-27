import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import { searchMovies, getVersions, downloadMovie, getTopMovies } from './api.js';
import './index.css';
import { Button, Input, Card, CardHeader, CardContent, Alert, Modal } from './components/ui.jsx';
import { Spinner } from './components/Spinner.jsx';

function useLocalToken() {
  const [token, setToken] = useState('');
  useEffect(() => {
    try {
      setToken(localStorage.getItem('token') || '');
    } catch {
      /* noop */
    }
  }, []);
  const saveToken = (t) => {
    try {
      localStorage.setItem('token', t);
    } catch {
      /* noop */
    }
    setToken(t);
  };
  const clearToken = () => {
    try {
      localStorage.removeItem('token');
    } catch {
      /* noop */
    }
    setToken('');
  };
  return { token, saveToken, clearToken };
}

function TokenGate({ onSaved }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const save = () => {
    if (!value.trim()) {
      setError('Please enter a token');
      return;
    }
    try {
      localStorage.setItem('token', value.trim());
    } catch {
      /* noop */
    }
    onSaved(value.trim());
  };
  return (
    <div className="max-w-md mx-auto mt-24 p-6">
      <h1 className="text-2xl font-semibold mb-4 text-foreground">Enter API Token</h1>
      <p className="text-sm text-muted-foreground mb-4">Store your token locally to access the API.</p>
      {error && <Alert className="mb-3">{error}</Alert>}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="password"
          placeholder="Paste token..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
        />
        <Button className="w-full sm:w-auto" onClick={save}>Save</Button>
      </div>
    </div>
  );
}

function MovieCard({ movie, onClick }) {
  return (
    <Card className="overflow-hidden hover:shadow transition cursor-pointer" onClick={onClick}>
      {movie.posterUrl ? (
        <img src={movie.posterUrl} alt={movie.title} className="w-full aspect-[2/3] object-cover" />
      ) : (
        <div className="w-full aspect-[2/3] bg-muted flex items-center justify-center text-muted-foreground">No Image</div>
      )}
      <CardContent>
        <div className="font-medium">{movie.title}</div>
        <div className="text-sm text-muted-foreground">{movie.year || '—'}</div>
      </CardContent>
    </Card>
  );
}

function VersionRow({ v, onSelect }) {
  const line1 = `\n${v.quality} / ${v.codec} / ${v.container} / ${v.source} /\n${v.resolution}${v.scene ? ' / Scene' : ''}${v.remasterTitle ? ` / ${v.remasterTitle}` : ''}`;
  return (
    <button className="w-full text-left p-3 rounded-md border border-border hover:bg-muted transition" onClick={onSelect}>
      <div className="flex items-center gap-2">
        <span>
          {v.goldenPopcorn ? '🍿 ' : ''}
          {v.checked ? '✅ ' : ''}
        </span>
        <span className="font-medium whitespace-pre-line">{line1}</span>
      </div>
      <div className="text-sm text-muted-foreground mt-1">
        Seeders: {v.seeders}, Snatched: {v.snatched}, Size: {v.sizeGB?.toFixed ? v.sizeGB.toFixed(2) : v.sizeGB} GB
      </div>
    </button>
  );
}

function AppLayout({ onLogout, error, onRestart, children }) {
  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Drew's Movie Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onLogout}>Log out</Button>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <Alert>
            <div className="font-medium mb-1">Something went wrong</div>
            <div className="text-sm">{error}</div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={onRestart}>Restart</Button>
            </div>
          </Alert>
        </div>
      )}

      {children}
    </div>
  );
}

function SearchPage({ topMovies, setError }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('query') || '';
  const [inputValue, setInputValue] = useState(queryParam);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(Boolean(queryParam));
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setInputValue(queryParam);
  }, [queryParam]);

  useEffect(() => {
    if (!queryParam.trim()) {
      setMovies([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMovies() {
      setLoading(true);
      setError('');
      setMovies([]);
      try {
        const { movies: list } = await searchMovies(queryParam.trim());
        if (!cancelled) {
          setMovies(list || []);
          setHasSearched(true);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError(String(e.message || e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMovies();
    return () => {
      cancelled = true;
    };
  }, [queryParam, setError]);

  const canSearch = inputValue.trim().length > 0;
  const showTopMovies = !loading && !hasSearched && topMovies?.length > 0;

  const doSearch = () => {
    if (!canSearch) return;
    setError('');
    setSearchParams({ query: inputValue.trim() });
  };

  const resetFlow = () => {
    setError('');
    setInputValue('');
    setMovies([]);
    setHasSearched(false);
    if (location.pathname !== '/search') {
      navigate('/search', { replace: true });
    }
    setSearchParams({});
  };

  const handleMovieClick = (movie) => {
    const params = new URLSearchParams();
    if (movie.title) params.set('title', movie.title);
    const activeQuery = queryParam || inputValue.trim();
    if (activeQuery) params.set('query', activeQuery);
    navigate(`/torrents/${movie.id}?${params.toString()}`);
  };

  const handleTopMovie = async (movie) => {
    const params = new URLSearchParams();
    if (movie.title) {
      await searchMovies(movie.title);
      params.set('title', movie.title);
      params.set('query', movie.title);
    }
    navigate(`/torrents/${movie.id}?${params.toString()}`);
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <div className="font-medium">Search Movies</div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Type a movie title..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSearch) doSearch();
              }}
            />
            <Button className="w-full sm:w-auto" onClick={doSearch} disabled={!canSearch || loading}>
              {loading ? <Spinner /> : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          <span>Loading...</span>
        </div>
      )}

      {!loading && movies.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-medium">Search Results</div>
            <Button variant="outline" onClick={resetFlow}>Back</Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {movies.map((m) => (
              <MovieCard key={m.id} movie={m} onClick={() => handleMovieClick(m)} />
            ))}
          </div>
        </div>
      )}

      {showTopMovies && (
        <div>
          <div className="mb-3 text-lg font-medium">Top Movies this Week</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {topMovies.map((m) => (
              <MovieCard key={m.id} movie={m} onClick={() => handleTopMovie(m)} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function VersionsPage({ setError }) {
  const { movieId } = useParams();
  const [searchParams] = useSearchParams();
  const titleParam = searchParams.get('title') || '';
  const originQuery = searchParams.get('query') || '';
  const [movieTitle, setMovieTitle] = useState(titleParam);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingVersion, setPendingVersion] = useState(null);
  const navigate = useNavigate();

  const titleForDisplay = movieTitle || `Movie ${movieId}`;

  useEffect(() => {
    setMovieTitle(titleParam);
  }, [titleParam]);

  useEffect(() => {
    let cancelled = false;

    async function fetchVersions() {
      setLoading(true);
      setError('');
      try {
        const { versions: list } = await getVersions(movieId);
        if (!cancelled) {
          setVersions(list || []);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError(String(e.message || e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchVersions();
    return () => {
      cancelled = true;
    };
  }, [movieId, setError]);

  const handleBack = () => {
    setError('');
    if (originQuery) {
      navigate(`/search?query=${encodeURIComponent(originQuery)}`);
    } else {
      navigate('/search');
    }
  };

  const requestDownload = (version) => {
    setPendingVersion(version);
  };

  const confirmDownload = async () => {
    if (!pendingVersion) return;
    setIsSubmitting(true);
    setError('');
    try {
      await downloadMovie({ torrentId: pendingVersion.id, movieTitle: titleForDisplay });
      setPendingVersion(null);
      const params = new URLSearchParams();
      params.set('movieId', movieId);
      if (movieTitle) params.set('title', movieTitle);
      navigate(`/download?${params.toString()}`);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-medium">Versions for: {titleForDisplay}</div>
        <Button variant="outline" onClick={handleBack}>Back</Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          <span>Loading...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <VersionRow key={v.id} v={v} onSelect={() => requestDownload(v)} />
          ))}
          {versions.length === 0 && (
            <div className="text-muted-foreground">No versions available.</div>
          )}
        </div>
      )}

      <Modal
        open={!!pendingVersion}
        onClose={() => {
          if (!isSubmitting) setPendingVersion(null);
        }}
        title={movieTitle ? `Confirm download — ${movieTitle}` : 'Confirm download'}
        footer={(
          <>
            <Button variant="outline" onClick={() => setPendingVersion(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={confirmDownload} disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : 'Start download'}
            </Button>
          </>
        )}
      >
        {pendingVersion && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              {pendingVersion.goldenPopcorn ? '🍿 ' : ''}
              {pendingVersion.checked ? '✅ ' : ''}
              {pendingVersion.quality} / {pendingVersion.codec} / {pendingVersion.container} / {pendingVersion.source} / {pendingVersion.resolution}
              {pendingVersion.scene ? ' / Scene' : ''}
              {pendingVersion.remasterTitle ? ` / ${pendingVersion.remasterTitle}` : ''}
            </div>
            <div className="text-sm text-muted-foreground">
              Seeders: {pendingVersion.seeders}, Snatched: {pendingVersion.snatched}, Size: {pendingVersion.sizeGB?.toFixed ? pendingVersion.sizeGB.toFixed(2) : pendingVersion.sizeGB} GB
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DownloadPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const movieTitle = searchParams.get('title');

  return (
    <Card>
      <CardHeader>
        <div className="font-medium">Download Started</div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-muted-foreground">
          {movieTitle ? `Download started for "${movieTitle}".` : 'Your download has been initiated successfully.'}
        </p>
        <Button onClick={() => navigate('/search')}>Start another search</Button>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const navigate = useNavigate();
  const { token, saveToken, clearToken } = useLocalToken();
  const [topMovies, setTopMovies] = useState([]);
  const [error, setError] = useState('');
  const topMoviesRequested = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (topMoviesRequested.current) return;
    topMoviesRequested.current = true;

    let cancelled = false;

    async function fetchTop() {
      try {
        const { movies: list } = await getTopMovies();
        if (!cancelled) {
          setTopMovies(list || []);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError(String(e.message || e));
        }
      }
    }

    fetchTop();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return (
      <TokenGate
        onSaved={(value) => {
          saveToken(value);
          setError('');
          setTopMovies([]);
          topMoviesRequested.current = false;
          navigate('/search', { replace: true });
        }}
      />
    );
  }

  const handleLogout = () => {
    clearToken();
    setError('');
    setTopMovies([]);
    topMoviesRequested.current = false;
    navigate('/', { replace: true });
  };

  const handleRestart = () => {
    setError('');
    setTopMovies([]);
    topMoviesRequested.current = false;
    navigate('/search', { replace: true });
  };

  return (
    <AppLayout onLogout={handleLogout} error={error} onRestart={handleRestart}>
      <Routes>
        <Route path="/" element={<SearchPage topMovies={topMovies} setError={setError} />} />
        <Route path="/search" element={<SearchPage topMovies={topMovies} setError={setError} />} />
        <Route path="/torrents/:movieId" element={<VersionsPage setError={setError} />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route path="*" element={<Navigate to="/search" replace />} />
      </Routes>
    </AppLayout>
  );
}
