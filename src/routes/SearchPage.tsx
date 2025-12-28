import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/Spinner';
import { downloadTvShow, searchMovies, searchTvShows } from '@/api';
import { rememberMovies } from '@/lib/movieCache';
import type { HdbitsTorrentItem, MovieSummary } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import { toErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useEmbeddedAppContext } from '@/context/EmbeddedAppContext';
import { useWidgetState } from '@/lib/useWidgetState';

interface MovieCardProps {
  movie: MovieSummary;
  onClick: () => void;
}

function MovieCard({ movie, onClick }: MovieCardProps) {
  const { isEmbeddedApp } = useEmbeddedAppContext();
  return (
    <Card
      className={cn(
        'flex h-full cursor-pointer flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-lg',
        isEmbeddedApp && 'p-2 flex-row items-start justify-start',
      )}
      onClick={onClick}
    >
      {movie.posterUrl ? (
        <div
          className={cn('aspect-[2/3] w-full overflow-hidden max-w-', isEmbeddedApp && 'max-w-12')}
        >
          <img
            src={movie.posterUrl}
            alt={movie.title ?? 'Movie poster'}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[2/3] w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          No poster available
        </div>
      )}
      <CardContent className={cn('px-4 py-3', isEmbeddedApp && 'py-0')}>
        <div className="font-semibold" title={movie.title ?? undefined}>
          {movie.title}
        </div>
        <div className="text-xs text-muted-foreground">{movie.year || 'Year unknown'}</div>
      </CardContent>
    </Card>
  );
}

type SearchMode = 'movies' | 'tv';

const formatSize = (bytes?: number): string => {
  if (!bytes || Number.isNaN(bytes)) return 'Unknown';
  const gib = bytes / 1024 / 1024 / 1024;
  if (gib >= 1) {
    return `${gib.toFixed(2)} GiB`;
  }
  const mib = bytes / 1024 / 1024;
  return `${mib.toFixed(0)} MiB`;
};

const getTorrentDate = (added: string, utadded: number): Date | null => {
  if (Number.isFinite(utadded) && utadded > 0) {
    const date = new Date(utadded * 1000);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  if (added) {
    const date = new Date(added);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
};

const formatTimeAlive = (added: string, utadded: number): string => {
  const date = getTorrentDate(added, utadded);
  if (!date) return 'Unknown';
  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) return 'Moments ago';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(diffDays / 30);
  const days = diffDays % 30;
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const parts: string[] = [];
  if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (parts.length === 0) {
    parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  }
  return parts.slice(0, 2).join(' ');
};

const formatAddedDate = (added: string): string => {
  if (!added) return 'Unknown';
  const date = new Date(added);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

interface TvStatProps {
  label: string;
  value: ReactNode;
  accent?: boolean;
}

function TvStat({ label, value, accent = false }: TvStatProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={cn('text-sm font-semibold text-foreground', accent && 'text-primary')}>
        {value}
      </div>
    </div>
  );
}

interface TvResultRowProps {
  torrent: HdbitsTorrentItem;
  disabled: boolean;
  downloading: boolean;
  onSelect: () => void;
}

function TvResultRow({ torrent, disabled, downloading, onSelect }: TvResultRowProps) {
  const imdbRating =
    typeof torrent.imdb?.rating === 'number' ? torrent.imdb.rating.toFixed(1) : null;
  const imdbGenres = Array.isArray(torrent.imdb?.genres) ? torrent.imdb?.genres : [];
  const seasonEpisode =
    torrent.tvdb && (torrent.tvdb.season || torrent.tvdb.episode)
      ? `S${String(torrent.tvdb.season || 0).padStart(2, '0')}E${String(torrent.tvdb.episode || 0).padStart(2, '0')}`
      : '';
  const statusClass =
    torrent.torrent_status === 'seeding'
      ? 'bg-emerald-600/90 text-emerald-50'
      : torrent.torrent_status === 'leeching'
        ? 'bg-amber-500/80 text-amber-50'
        : torrent.torrent_status === 'completed'
          ? 'bg-blue-500/80 text-blue-50'
          : 'bg-muted text-muted-foreground';

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-2xl border border-border/50 bg-background/60 p-4 text-left transition hover:border-primary/60 hover:bg-background',
        disabled && !downloading && 'cursor-not-allowed opacity-60 hover:border-border/50',
        downloading && 'ring-1 ring-primary/40',
      )}
      onClick={onSelect}
      disabled={disabled}
      aria-busy={downloading}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
        <span>{torrent.name}</span>
        {seasonEpisode && (
          <span className="text-xs font-normal text-muted-foreground">{seasonEpisode}</span>
        )}
        {torrent.torrent_status && (
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', statusClass)}>
            {torrent.torrent_status}
          </span>
        )}
        {torrent.freeleech === 'yes' && (
          <span className="rounded-full bg-lime-500 px-2 py-0.5 text-[10px] font-semibold uppercase text-lime-950">
            Freeleech
          </span>
        )}
      </div>

      {torrent.imdb && (
        <div className="mt-1 text-xs text-muted-foreground">
          IMDB: {imdbRating ?? 'N/A'}
          {torrent.imdb.englishtitle && (
            <>
              {' '}
              · {torrent.imdb.englishtitle}
            </>
          )}
          {torrent.imdb.year ? ` (${torrent.imdb.year})` : ''}
          {imdbGenres.length > 0 && ` · ${imdbGenres.join(', ')}`}
        </div>
      )}

      {torrent.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {torrent.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <TvStat label="Time Alive" value={formatTimeAlive(torrent.added, torrent.utadded)} />
        <TvStat label="Size" value={formatSize(torrent.size)} />
        <TvStat
          label="Snatched"
          value={`${torrent.times_completed} time${torrent.times_completed === 1 ? '' : 's'}`}
        />
        <TvStat label="Seeders" value={torrent.seeders} accent />
        <TvStat label="Leechers" value={torrent.leechers} />
        <TvStat label="Comments" value={torrent.comments} />
        <TvStat label="Added" value={formatAddedDate(torrent.added)} />
        <TvStat label="Files" value={torrent.numfiles} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Uploaded by {torrent.username || 'Anonymous'}</span>
        {downloading ? (
          <span className="flex items-center gap-2 text-primary">
            <Spinner className="text-primary" />
            Starting download...
          </span>
        ) : (
          <span>Click to download this release</span>
        )}
      </div>
    </button>
  );
}

