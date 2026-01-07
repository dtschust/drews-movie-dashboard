import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/Spinner';
import {
  downloadBtnTorrent,
  downloadTvShow,
  getImdbDetails,
  searchBtnTorrents,
  searchMovies,
  searchTvShows,
} from '@/api';
import { rememberMovies } from '@/lib/movieCache';
import { formatImdbId } from '@/lib/imdb';
import type { BtnTorrentItem, HdbitsTorrentItem, MovieSummary } from '@/types';
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
  { key: 'btn', label: 'BTN' },
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

type TvSourceMode = Extract<SearchMode, 'hdbits' | 'btn'>;

type PendingTorrent =
  | { source: 'hdbits'; torrent: HdbitsTorrentItem }
  | { source: 'btn'; torrent: BtnTorrentItem };

const isTvMode = (mode: SearchMode): mode is TvSourceMode => mode === 'hdbits' || mode === 'btn';

const normalizePosterUrl = (poster?: string | null): string | null => {
  if (!poster) return null;
  const trimmed = poster.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  return trimmed;
};

const formatBtnStatValue = (value?: string): number => {
  if (typeof value !== 'string' || value.trim().length === 0) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getBtnTorrentKey = (torrent: BtnTorrentItem): string => {
  return (
    torrent.TorrentID ??
    torrent.DownloadURL ??
    torrent.ReleaseName ??
    `${torrent.GroupID ?? ''}-${torrent.GroupName ?? ''}`
  );
};

const getPendingTorrentKey = (pending: PendingTorrent): string | number =>
  pending.source === 'hdbits' ? pending.torrent.id : getBtnTorrentKey(pending.torrent);

const getPendingTorrentTitle = (pending: PendingTorrent): string =>
  pending.source === 'hdbits'
    ? pending.torrent.name
    : pending.torrent.ReleaseName ?? pending.torrent.GroupName ?? '';

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

interface BtnResultRowProps {
  torrent: BtnTorrentItem;
  disabled: boolean;
  downloading: boolean;
  onSelect: () => void;
  posterUrl?: string | null;
}

function BtnResultRow({ torrent, disabled, downloading, onSelect, posterUrl }: BtnResultRowProps) {
  const releaseName = torrent.ReleaseName ?? torrent.GroupName ?? 'Unknown release';
  const secondaryLine = [torrent.Series, torrent.GroupName].filter(Boolean).join(' · ');
  const qualityDetails = [torrent.Resolution, torrent.Source, torrent.Codec, torrent.Container]
    .map((detail) => detail?.trim())
    .filter((detail): detail is string => Boolean(detail))
    .join(' · ');
  const snatchedCount = formatBtnStatValue(torrent.Snatched);
  const seeders = formatBtnStatValue(torrent.Seeders);
  const leechers = formatBtnStatValue(torrent.Leechers);
  const sizeBytes = Number(torrent.Size);
  const timeSeconds = formatBtnStatValue(torrent.Time);
  const addedIso = timeSeconds ? new Date(timeSeconds * 1000).toISOString() : '';
  const artworkUrl = posterUrl ?? normalizePosterUrl(torrent.SeriesPoster);
  const tags = Array.isArray(torrent.Tags) ? torrent.Tags : [];
  const genres = Array.isArray(torrent.Genres) ? torrent.Genres : [];

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
        {artworkUrl && (
          <div className="w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted sm:w-28">
            <img src={artworkUrl} alt={`${releaseName} poster`} loading="lazy" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            <span>{releaseName}</span>
            {torrent.Category && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                {torrent.Category}
              </span>
            )}
            {torrent.Origin && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                {torrent.Origin}
              </span>
            )}
          </div>

          {secondaryLine && (
            <div className="mt-1 text-xs text-muted-foreground">{secondaryLine}</div>
          )}

          {qualityDetails && (
            <div className="mt-2 text-xs text-muted-foreground">{qualityDetails}</div>
          )}

          {(tags.length > 0 || genres.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[...tags, ...genres].map((tag) => (
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
            <TvStat label="Time Alive" value={formatTimeAlive(addedIso, timeSeconds)} />
            <TvStat label="Size" value={formatSize(sizeBytes)} />
            <TvStat
              label="Snatched"
              value={`${snatchedCount} time${snatchedCount === 1 ? '' : 's'}`}
            />
            <TvStat label="Seeders" value={seeders} accent />
            <TvStat label="Leechers" value={leechers} />
            <TvStat label="TVDB" value={torrent.TvdbID ?? 'Unknown'} />
            <TvStat label="IMDB" value={torrent.ImdbID ? formatImdbId(torrent.ImdbID) : 'Unknown'} />
            <TvStat
              label="Added"
              value={addedIso ? formatAddedDate(addedIso) : formatAddedDate('')}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{torrent.Series ? `From ${torrent.Series}` : 'BTN release'}</span>
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

function PendingHdbitsDetails({ torrent }: { torrent: HdbitsTorrentItem }) {
  return (
    <>
      <div>
        <div className="text-sm font-semibold text-foreground">{torrent.name}</div>
        {torrent.imdb && (
          <div className="text-xs text-muted-foreground">
            IMDB:{' '}
            {typeof torrent.imdb.rating === 'number' ? torrent.imdb.rating.toFixed(1) : 'N/A'}
            {torrent.imdb.year ? ` (${torrent.imdb.year})` : ''}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TvStat label="Size" value={formatSize(torrent.size)} />
        <TvStat label="Seeders" value={torrent.seeders} accent />
        <TvStat
          label="Snatched"
          value={`${torrent.times_completed} time${torrent.times_completed === 1 ? '' : 's'}`}
        />
        <TvStat label="Added" value={formatAddedDate(torrent.added)} />
      </div>
    </>
  );
}

function PendingBtnDetails({ torrent }: { torrent: BtnTorrentItem }) {
  const title = torrent.ReleaseName ?? torrent.GroupName ?? 'BTN Torrent';
  const subtitle = [torrent.Series, torrent.GroupName].filter(Boolean).join(' · ');
  const snatchedCount = formatBtnStatValue(torrent.Snatched);
  const timeSeconds = formatBtnStatValue(torrent.Time);
  const addedIso = timeSeconds ? new Date(timeSeconds * 1000).toISOString() : '';
  return (
    <>
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TvStat label="Size" value={formatSize(Number(torrent.Size))} />
        <TvStat label="Seeders" value={formatBtnStatValue(torrent.Seeders)} accent />
        <TvStat
          label="Snatched"
          value={`${snatchedCount} time${snatchedCount === 1 ? '' : 's'}`}
        />
        <TvStat
          label="Added"
          value={addedIso ? formatAddedDate(addedIso) : formatAddedDate('')}
        />
      </div>
    </>
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
  const [btnResults, setBtnResults] = useState<BtnTorrentItem[]>([]);
  const [posterCache, setPosterCache] = useState<Record<string, PosterCacheEntry>>({});
  const [posterFetchThreshold, setPosterFetchThreshold] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(Boolean(queryParam));
  const [searchMode, setSearchMode] = useState<SearchMode>(typeParam);
  const [downloadingKey, setDownloadingKey] = useState<string | number | null>(null);
  const [pendingTorrent, setPendingTorrent] = useState<PendingTorrent | null>(null);
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
    if (!isTvMode(searchMode)) {
      setPosterFetchThreshold(0);
      return;
    }
    const activeResults = searchMode === 'hdbits' ? hdbitsResults : btnResults;
    if (activeResults.length === 0) {
      setPosterFetchThreshold(0);
      return;
    }
    setPosterFetchThreshold(Math.min(POSTER_BATCH_SIZE, activeResults.length));
  }, [btnResults, hdbitsResults, searchMode]);

  useEffect(() => {
    if (!isTvMode(searchMode)) return;
    if (posterFetchThreshold <= 0) return;
    const baseResults = searchMode === 'hdbits' ? hdbitsResults : btnResults;
    if (baseResults.length === 0) return;
    const eligibleResults = baseResults.slice(0, posterFetchThreshold);
    const candidateIds =
      searchMode === 'hdbits'
        ? eligibleResults.map((torrent) => formatImdbId(torrent.imdb?.id))
        : eligibleResults.map((torrent) => formatImdbId(torrent.ImdbID));
    const filteredIds = candidateIds.filter((id): id is string => Boolean(id));
    if (filteredIds.length === 0) return;
    const uniqueIds = Array.from(new Set(filteredIds));
    const toFetch = uniqueIds.filter((id) => {
      if (pendingPosterIds.current.has(id)) return false;
      const entry = posterCache[id];
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
            setPosterCache((prev) => {
              if (prev[imdbId]?.status === 'success') return prev;
              return {
                ...prev,
                [imdbId]: { posterUrl: poster, status: 'success' },
              };
            });
          } catch (error) {
            console.warn('Failed to load IMDb details for torrent', imdbId, error);
            if (cancelled) return;
            setPosterCache((prev) => {
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
  }, [btnResults, hdbitsResults, posterCache, posterFetchThreshold, searchMode]);

  useEffect(() => {
    if (!queryParam.trim()) {
      setMovies([]);
      setHdbitsResults([]);
      setBtnResults([]);
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
      } else if (searchMode === 'hdbits') {
        setHdbitsResults([]);
      } else {
        setBtnResults([]);
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
        } else if (searchMode === 'hdbits') {
          const response = await searchTvShows(queryParam.trim(), isEmbeddedApp);
          if (!cancelled) {
            const nextShows = Array.isArray(response?.data) ? response.data : [];
            setHdbitsResults(nextShows);
            setHasSearched(true);
          }
        } else {
          const response = await searchBtnTorrents(queryParam.trim());
          if (!cancelled) {
            const torrentMap = response?.result?.torrents;
            const nextShows = torrentMap ? Object.values(torrentMap) : [];
            setBtnResults(nextShows);
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
    if (!isTvMode(searchMode)) return;
    setPosterFetchThreshold((prev) => {
      const activeResults = searchMode === 'hdbits' ? hdbitsResults : btnResults;
      if (activeResults.length === 0) return prev;
      if (prev >= activeResults.length) return prev;
      return Math.min(prev + POSTER_BATCH_SIZE, activeResults.length);
    });
  }, [btnResults, hdbitsResults, searchMode]);

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
    if (downloadingKey) return;
    setPendingTorrent({ source: 'hdbits', torrent });
    setConfirmOpen(true);
  };

  const handleBtnTorrentClick = (torrent: BtnTorrentItem) => {
    if (downloadingKey) return;
    setPendingTorrent({ source: 'btn', torrent });
    setConfirmOpen(true);
  };

  const closeDialog = () => {
    if (downloadingKey) return;
    setConfirmOpen(false);
    setPendingTorrent(null);
  };

  const startTorrentDownload = async () => {
    if (!pendingTorrent || downloadingKey) return;
    setError('');
    let downloadTitle = '';
    try {
      if (pendingTorrent.source === 'hdbits') {
        const { torrent } = pendingTorrent;
        setDownloadingKey(torrent.id);
        downloadTitle = torrent.name;
        await downloadTvShow({ torrentId: torrent.id, title: torrent.name }, isEmbeddedApp);
      } else {
        const { torrent } = pendingTorrent;
        if (!torrent.DownloadURL || !torrent.ReleaseName) {
          throw new Error('Missing BTN download details');
        }
        setDownloadingKey(getBtnTorrentKey(torrent));
        downloadTitle = torrent.ReleaseName;
        await downloadBtnTorrent({ downloadUrl: torrent.DownloadURL, title: torrent.ReleaseName });
      }
      setConfirmOpen(false);
      const params = new URLSearchParams();
      const pendingTitle = downloadTitle || getPendingTorrentTitle(pendingTorrent);
      if (pendingTitle) {
        params.set('title', pendingTitle);
      }
      navigate(`/download?${params.toString()}`);
    } catch (error: unknown) {
      console.error(error);
      setError(toErrorMessage(error));
    } finally {
      setPendingTorrent(null);
      setDownloadingKey(null);
    }
  };

  const widgetPayload = useMemo(() => {
    const route = `${location.pathname}${location.search}`;
    const activeQuery = queryParam.trim() || inputValue.trim();
    const activeResults =
      searchMode === 'hdbits'
        ? hdbitsResults
        : searchMode === 'btn'
          ? btnResults
          : movies;
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
    btnResults,
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
            const posterEntry = imdbKey ? posterCache[imdbKey] : undefined;
            const posterUrl = posterEntry?.posterUrl ?? null;
            return (
              <Fragment key={`${torrent.id}-${index}`}>
                {showTrigger && <PosterBatchObserver onLoadNext={requestMorePosters} />}
                <TvResultRow
                  torrent={torrent}
                  disabled={Boolean(downloadingKey)}
                  downloading={downloadingKey === torrent.id}
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

      {!loading && searchMode === 'btn' && btnResults.length > 0 && (
        <div className="space-y-3">
          {btnResults.map((torrent, index) => {
            const showTrigger =
              posterFetchThreshold >= POSTER_BATCH_SIZE &&
              posterFetchThreshold < btnResults.length &&
              index === posterFetchThreshold;
            const imdbKey = formatImdbId(torrent.ImdbID);
            const posterEntry = imdbKey ? posterCache[imdbKey] : undefined;
            const posterUrl = posterEntry?.posterUrl ?? null;
            const rowKey = getBtnTorrentKey(torrent);
            return (
              <Fragment key={`${rowKey}-${index}`}>
                {showTrigger && <PosterBatchObserver onLoadNext={requestMorePosters} />}
                <BtnResultRow
                  torrent={torrent}
                  disabled={Boolean(downloadingKey)}
                  downloading={downloadingKey === rowKey}
                  onSelect={() => handleBtnTorrentClick(torrent)}
                  posterUrl={posterUrl}
                />
              </Fragment>
            );
          })}
        </div>
      )}

      {!loading && searchMode === 'btn' && hasSearched && btnResults.length === 0 && (
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
                ? `We'll send "${getPendingTorrentTitle(pendingTorrent)}" to your downloader right away.`
                : 'Confirm this torrent request.'}
            </DialogDescription>
          </DialogHeader>

          {pendingTorrent && (
            <div className="space-y-3">
              {pendingTorrent.source === 'hdbits' ? (
                <PendingHdbitsDetails torrent={pendingTorrent.torrent} />
              ) : (
                <PendingBtnDetails torrent={pendingTorrent.torrent} />
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDialog} disabled={Boolean(downloadingKey)}>
              Cancel
            </Button>
            <Button onClick={startTorrentDownload} disabled={!pendingTorrent || Boolean(downloadingKey)}>
              {pendingTorrent && downloadingKey === getPendingTorrentKey(pendingTorrent) ? (
                <Spinner />
              ) : (
                'Start download'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
