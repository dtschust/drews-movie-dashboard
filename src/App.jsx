import { useEffect, useMemo, useState } from 'react';
import { searchMovies, getVersions, downloadMovie } from './api.js';
import './index.css';
import { Button, Input, Card, CardHeader, CardContent, Alert, Badge } from './components/ui.jsx';
import { Spinner } from './components/Spinner.jsx';

function useLocalToken() {
  const [token, setToken] = useState('');
  useEffect(() => {
    try { setToken(localStorage.getItem('token') || ''); } catch { /* noop */ }
  }, []);
  const saveToken = (t) => {
    try { localStorage.setItem('token', t); } catch { /* noop */ }
    setToken(t);
  };
  const clearToken = () => {
    try { localStorage.removeItem('token'); } catch { /* noop */ }
    setToken('');
  };
  return { token, saveToken, clearToken };
}

function TokenGate({ onSaved }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const save = () => {
    if (!value.trim()) { setError('Please enter a token'); return; }
    try { localStorage.setItem('token', value.trim()); } catch {}
    onSaved(value.trim());
  };
  return (
    <div className="max-w-md mx-auto mt-24 p-6">
      <h1 className="text-2xl font-semibold mb-4 text-foreground">Enter API Token</h1>
      <p className="text-sm text-muted-foreground mb-4">Store your token locally to access the API.</p>
      {error && <Alert className="mb-3">{error}</Alert>}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input type="password" placeholder="Paste token..." value={value} onChange={(e)=>setValue(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') save(); }} />
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
        <span>{v.goldenPopcorn ? '🍿 ' : ''}{v.checked ? '✅ ' : ''}</span>
        <span className="font-medium whitespace-pre-line">{line1}</span>
      </div>
      <div className="text-sm text-muted-foreground mt-1">
        Seeders: {v.seeders}, Snatched: {v.snatched}, Size: {v.sizeGB?.toFixed ? v.sizeGB.toFixed(2) : v.sizeGB} GB
      </div>
    </button>
  );
}

export default function App() {
  const { token, saveToken, clearToken } = useLocalToken();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [versions, setVersions] = useState([]);
  const [downloaded, setDownloaded] = useState(false);

  const canSearch = useMemo(() => query.trim().length > 0, [query]);

  async function doSearch() {
    setError(''); setLoading(true); setMovies([]); setSelectedMovie(null); setVersions([]); setDownloaded(false);
    try {
      const { movies: list } = await searchMovies(query.trim());
      setMovies(list || []);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally { setLoading(false); }
  }

  async function loadVersions(movie) {
    setError(''); setLoading(true); setSelectedMovie(movie); setVersions([]); setDownloaded(false);
    try {
      const { versions: list } = await getVersions(movie.id);
      setVersions(list || []);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally { setLoading(false); }
  }

  async function startDownload(torrentId) {
    setError(''); setLoading(true);
    try {
      await downloadMovie({ torrentId, movieTitle: selectedMovie.title });
      setDownloaded(true);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally { setLoading(false); }
  }

  function resetFlow() {
    setQuery(''); setMovies([]); setSelectedMovie(null); setVersions([]); setDownloaded(false); setError('');
  }

  if (!token) {
    return <TokenGate onSaved={saveToken} />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Drew's Movie Dashboard</h1>
        <div className="flex items-center gap-2">
          <Badge>Authed</Badge>
          <Button variant="outline" onClick={clearToken}>Clear Token</Button>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <Alert>
            <div className="font-medium mb-1">Something went wrong</div>
            <div className="text-sm">{error}</div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={resetFlow}>Restart</Button>
            </div>
          </Alert>
        </div>
      )}

      {!selectedMovie && !downloaded && (
        <Card className="mb-6">
          <CardHeader>
            <div className="font-medium">Search Movies</div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Type a movie title..." value={query} onChange={(e)=>setQuery(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter' && canSearch) doSearch(); }} />
              <Button className="w-full sm:w-auto" onClick={doSearch} disabled={!canSearch || loading}>{loading ? <Spinner /> : 'Search'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground"><Spinner /><span>Loading...</span></div>
      )}

      {!loading && movies?.length > 0 && !selectedMovie && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {movies.map((m) => (
            <MovieCard key={m.id} movie={m} onClick={() => loadVersions(m)} />
          ))}
        </div>
      )}

      {!loading && selectedMovie && !downloaded && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-lg font-medium">Versions for: {selectedMovie.title}</div>
            <Button variant="outline" onClick={resetFlow}>Back</Button>
          </div>
          <div className="space-y-3">
            {versions.map((v) => (
              <VersionRow key={v.id} v={v} onSelect={() => startDownload(v.id)} />
            ))}
            {versions.length === 0 && (
              <div className="text-muted-foreground">No versions available.</div>
            )}
          </div>
        </div>
      )}

      {!loading && downloaded && (
        <Card>
          <CardHeader>
            <div className="font-medium">Download Started</div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground">Your download has been initiated successfully.</p>
            <Button onClick={resetFlow}>Start another search</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