export interface SearchPageProps {
  topMovies: MovieSummary[];
  setError: Dispatch<SetStateAction<string>>;
  isEmbeddedApp: boolean;
}

export function SearchPage({ topMovies, setError, isEmbeddedApp }: SearchPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('query') || '';
  const typeParam = searchParams.get('type') === 'tv' ? 'tv' : 'movies';
  const [inputValue, setInputValue] = useState<string>(queryParam);
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [tvResults, setTvResults] = useState<HdbitsTorrentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(Boolean(queryParam));
  const [searchMode, setSearchMode] = useState<SearchMode>(typeParam);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setInputValue(queryParam);
  }, [queryParam]);

  useEffect(() => {
    setSearchMode(typeParam);
  }, [typeParam]);

  useEffect(() => {
    if (!queryParam.trim()) {
      setMovies([]);
      setTvResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMoviesOrShows() {
      setLoading(true);
      setError('');
      if (searchMode === 'movies') {
        setMovies([]);
      } else {
        setTvResults([]);
      }
      try {
        if (searchMode === 'movies') {
          const { movies: list } = await searchMovies(queryParam.trim(), isEmbeddedApp);
          if (!cancelled) {
            const nextMovies = Array.isArray(list) ? list : [];
            rememberMovies(nextMovies);
            setMovies(nextMovies);
            setHasSearched(true);
          }
        } else {
          const response = await searchTvShows(queryParam.trim(), isEmbeddedApp);
          if (!cancelled) {
            const nextShows = Array.isArray(response?.data) ? response.data : [];
            setTvResults(nextShows);
            setHasSearched(true);
          }
        }
      } catch (error: unknown) {
        if (!cancelled) {
          console.error(error);
          setError(toErrorMessage(error));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMoviesOrShows();
    return () => {
      cancelled = true;
    };
  }, [queryParam, searchMode, setError, isEmbeddedApp]);

  const canSearch = inputValue.trim().length > 0;
  const showTopMovies = !loading && !hasSearched && topMovies?.length > 0 && searchMode === 'movies';

  const updateSearchParams = (nextQuery: string, mode: SearchMode, replace = false) => {
    const params = new URLSearchParams();
    if (nextQuery.trim()) {
      params.set('query', nextQuery.trim());
    }
    params.set('type', mode);
    setSearchParams(params, { replace });
  };

  const doSearch = () => {
    if (!canSearch) return;
    setError('');
    updateSearchParams(inputValue.trim(), searchMode);
  };

  const handleModeChange = (mode: SearchMode) => {
    if (mode === searchMode) return;
    setError('');
    const activeQuery = queryParam || inputValue.trim();
    updateSearchParams(activeQuery, mode);
  };

  const handleMovieClick = (movie: MovieSummary) => {
    const params = new URLSearchParams();
    if (movie.title) params.set('title', movie.title);
    const activeQuery = queryParam || inputValue.trim();
    if (activeQuery) params.set('query', activeQuery);
    navigate(`/torrents/${movie.id}?${params.toString()}`);
  };

  const handleTopMovie = async (movie: MovieSummary) => {
    const params = new URLSearchParams();
    if (movie.title) {
      const { movies: list } = await searchMovies(movie.title, isEmbeddedApp);
      const nextMovies = Array.isArray(list) ? list : [];
      rememberMovies(nextMovies);
      params.set('title', movie.title);
      params.set('query', movie.title);
    }
    navigate(`/torrents/${movie.id}?${params.toString()}`);
  };

  const handleShowDownload = async (show: HdbitsTorrentItem) => {
    if (downloadingId) return;
    setError('');
    setDownloadingId(show.id);
    try {
      await downloadTvShow({ torrentId: show.id, title: show.name }, isEmbeddedApp);
      const params = new URLSearchParams();
      params.set('title', show.name);
      navigate(`/download?${params.toString()}`);
    } catch (error: unknown) {
      console.error(error);
      setError(toErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  };

  const widgetPayload = useMemo(() => {
    const route = `${location.pathname}${location.search}`;
    const activeQuery = queryParam.trim() || inputValue.trim();
    const isTvMode = searchMode === 'tv';
    const activeResults = isTvMode ? tvResults : movies;
    let summary = isTvMode ? 'Ready to search for a show.' : 'Ready to search for a movie.';
    if (loading) {
      const noun = isTvMode ? 'show' : 'movie';
      summary = activeQuery
        ? `Searching for a ${noun} matching "${activeQuery}"...`
        : `Scanning the ${isTvMode ? 'TV' : 'movie'} catalog...`;
    } else if (activeResults.length > 0) {
      summary = activeQuery
        ? `Showing ${activeResults.length} result${activeResults.length === 1 ? '' : 's'} for "${activeQuery}".`
        : `Showing ${activeResults.length} result${activeResults.length === 1 ? '' : 's'}.`;
    } else if (showTopMovies) {
      summary = `Showing top ${topMovies.length} movie${topMovies.length === 1 ? '' : 's'} this week.`;
    } else if (hasSearched) {
      summary = activeQuery
        ? `No ${isTvMode ? 'shows' : 'movies'} found for "${activeQuery}".`
        : `No ${isTvMode ? 'shows' : 'movies'} found for the current search.`;
    }

    return {
      currentRoute: route,
      routeName: 'search',
      data: {
        query: queryParam,
        inputValue,
        loading,
        hasSearched,
        showTopMovies,
        movies,
        tvResults,
        topMovies,
        resultsCount: activeResults.length,
        searchMode,
      },
      summary,
    };
  }, [
    location.pathname,
    location.search,
    queryParam,
    inputValue,
    loading,
    hasSearched,
    showTopMovies,
    movies,
    topMovies,
    tvResults,
    searchMode,
  ]);

  useWidgetState(isEmbeddedApp, widgetPayload);

  return (
    <>
      <Card className={cn('mb-6', isEmbeddedApp && 'p-3 mb-1')}>
        {!isEmbeddedApp && (
          <CardHeader>
            <CardTitle>Search the library</CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant={searchMode === 'movies' ? 'default' : 'outline'}
              onClick={() => handleModeChange('movies')}
              size="sm"
            >
              Movies
            </Button>
            <Button
              type="button"
              variant={searchMode === 'tv' ? 'default' : 'outline'}
              onClick={() => handleModeChange('tv')}
              size="sm"
            >
              TV Shows
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder={
                searchMode === 'tv' ? 'Type a TV show title or episode...' : 'Type a movie title...'
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSearch) doSearch();
              }}
            />
            <Button
              className="w-full sm:w-auto"
              onClick={doSearch}
              disabled={!canSearch || loading}
            >
              {loading ? <Spinner /> : searchMode === 'tv' ? 'Search Shows' : 'Search Movies'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          <span>{searchMode === 'tv' ? 'Searching TV catalog...' : 'Scanning the catalog...'}</span>
        </div>
      )}

      {!loading && searchMode === 'movies' && movies.length > 0 && (
        <div>
          <div
            className={cn(
              'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
              isEmbeddedApp && 'grid-cols-1 gap-2',
            )}
          >
            {movies.map((m) => (
              <MovieCard key={m.id} movie={m} onClick={() => handleMovieClick(m)} />
            ))}
          </div>
        </div>
      )}

      {!loading && searchMode === 'tv' && tvResults.length > 0 && (
        <div className="space-y-3">
          {tvResults.map((show) => (
            <TvResultRow
              key={show.id}
              torrent={show}
              disabled={Boolean(downloadingId)}
              downloading={downloadingId === show.id}
              onSelect={() => handleShowDownload(show)}
            />
          ))}
        </div>
      )}

      {!loading && searchMode === 'tv' && hasSearched && tvResults.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No TV results found. Try a different show title.
        </p>
      )}

      {showTopMovies && (
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Top Movies this Week
          </div>
          <div
            className={cn(
              'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
              isEmbeddedApp && 'grid-cols-1 gap-2',
            )}
          >
            {topMovies.map((m) => (
              <MovieCard key={m.id} movie={m} onClick={() => handleTopMovie(m)} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
