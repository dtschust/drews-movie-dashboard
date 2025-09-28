import { useEffect, useRef, useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useSearchParams,
  useParams,
  useLocation,
} from 'react-router-dom';
import { searchMovies, getVersions, downloadMovie, getTopMovies, getImdbDetails } from './api.js';
import './index.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/Spinner.jsx';
import { Moon, Sun } from 'lucide-react';
import { movieCache, rememberMovies } from '@/lib/movieCache.js';

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
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">Enter API token</CardTitle>
          <p className="text-sm text-muted-foreground">
            Store your token locally to access the API.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Missing token</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="password"
              placeholder="Paste token..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
            />
            <Button className="w-full sm:w-auto" onClick={save}>
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Your token is only stored locally in this browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MovieCard({ movie, onClick }) {
  return (
    <Card
      className="flex h-full cursor-pointer flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-lg"
      onClick={onClick}
    >
      {movie.posterUrl ? (
        <div className="aspect-[2/3] w-full overflow-hidden">
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[2/3] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          No poster available
        </div>
      )}
      <CardContent className="px-4 py-3">
        <div className="font-semibold" title={movie.title}>
          {movie.title}
        </div>
        <div className="text-xs text-muted-foreground">
          {movie.year || 'Year unknown'}
        </div>
      </CardContent>
    </Card>
  );
}

function VersionRow({ v, onSelect }) {
  const line1 = `\n${v.quality} / ${v.codec} / ${v.container} / ${v.source} /\n${v.resolution}${v.scene ? ' / Scene' : ''}${v.remasterTitle ? ` / ${v.remasterTitle}` : ''}`;
  return (
    <button
      type="button"
      className="w-full rounded-lg border border-border bg-card/70 p-4 text-left transition hover:border-primary/60 hover:bg-card"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="whitespace-pre-line text-sm font-medium text-foreground">
          {line1}
        </div>
        <div className="text-lg" aria-hidden="true">
          {v.goldenPopcorn ? '🍿' : v.checked ? '✅' : '🎞️'}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>Seeders: {v.seeders}</span>
        <span>Snatched: {v.snatched}</span>
        <span>Size: {v.sizeGB?.toFixed ? v.sizeGB.toFixed(2) : v.sizeGB} GB</span>
      </div>
    </button>
  );
}

