import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/Spinner';
import { downloadTvShow, getImdbDetails, searchMovies, searchTvShows } from '@/api';
import { rememberMovies } from '@/lib/movieCache';
import { formatImdbId } from '@/lib/imdb';
import type { HdbitsTorrentItem, MovieSummary } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import { toErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useEmbeddedAppContext } from '@/context/EmbeddedAppContext';
import { useWidgetState } from '@/lib/useWidgetState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
            alt={movie.title ?? 'Torrent poster'}
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

const SOURCE_OPTIONS = [
  { key: 'ptp', label: 'PTP' },
  { key: 'hdbits', label: 'HDBits' },
] as const;

type SearchMode = (typeof SOURCE_OPTIONS)[number]['key'];

const DEFAULT_MODE: SearchMode = SOURCE_OPTIONS[0].key;

const isValidMode = (value: string | null | undefined): value is SearchMode =>
  SOURCE_OPTIONS.some((source) => source.key === value);

const SOURCE_LABELS = SOURCE_OPTIONS.reduce(
  (acc, source) => {
    acc[source.key] = source.label;
    return acc;
  },
  {} as Record<SearchMode, string>,
);

const POSTER_BATCH_SIZE = 5;

interface PosterCacheEntry {
  posterUrl: string | null;
  status: 'success' | 'error';
}

const getImageUrl = (source: unknown): string => {
  if (!source) return '';
  if (typeof source === 'string') return source.trim();
  if (typeof source === 'object') {
    const record = source as Record<string, unknown>;
    const candidates = [
      record.url,
      record.src,
      record.href,
      record.imageUrl,
      record.link,
      record.value,
      record.path,
      record.poster,
    ];
    const found = candidates.find((candidate): candidate is string => typeof candidate === 'string');
    if (found) {
      return found.trim();
    }
  }
  return '';
};

const extractPosterFromImdb = (details: unknown): string => {
  if (!details || typeof details !== 'object') return '';
  const record = details as Record<string, unknown>;
  const directSources = [
    record.primaryImage,
    record.image,
    record.poster,
    record.primaryPoster,
    record.primaryimage,
  ];
  for (const source of directSources) {
    const candidate = getImageUrl(source);
    if (candidate) return candidate;
  }
  const collections = [record.results, record.images, record.items];
  for (const collection of collections) {
    if (Array.isArray(collection)) {
      for (const entry of collection) {
        const candidate =
          getImageUrl((entry as Record<string, unknown>)?.primaryImage) || getImageUrl(entry);
        if (candidate) return candidate;
      }
    }
  }
  if (typeof record.data === 'object' && record.data !== null) {
    return extractPosterFromImdb(record.data);
  }
  return '';
};

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
  posterUrl?: string | null;
}

function TvResultRow({ torrent, disabled, downloading, onSelect, posterUrl }: TvResultRowProps) {
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
      <div className="flex flex-col gap-4 sm:flex-row">
        {posterUrl && (
          <div className="w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted sm:w-28">
            <img
              src={posterUrl}
              alt={`${torrent.name} poster`}
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1">
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
              <span>Click to download this torrent</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

interface PosterBatchObserverProps {
  onLoadNext: () => void;
}

function PosterBatchObserver({ onLoadNext }: PosterBatchObserverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const triggeredRef = useRef<boolean>(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || triggeredRef.current) return;
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !triggeredRef.current) {
          triggeredRef.current = true;
          obs.disconnect();
          onLoadNext();
        }
      });
    }, { rootMargin: '200px 0px' });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [onLoadNext]);

  return <div ref={ref} aria-hidden className="h-1 w-full opacity-0" />;
}

export interface SearchPageProps {
  topMovies: MovieSummary[];
  setError: Dispatch<SetStateAction<string>>;
  isEmbeddedApp: boolean;
}