function AppLayout({ onLogout, error, onRestart, onToggleTheme, theme, children }) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onRestart}
            className="text-left text-3xl font-semibold text-foreground transition hover:text-primary focus:outline-none focus-visible:underline"
          >
            Drew's Movie Dashboard
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => setLogoutOpen(true)}>
            Log out
          </Button>
        </div>
      </header>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log out</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? You will need to enter your API token again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLogoutOpen(false);
                onLogout();
              }}
            >
              Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error}</span>
            <Button variant="outline" onClick={onRestart} className="w-fit">
              Restart
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">{children}</div>
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
          const nextMovies = Array.isArray(list) ? list : [];
          rememberMovies(nextMovies);
          setMovies(nextMovies);
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

  const goBack = () => {
    setError('');
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    setInputValue('');
    setMovies([]);
    setHasSearched(false);
    if (location.pathname !== '/search') {
      navigate('/search', { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
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
          <CardTitle>Search movies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
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
          <span>Scanning the catalog...</span>
        </div>
      )}

      {!loading && movies.length > 0 && (
        <div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {movies.map((m) => (
              <MovieCard key={m.id} movie={m} onClick={() => handleMovieClick(m)} />
            ))}
          </div>
        </div>
      )}

      {showTopMovies && (
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Weekly recommendations
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
  const [synopsis, setSynopsis] = useState('');
  const [credits, setCredits] = useState({ writers: [], directors: [], stars: [] });
  const [imdbLoading, setImdbLoading] = useState(false);
  const navigate = useNavigate();

  const cachedMovie = movieCache.get(String(movieId));
  const titleForDisplay = movieTitle || cachedMovie?.title || `Movie ${movieId}`;

  useEffect(() => {
    setMovieTitle(titleParam);
  }, [titleParam]);

  useEffect(() => {
    if (cachedMovie) {
      setSynopsis(cachedMovie.synopsis || '');
      setCredits(cachedMovie.credits || { writers: [], directors: [], stars: [] });
      setImdbLoading(false);
      return;
    }
    setSynopsis('');
    setCredits({ writers: [], directors: [], stars: [] });
    setImdbLoading(false);
  }, [cachedMovie, movieId]);

  useEffect(() => {
    if (!cachedMovie?.imdbId) return;

    const cachedSynopsis = cachedMovie.synopsis;
    const cachedCredits = cachedMovie.credits || { writers: [], directors: [], stars: [] };
    const hasCachedCredits = Object.values(cachedCredits).some(
      (list) => Array.isArray(list) && list.length > 0,
    );

    if (cachedMovie.imdbDetailsFetched && (cachedSynopsis || hasCachedCredits)) {
      return;
    }

    let cancelled = false;

    const toSynopsisString = (value) => {
      if (!value) return '';
      if (typeof value === 'string') return value.trim();
      if (Array.isArray(value)) {
        return value.map((entry) => toSynopsisString(entry)).find(Boolean) || '';
      }
      if (typeof value === 'object') {
        const fromText =
          (typeof value.text === 'string' && value.text.trim()) ||
          (typeof value.synopsis === 'string' && value.synopsis.trim()) ||
          (typeof value.summary === 'string' && value.summary.trim()) ||
          (typeof value.plot === 'string' && value.plot.trim());
        return fromText || '';
      }
      return '';
    };

    const getImageUrl = (source) => {
      if (!source) return '';
      if (typeof source === 'string') return source.trim();
      if (typeof source === 'object') {
        const candidates = [
          source.url,
          source.src,
          source.href,
          source.imageUrl,
          source.value,
          source.link,
          source.path,
        ];
        const found = candidates.find((value) => typeof value === 'string' && value.trim());
        if (found) {
          return found.trim();
        }
      }
      return '';
    };

    const normalizePerson = (entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return null;
        return { id: text, name: text, image: '' };
      }
      if (typeof entry === 'object') {
        const nameCandidate =
          entry.name ||
          entry.title ||
          entry.fullName ||
          entry.originalName ||
          entry.displayName ||
          entry.role ||
          entry.character;
        const name = typeof nameCandidate === 'string' ? nameCandidate.trim() : '';
        if (!name) return null;
        const idCandidate =
          entry.id ||
          entry.imdbId ||
          entry.imdb_id ||
          entry.nconst ||
          entry.personId ||
          entry.const ||
          name;
        const imageCandidate =
          getImageUrl(entry.image) ||
          getImageUrl(entry.photo) ||
          getImageUrl(entry.thumbnail) ||
          getImageUrl(entry.avatar) ||
          getImageUrl(entry.headshot) ||
          getImageUrl(entry.primaryImage) ||
          getImageUrl(entry.profileImage) ||
          getImageUrl(entry.poster);
        return {
          id: String(idCandidate),
          name,
          image: imageCandidate,
        };
      }
      return null;
    };

    const toPeopleArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.map((item) => normalizePerson(item)).filter(Boolean);
      }
      if (typeof value === 'object') {
        if (Array.isArray(value.items)) return toPeopleArray(value.items);
        if (Array.isArray(value.list)) return toPeopleArray(value.list);
        if (Array.isArray(value.values)) return toPeopleArray(value.values);
        if (Array.isArray(value.results)) return toPeopleArray(value.results);
        if (Array.isArray(value.people)) return toPeopleArray(value.people);
        const single = normalizePerson(value);
        return single ? [single] : [];
      }
      if (typeof value === 'string') {
        return value
          .split(/,|&|\band\b/gi)
          .map((piece) => piece.trim())
          .filter(Boolean)
          .map((name) => ({ id: name, name, image: '' }));
      }
      return [];
    };

    const mergePeople = (...sources) => {
      const seen = new Map();
      sources.forEach((source) => {
        toPeopleArray(source).forEach((person) => {
          const key = person.id || person.name;
          if (!seen.has(key)) {
            seen.set(key, person);
          }
        });
      });
      return Array.from(seen.values());
    };

    async function fetchImdbDetails() {
      setImdbLoading(true);
      try {
        const data = await getImdbDetails(cachedMovie.imdbId);
        if (cancelled) return;

        const synopsisCandidates = [data?.synopsis, data?.plot, data?.plotSummary, data?.short];
        const nextSynopsis =
          synopsisCandidates.map((entry) => toSynopsisString(entry)).find((entry) => Boolean(entry)) || '';

        const nextCredits = {
          writers: mergePeople(
            data?.credits?.writers,
            data?.credits?.writing,
            data?.credits?.writer,
            data?.writers,
            data?.writer,
            data?.writerList,
          ),
          directors: mergePeople(
            data?.credits?.directors,
            data?.credits?.direction,
            data?.credits?.director,
            data?.directors,
            data?.director,
            data?.creators,
            data?.creatorList,
          ),
          stars: mergePeople(
            data?.credits?.stars,
            data?.credits?.cast,
            data?.credits?.actors,
            data?.stars,
            data?.cast,
            data?.actors,
            data?.principalCast,
          ),
        };

        const cleanSynopsis = nextSynopsis.trim();
        const mergedCredits = {
          writers: nextCredits.writers.length ? nextCredits.writers : cachedCredits.writers || [],
          directors: nextCredits.directors.length ? nextCredits.directors : cachedCredits.directors || [],
          stars: nextCredits.stars.length ? nextCredits.stars : cachedCredits.stars || [],
        };

        if (cleanSynopsis || cachedSynopsis) {
          setSynopsis(cleanSynopsis || cachedSynopsis || '');
        }

        setCredits(mergedCredits);

        const existing = movieCache.get(String(movieId)) || {};
        movieCache.set(String(movieId), {
          ...existing,
          imdbId: existing.imdbId || cachedMovie.imdbId,
          synopsis: cleanSynopsis || existing.synopsis || cachedSynopsis || '',
          credits: mergedCredits,
          imdbDetailsFetched: true,
        });
      } catch (error) {
        console.error('Failed to load IMDb details', error);
      } finally {
        if (!cancelled) setImdbLoading(false);
      }
    }

    fetchImdbDetails();

    return () => {
      cancelled = true;
    };
  }, [cachedMovie?.imdbDetailsFetched, cachedMovie?.imdbId, cachedMovie?.synopsis, cachedMovie?.credits, movieId]);

  useEffect(() => {
    let cancelled = false;

    async function fetchVersions() {
      setLoading(true);
      setError('');
      try {
        const { versions: list } = await getVersions(movieId, titleParam);
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
  }, [movieId, titleParam, setError]);

  const handleBack = () => {
    setError('');
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (originQuery) {
      navigate(`/search?query=${encodeURIComponent(originQuery)}`, { replace: true });
    } else {
      navigate('/search', { replace: true });
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
      if (movieTitle) {
        params.set('title', movieTitle);
      } else if (cachedMovie?.title) {
        params.set('title', cachedMovie.title);
      }
      navigate(`/download?${params.toString()}`);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasCredits = Boolean(
    (credits.directors && credits.directors.length) ||
      (credits.writers && credits.writers.length) ||
      (credits.stars && credits.stars.length),
  );

  const renderPeopleGroup = (label, people) => {
    if (!Array.isArray(people) || people.length === 0) return null;
    return (
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <ul className="flex flex-wrap gap-3">
          {people.map((person, index) => {
            const displayName = person.name || person.id;
            const placeholder = displayName ? displayName.charAt(0).toUpperCase() : '?';
            const key = person.id || `${displayName}-${index}`;
            return (
              <li
                key={key}
                className="flex min-w-[180px] items-center gap-3 rounded-md border border-border/70 bg-card/70 px-3 py-2"
              >
                {person.image ? (
                  <img
                    src={person.image}
                    alt={displayName}
                    className="h-12 w-12 flex-none rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    {placeholder}
                  </div>
                )}
                <span className="text-sm font-medium text-foreground">{displayName}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-dashed border-border/80 bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        {cachedMovie && (cachedMovie.posterUrl || cachedMovie.title || cachedMovie.year) ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-4">
              {cachedMovie.posterUrl ? (
                <div className="h-32 w-24 overflow-hidden rounded-md border border-border/80 bg-card">
                  <img
                    src={cachedMovie.posterUrl}
                    alt={cachedMovie.title || titleForDisplay}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Versions for
                </div>
                <div className="text-lg font-semibold text-foreground">
                  {cachedMovie.title || titleForDisplay}
                </div>
                {cachedMovie.year ? (
                  <div className="text-xs text-muted-foreground">{cachedMovie.year}</div>
                ) : null}
              </div>
            </div>
            {(imdbLoading || synopsis || hasCredits) && (
              <div className="space-y-3 text-sm text-muted-foreground">
                {synopsis ? (
                  <div className="max-w-xl leading-relaxed">{synopsis}</div>
                ) : imdbLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Spinner />
                    <span>Fetching synopsis...</span>
                  </div>
                ) : null}
                {(hasCredits || imdbLoading) && (
                  <details className="overflow-hidden rounded-md border border-border/80 bg-card/60 text-foreground">
                    <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold">
                      <span>Cast &amp; crew</span>
                      {imdbLoading ? <Spinner /> : null}
                    </summary>
                    <div className="space-y-4 border-t border-border/60 px-3 py-3 text-sm text-muted-foreground">
                      {imdbLoading && !hasCredits ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Spinner />
                          <span>Loading credits...</span>
                        </div>
                      ) : null}
                      {renderPeopleGroup('Directors', credits.directors)}
                      {renderPeopleGroup('Writers', credits.writers)}
                      {renderPeopleGroup('Stars', credits.stars)}
                      {!imdbLoading && !hasCredits ? (
                        <div className="text-xs text-muted-foreground">No additional credits available.</div>
                      ) : null}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm font-medium text-muted-foreground">Versions for: {titleForDisplay}</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          <span>Cataloging editions...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <VersionRow key={v.id} v={v} onSelect={() => requestDownload(v)} />
          ))}
          {versions.length === 0 && (
            <div className="text-sm text-muted-foreground">No versions available.</div>
          )}
        </div>
      )}

      <Dialog
        open={!!pendingVersion}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isSubmitting) {
            setPendingVersion(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{titleForDisplay ? `Confirm download — ${titleForDisplay}` : 'Confirm download'}</DialogTitle>
            <DialogDescription>
              Review this release before starting the download.
            </DialogDescription>
          </DialogHeader>
          {pendingVersion && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>
                {pendingVersion.goldenPopcorn ? '🍿 ' : ''}
                {pendingVersion.checked ? '✅ ' : ''}
                {pendingVersion.quality} / {pendingVersion.codec} / {pendingVersion.container} / {pendingVersion.source} / {pendingVersion.resolution}
                {pendingVersion.scene ? ' / Scene' : ''}
                {pendingVersion.remasterTitle ? ` / ${pendingVersion.remasterTitle}` : ''}
              </div>
              <div>
                Seeders: {pendingVersion.seeders}, Snatched: {pendingVersion.snatched}, Size: {pendingVersion.sizeGB?.toFixed ? pendingVersion.sizeGB.toFixed(2) : pendingVersion.sizeGB} GB
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingVersion(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={confirmDownload} disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : 'Start download'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        <CardTitle>Download initiated</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {movieTitle
            ? `Download started for "${movieTitle}". Feel free to queue up another search.`
            : 'Your download has been initiated successfully. Start another search to keep the queue going.'}
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
  const [isManualTheme, setIsManualTheme] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem('theme');
      return stored === 'light' || stored === 'dark';
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      /* noop */
    }
    const prefersDark =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (isManualTheme) {
      try {
        localStorage.setItem('theme', theme);
      } catch {
        /* noop */
      }
    } else {
      try {
        localStorage.removeItem('theme');
      } catch {
        /* noop */
      }
    }
  }, [theme, isManualTheme]);

  useEffect(() => {
    if (isManualTheme) return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      setTheme(event.matches ? 'dark' : 'light');
    };

    setTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [isManualTheme]);

  const toggleTheme = () => {
    setIsManualTheme(true);
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    if (!token) return;
    if (topMoviesRequested.current) return;
    topMoviesRequested.current = true;

    let cancelled = false;

    async function fetchTop() {
      try {
        const { movies: list } = await getTopMovies();
        if (!cancelled) {
          const nextTop = Array.isArray(list) ? list : [];
          rememberMovies(nextTop);
          setTopMovies(nextTop);
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
    topMoviesRequested.current = false;
    navigate('/search', { replace: true });
  };

  return (
    <AppLayout
      onLogout={handleLogout}
      error={error}
      onRestart={handleRestart}
      onToggleTheme={toggleTheme}
      theme={theme}
    >
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