export function SearchPage({ topMovies, setError, isEmbeddedApp }: SearchPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('query') || '';
  const typeParamRaw = searchParams.get('type');
  const typeParam = isValidMode(typeParamRaw) ? typeParamRaw : DEFAULT_MODE;
  const [inputValue, setInputValue] = useState<string>(queryParam);
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [hdbitsResults, setHdbitsResults] = useState<HdbitsTorrentItem[]>([]);
  const [hdbitsPosters, setHdbitsPosters] = useState<Record<string, PosterCacheEntry>>({});
  const [posterFetchThreshold, setPosterFetchThreshold] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(Boolean(queryParam));
  const [searchMode, setSearchMode] = useState<SearchMode>(typeParam);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [pendingTorrent, setPendingTorrent] = useState<HdbitsTorrentItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const location = useLocation();
  const sourceLabel = SOURCE_LABELS[searchMode];
  const pendingPosterIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setInputValue(queryParam);
  }, [queryParam]);

  useEffect(() => {
    setSearchMode(typeParam);
  }, [typeParam]);

  useEffect(() => {
    if (hdbitsResults.length === 0) {
      setPosterFetchThreshold(0);
      return;
    }
    setPosterFetchThreshold(Math.min(POSTER_BATCH_SIZE, hdbitsResults.length));
  }, [hdbitsResults]);

  useEffect(() => {
    if (searchMode !== 'hdbits') return;
    if (posterFetchThreshold <= 0) return;
    const eligibleResults = hdbitsResults.slice(0, posterFetchThreshold);
    const candidateIds = eligibleResults
      .map((torrent) => formatImdbId(torrent.imdb?.id))
      .filter((id): id is string => Boolean(id));
    if (candidateIds.length === 0) return;
    const uniqueIds = Array.from(new Set(candidateIds));
    const toFetch = uniqueIds.filter((id) => {
      if (pendingPosterIds.current.has(id)) return false;
      const entry = hdbitsPosters[id];
      if (entry?.status === 'success') return false;
      if (entry?.status === 'error') return false;
      return true;
    });
    if (toFetch.length === 0) return;

    const batch = toFetch.slice(0, POSTER_BATCH_SIZE);
    batch.forEach((id) => pendingPosterIds.current.add(id));
    let cancelled = false;

    const fetchBatch = async () => {
      await Promise.all(
        batch.map(async (imdbId) => {
          try {
            const details = await getImdbDetails(imdbId);
            if (cancelled) return;
            const poster = extractPosterFromImdb(details) || null;
            setHdbitsPosters((prev) => {
              if (prev[imdbId]?.status === 'success') return prev;
              return {
                ...prev,
                [imdbId]: { posterUrl: poster, status: 'success' },
              };
            });
          } catch (error) {
            console.warn('Failed to load IMDb details for torrent', imdbId, error);
            if (cancelled) return;
            setHdbitsPosters((prev) => {
              if (prev[imdbId]?.status === 'error') return prev;
              return {
                ...prev,
                [imdbId]: { posterUrl: null, status: 'error' },
              };
            });
          } finally {
            pendingPosterIds.current.delete(imdbId);
          }
        }),
      );
    };

    fetchBatch();

    return () => {
      cancelled = true;
      batch.forEach((id) => pendingPosterIds.current.delete(id));
    };
  }, [hdbitsResults, hdbitsPosters, posterFetchThreshold, searchMode]);

  useEffect(() => {
    if (!queryParam.trim()) {
      setMovies([]);
      setHdbitsResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMoviesOrShows() {
      setLoading(true);
      setError('');
      if (searchMode === 'ptp') {
        setMovies([]);
      } else {
        setHdbitsResults([]);
      }
      try {
        if (searchMode === 'ptp') {
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
            setHdbitsResults(nextShows);
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

  const requestMorePosters = useCallback(() => {
    setPosterFetchThreshold((prev) => {
      if (hdbitsResults.length === 0) return prev;
      if (prev >= hdbitsResults.length) return prev;
      return Math.min(prev + POSTER_BATCH_SIZE, hdbitsResults.length);
    });
  }, [hdbitsResults.length]);

  const canSearch = inputValue.trim().length > 0;
  const showTopTorrents =
    !loading && !hasSearched && topMovies?.length > 0 && searchMode === 'ptp';

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

  const handleTorrentClick = (torrent: HdbitsTorrentItem) => {
    if (downloadingId) return;
    setPendingTorrent(torrent);
    setConfirmOpen(true);
  };

  const closeDialog = () => {
    if (downloadingId) return;
    setConfirmOpen(false);
    setPendingTorrent(null);
  };

  const startTorrentDownload = async () => {
    if (!pendingTorrent || downloadingId) return;
    setError('');
    setDownloadingId(pendingTorrent.id);
    try {
      await downloadTvShow({ torrentId: pendingTorrent.id, title: pendingTorrent.name }, isEmbeddedApp);
      setConfirmOpen(false);
      const params = new URLSearchParams();
      params.set('title', pendingTorrent.name);
      navigate(`/download?${params.toString()}`);
    } catch (error: unknown) {
      console.error(error);
      setError(toErrorMessage(error));
    } finally {
      setPendingTorrent(null);
      setDownloadingId(null);
    }
  };

  const widgetPayload = useMemo(() => {
    const route = `${location.pathname}${location.search}`;
    const activeQuery = queryParam.trim() || inputValue.trim();
    const isHdbitsMode = searchMode === 'hdbits';
    const activeResults = isHdbitsMode ? hdbitsResults : movies;
    const sourceName = SOURCE_LABELS[searchMode];
    const nounSingular = 'Torrent';
    const nounPlural = 'Torrents';
    const resultLabel = activeResults.length === 1 ? nounSingular : nounPlural;
    let summary = `Ready to search ${sourceName} ${nounPlural}.`;
    if (loading) {
      summary = activeQuery
        ? `Searching for ${nounPlural} matching "${activeQuery}" on ${sourceName}...`
        : `Scanning the ${sourceName} catalog for ${nounPlural}...`;
    } else if (activeResults.length > 0) {
      summary = activeQuery
        ? `Showing ${activeResults.length} ${resultLabel} for "${activeQuery}" from ${sourceName}.`
        : `Showing ${activeResults.length} ${resultLabel} from ${sourceName}.`;
    } else if (showTopTorrents) {
      const topLabel = topMovies.length === 1 ? nounSingular : nounPlural;
      summary = `Showing top ${topMovies.length} ${topLabel} this week.`;
    } else if (hasSearched) {
      const target = activeQuery ? `"${activeQuery}"` : 'the current search';
      summary = `No ${nounPlural} found for ${target} on ${sourceName}.`;
    }

    return {
      currentRoute: route,
      routeName: 'search',
      data: {
        query: queryParam,
        inputValue,
        loading,
        hasSearched,
        showTopTorrents,
        movies,
        hdbitsResults,
        topMovies,
        resultsCount: activeResults.length,
        searchMode,
        sourceLabel: sourceName,
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
    showTopTorrents,
    movies,
    topMovies,
    hdbitsResults,
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
            {SOURCE_OPTIONS.map((source) => (
              <Button
                key={source.key}
                type="button"
                variant={searchMode === source.key ? 'default' : 'outline'}
                onClick={() => handleModeChange(source.key)}
                size="sm"
              >
                {source.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="Type a torrent title or keyword..."
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
              {loading ? <Spinner /> : 'Search Torrents'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          <span>{`Searching ${sourceLabel} Torrents...`}</span>
        </div>
      )}

      {!loading && searchMode === 'ptp' && movies.length > 0 && (
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

      {!loading && searchMode === 'hdbits' && hdbitsResults.length > 0 && (
        <div className="space-y-3">
          {hdbitsResults.map((torrent, index) => {
            const showTrigger =
              posterFetchThreshold >= POSTER_BATCH_SIZE &&
              posterFetchThreshold < hdbitsResults.length &&
              index === posterFetchThreshold;
            const imdbKey = formatImdbId(torrent.imdb?.id);
            const posterEntry = imdbKey ? hdbitsPosters[imdbKey] : undefined;
            const posterUrl = posterEntry?.posterUrl ?? null;
            return (
              <Fragment key={`${torrent.id}-${index}`}>
                {showTrigger && <PosterBatchObserver onLoadNext={requestMorePosters} />}
                <TvResultRow
                  torrent={torrent}
                  disabled={Boolean(downloadingId)}
                  downloading={downloadingId === torrent.id}
                  onSelect={() => handleTorrentClick(torrent)}
                  posterUrl={posterUrl}
                />
              </Fragment>
            );
          })}
        </div>
      )}

      {!loading && searchMode === 'hdbits' && hasSearched && hdbitsResults.length === 0 && (
        <p className="text-sm text-muted-foreground">{`No ${sourceLabel} Torrents found. Try a different search.`}</p>
      )}

      {showTopTorrents && (
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Top Torrents this Week
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

      <Dialog
        open={confirmOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeDialog();
          } else {
            setConfirmOpen(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start download?</DialogTitle>
            <DialogDescription>
              {pendingTorrent
                ? `We'll send "${pendingTorrent.name}" to your downloader right away.`
                : 'Confirm this torrent request.'}
            </DialogDescription>
          </DialogHeader>

          {pendingTorrent && (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-foreground">{pendingTorrent.name}</div>
                {pendingTorrent.imdb && (
                  <div className="text-xs text-muted-foreground">
                    IMDB: {typeof pendingTorrent.imdb.rating === 'number' ? pendingTorrent.imdb.rating.toFixed(1) : 'N/A'}
                    {pendingTorrent.imdb.year ? ` (${pendingTorrent.imdb.year})` : ''}
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TvStat label="Size" value={formatSize(pendingTorrent.size)} />
                <TvStat label="Seeders" value={pendingTorrent.seeders} accent />
                <TvStat
                  label="Snatched"
                  value={`${pendingTorrent.times_completed} time${pendingTorrent.times_completed === 1 ? '' : 's'}`}
                />
                <TvStat label="Added" value={formatAddedDate(pendingTorrent.added)} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDialog} disabled={Boolean(downloadingId)}>
              Cancel
            </Button>
            <Button onClick={startTorrentDownload} disabled={!pendingTorrent || Boolean(downloadingId)}>
              {pendingTorrent && downloadingId === pendingTorrent.id ? <Spinner /> : 'Start download'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
