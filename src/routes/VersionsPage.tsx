import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/Spinner';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { downloadMovie, getImdbDetails, getVersions } from '@/api';
import { movieCache } from '@/lib/movieCache';
import { toErrorMessage } from '@/lib/errors';
import type { MovieCacheEntry, MovieCredits, MoviePerson, MovieVersion } from '@/types';
import { useEmbeddedAppContext } from '@/context/EmbeddedAppContext';
import { cn } from '@/lib/utils';
import { useWidgetState } from '@/lib/useWidgetState';

const createEmptyCredits = (): MovieCredits => ({
  writers: [],
  directors: [],
  stars: [],
});

const formatSizeGb = (value: MovieVersion['sizeGB']): string => {
  if (value == null) return '';
  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'toFixed' in value && typeof value.toFixed === 'function') {
    return value.toFixed(2);
  }
  return String(value);
};

interface VersionRowProps {
  version: MovieVersion;
  onSelect: () => void;
}

function VersionRow({ version, onSelect }: VersionRowProps) {
  const { isEmbeddedApp } = useEmbeddedAppContext();
  const line1 = `\n${version.quality} / ${version.codec} / ${version.container} / ${version.source} /\n${version.resolution}${version.scene ? ' / Scene' : ''}${version.remasterTitle ? ` / ${version.remasterTitle}` : ''}`;
  const sizeLabel = formatSizeGb(version.sizeGB) || 'Unknown';

  return (
    <button
      type="button"
      className={cn(
        'w-full rounded-lg border border-border bg-card/70 p-4 text-left transition hover:border-primary/60 hover:bg-card',
        isEmbeddedApp && 'p-2',
      )}
      onClick={onSelect}
    >
      <div className="text-sm font-medium text-foreground">{line1}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{version.goldenPopcorn ? '🍿' : version.checked ? '✅' : '🎞️'}</span>
        <span>Seeders: {version.seeders}</span>
        <span>Snatched: {version.snatched}</span>
        <span>Size: {sizeLabel} GB</span>
      </div>
    </button>
  );
}

export interface VersionsPageProps {
  setError: Dispatch<SetStateAction<string>>;
}

export function VersionsPage({ setError }: VersionsPageProps) {
  const params = useParams<{ movieId: string }>();
  const movieId = params.movieId ?? '';
  const [searchParams] = useSearchParams();
  const titleParam = searchParams.get('title') || '';
  const { isEmbeddedApp } = useEmbeddedAppContext();
  const [movieTitle, setMovieTitle] = useState<string>(titleParam);
  const [versions, setVersions] = useState<MovieVersion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [pendingVersion, setPendingVersion] = useState<MovieVersion | null>(null);
  const [synopsis, setSynopsis] = useState<string>('');
  const [credits, setCredits] = useState<MovieCredits>(() => createEmptyCredits());
  const [imdbLoading, setImdbLoading] = useState<boolean>(false);
  const [runtime, setRuntime] = useState<string>('');
  const [creditsOpen, setCreditsOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const location = useLocation();

  const cachedMovie: MovieCacheEntry | undefined = movieCache.get(String(movieId));
  const titleForDisplay = movieTitle || cachedMovie?.title || `Movie ${movieId}`;

  useEffect(() => {
    setMovieTitle(titleParam);
  }, [titleParam]);

  useEffect(() => {
    setCreditsOpen(false);
  }, [movieId]);

  useEffect(() => {
    if (cachedMovie) {
      setSynopsis(cachedMovie.synopsis || '');
      setCredits(cachedMovie.credits ?? createEmptyCredits());
      setRuntime(cachedMovie.runtime ?? '');
      setImdbLoading(false);
      return;
    }
    setSynopsis('');
    setCredits(createEmptyCredits());
    setRuntime('');
    setImdbLoading(false);
  }, [cachedMovie, movieId]);

  useEffect(() => {
    if (!cachedMovie) return;
    const imdbIdRaw = cachedMovie.imdbId;
    if (!imdbIdRaw) return;
    const imdbId = String(imdbIdRaw);

    const cachedSynopsis = cachedMovie.synopsis;
    const cachedCredits = cachedMovie.credits ?? createEmptyCredits();
    const hasCachedCredits = Object.values(cachedCredits).some(
      (list) => Array.isArray(list) && list.length > 0,
    );

    if (cachedMovie.imdbDetailsFetched && (cachedSynopsis || hasCachedCredits)) {
      return;
    }

    let cancelled = false;

    const isNonEmptyString = (value: unknown): value is string =>
      typeof value === 'string' && value.trim().length > 0;

    const toSynopsisString = (value: unknown): string => {
      if (!value) return '';
      if (typeof value === 'string') return value.trim();
      if (Array.isArray(value)) {
        return value.map((entry) => toSynopsisString(entry)).find(Boolean) || '';
      }
      if (typeof value === 'object' && value !== null) {
        const record = value as Record<string, unknown>;
        const candidates = [record.text, record.synopsis, record.summary, record.plot];
        const found = candidates
          .filter((candidate): candidate is string => isNonEmptyString(candidate))
          .map((candidate) => candidate.trim())
          .find(Boolean);
        return found || '';
      }
      return '';
    };

    const toRuntimeString = (value: unknown): string => {
      if (value == null) return '';
      if (typeof value === 'number' && Number.isFinite(value)) {
        const totalSeconds = Math.max(0, Math.round(value));
        const totalMinutes = Math.floor(totalSeconds / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
        if (hours > 0) return `${hours}h`;
        if (minutes > 0) return `${minutes}m`;
        return '0m';
      }
      if (typeof value === 'string') {
        return value.trim();
      }
      return '';
    };

    const getImageUrl = (source: unknown): string => {
      if (!source) return '';
      if (typeof source === 'string') return source.trim();
      if (typeof source === 'object' && source !== null) {
        const record = source as Record<string, unknown>;
        const candidates = [
          record.url,
          record.src,
          record.href,
          record.imageUrl,
          record.value,
          record.link,
          record.path,
        ];
        const found = candidates.find((value): value is string => isNonEmptyString(value));
        if (found) {
          return found.trim();
        }
      }
      return '';
    };

    const normalizePerson = (entry: unknown): MoviePerson | null => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return null;
        return { id: text, name: text, image: '' };
      }
      if (typeof entry === 'object' && entry !== null) {
        const record = entry as Record<string, unknown>;
        const nameCandidate = [
          record.name,
          record.title,
          record.fullName,
          record.originalName,
          record.displayName,
          record.role,
          record.character,
        ]
          .filter((value): value is string => isNonEmptyString(value))
          .map((value) => value.trim())
          .find(Boolean);
        if (!nameCandidate) return null;
        const idCandidate =
          [
            record.id,
            record.imdbId,
            record.imdb_id,
            record.nconst,
            record.personId,
            record.const,
          ].find((value) => isNonEmptyString(value)) ?? nameCandidate;
        const imageCandidate =
          getImageUrl(record.image) ||
          getImageUrl(record.photo) ||
          getImageUrl(record.thumbnail) ||
          getImageUrl(record.avatar) ||
          getImageUrl(record.headshot) ||
          getImageUrl(record.primaryImage) ||
          getImageUrl(record.profileImage) ||
          getImageUrl(record.poster);
        return {
          id: String(idCandidate),
          name: nameCandidate,
          image: imageCandidate,
        };
      }
      return null;
    };

    const toPeopleArray = (value: unknown): MoviePerson[] => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value
          .map((item) => normalizePerson(item))
          .filter((person): person is MoviePerson => Boolean(person));
      }
      if (typeof value === 'object' && value !== null) {
        const record = value as Record<string, unknown>;
        const nestedSources = [
          record.items,
          record.list,
          record.values,
          record.results,
          record.people,
        ];
        for (const source of nestedSources) {
          if (Array.isArray(source)) {
            return toPeopleArray(source);
          }
        }
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

    const mergePeople = (...sources: unknown[]): MoviePerson[] => {
      const seen = new Map<string, MoviePerson>();
      sources.forEach((source) => {
        toPeopleArray(source).forEach((person) => {
          const key = person.id != null ? String(person.id) : (person.name ?? '');
          if (!key || seen.has(key)) return;
          seen.set(key, person);
        });
      });
      return Array.from(seen.values());
    };

    async function fetchImdbDetails() {
      setImdbLoading(true);
      try {
        const data = await getImdbDetails(imdbId);
        if (cancelled) return;

        const synopsisCandidates = [data?.synopsis, data?.plot, data?.plotSummary, data?.short];
        const nextSynopsis =
          synopsisCandidates
            .map((entry) => toSynopsisString(entry))
            .find((entry) => Boolean(entry)) || '';

        const runtimeCandidates = [data?.runtimeSeconds];
        const nextRuntime =
          runtimeCandidates
            .map((entry) => toRuntimeString(entry))
            .find((entry) => Boolean(entry)) || '';

        const nextCredits: MovieCredits = {
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
        const mergedCredits: MovieCredits = {
          writers: nextCredits.writers.length ? nextCredits.writers : (cachedCredits.writers ?? []),
          directors: nextCredits.directors.length
            ? nextCredits.directors
            : (cachedCredits.directors ?? []),
          stars: nextCredits.stars.length ? nextCredits.stars : (cachedCredits.stars ?? []),
        };

        if (cleanSynopsis || cachedSynopsis) {
          setSynopsis(cleanSynopsis || cachedSynopsis || '');
        }

        setCredits(mergedCredits);
        setRuntime(nextRuntime || cachedMovie.runtime || '');

        const existing: MovieCacheEntry = movieCache.get(String(movieId)) ?? {};
        const nextEntry: MovieCacheEntry = {
          ...existing,
          imdbId: existing.imdbId ?? imdbId,
          runtime: nextRuntime || existing.runtime || cachedMovie.runtime || '',
          synopsis: cleanSynopsis || existing.synopsis || cachedSynopsis || '',
          credits: mergedCredits,
          imdbDetailsFetched: true,
        };
        movieCache.set(String(movieId), nextEntry);
      } catch (error: unknown) {
        console.error('Failed to load IMDb details', error);
      } finally {
        if (!cancelled) setImdbLoading(false);
      }
    }

    fetchImdbDetails();

    return () => {
      cancelled = true;
    };
  }, [cachedMovie, movieId]);

  useEffect(() => {
    let cancelled = false;

    async function fetchVersions() {
      setLoading(true);
      setError('');
      try {
        const { versions: list } = await getVersions(movieId, titleParam, isEmbeddedApp);
        if (!cancelled) {
          const nextVersions = Array.isArray(list) ? list : [];
          setVersions(nextVersions);
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

    fetchVersions();
    return () => {
      cancelled = true;
    };
  }, [movieId, titleParam, setError, isEmbeddedApp]);

  const requestDownload = (version: MovieVersion) => {
    setPendingVersion(version);
  };

  const confirmDownload = async () => {
    if (!pendingVersion) return;
    setIsSubmitting(true);
    setError('');
    try {
      await downloadMovie(
        { torrentId: pendingVersion.id, movieTitle: titleForDisplay },
        isEmbeddedApp,
      );
      setPendingVersion(null);
      const params = new URLSearchParams();
      params.set('movieId', movieId);
      if (movieTitle) {
        params.set('title', movieTitle);
      } else if (cachedMovie?.title) {
        params.set('title', cachedMovie.title);
      }
      navigate(`/download?${params.toString()}`);
    } catch (error: unknown) {
      console.error(error);
      setError(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasCredits = Boolean(
    (credits.directors && credits.directors.length) ||
      (credits.writers && credits.writers.length) ||
      (credits.stars && credits.stars.length),
  );

  const renderPeopleGroup = (label: string, people: MoviePerson[]): ReactNode => {
    if (!Array.isArray(people) || people.length === 0) return null;
    return (
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <ul className="flex flex-wrap gap-3">
          {people.map((person, index) => {
            const displayName =
              (typeof person.name === 'string' && person.name.trim()) ||
              (person.id != null ? String(person.id) : '');
            const placeholder = displayName ? displayName.charAt(0).toUpperCase() : '?';
            const key =
              person.id != null ? String(person.id) : `${displayName || 'person'}-${index}`;
            return (
              <li
                key={key}
                className="flex min-w-[180px] items-center gap-3 rounded-md border border-border/70 bg-card/70 px-3 py-2"
              >
                {person.image ? (
                  <img
                    src={person.image}
                    alt={displayName || 'Person'}
                    className="h-12 w-12 flex-none rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    {placeholder}
                  </div>
                )}
                <span className="text-sm font-medium text-foreground">
                  {displayName || 'Unknown'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const widgetPayload = useMemo(() => {
    const route = `${location.pathname}${location.search}`;
    let summary = `No versions available for ${titleForDisplay}.`;
    if (loading) {
      summary = `Loading versions for ${titleForDisplay}...`;
    } else if (pendingVersion) {
      const parts = [
        pendingVersion.quality,
        pendingVersion.codec,
        pendingVersion.container,
        pendingVersion.source,
        pendingVersion.resolution,
      ]
        .filter((part) => Boolean(part))
        .join(' / ');
      summary = `Confirm download of ${parts || 'the selected release'} for ${titleForDisplay}.`;
    } else if (versions.length > 0) {
      summary = `Showing ${versions.length} version${versions.length === 1 ? '' : 's'} for ${titleForDisplay}.`;
    }

    return {
      currentRoute: route,
      routeName: 'getVersions',
      data: {
        movieId,
        movieTitle: titleForDisplay,
        queryTitle: movieTitle,
        loading,
        versions,
        versionsCount: versions.length,
        synopsis,
        runtime,
        imdbLoading,
        credits,
        hasCredits,
        creditsOpen,
        pendingVersion,
        pendingDialogOpen: Boolean(pendingVersion),
        cachedMovie,
      },
      summary,
    };
  }, [
    location.pathname,
    location.search,
    movieId,
    movieTitle,
    titleForDisplay,
    loading,
    versions,
    synopsis,
    runtime,
    imdbLoading,
    credits,
    hasCredits,
    creditsOpen,
    pendingVersion,
    cachedMovie,
  ]);

  useWidgetState(isEmbeddedApp, widgetPayload);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-dashed border-border/80 bg-muted/40 p-4">
        {cachedMovie &&
        (cachedMovie.posterUrl || cachedMovie.title || cachedMovie.year || runtime) ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
                  {runtime ? <div className="text-xs text-muted-foreground">{runtime}</div> : null}
                </div>
              </div>
              {(imdbLoading || synopsis) && (
                <div className="space-y-3 text-sm text-muted-foreground sm:max-w-xl">
                  {synopsis ? (
                    <div className="leading-relaxed">{synopsis}</div>
                  ) : imdbLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Spinner />
                      <span>Fetching synopsis...</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            {(hasCredits || imdbLoading) && (
              <details
                className="overflow-hidden rounded-md border border-border/80 bg-card/60 text-foreground"
                onToggle={(event) => setCreditsOpen(event.currentTarget.open)}
              >
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    {creditsOpen ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>Cast &amp; Crew</span>
                  </span>
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
                    <div className="text-xs text-muted-foreground">
                      No additional credits available.
                    </div>
                  ) : null}
                </div>
              </details>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Loading movie details...</div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          <span>Cataloging editions...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((version) => (
            <VersionRow
              key={version.id}
              version={version}
              onSelect={() => requestDownload(version)}
            />
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
            <DialogTitle>
              {titleForDisplay ? `Confirm download — ${titleForDisplay}` : 'Confirm download'}
            </DialogTitle>
            <DialogDescription>Review this release before starting the download.</DialogDescription>
          </DialogHeader>
          {pendingVersion && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>
                {pendingVersion.goldenPopcorn ? '🍿 ' : ''}
                {pendingVersion.checked ? '✅ ' : ''}
                {pendingVersion.quality} / {pendingVersion.codec} / {pendingVersion.container} /{' '}
                {pendingVersion.source} / {pendingVersion.resolution}
                {pendingVersion.scene ? ' / Scene' : ''}
                {pendingVersion.remasterTitle ? ` / ${pendingVersion.remasterTitle}` : ''}
              </div>
              <div>
                Seeders: {pendingVersion.seeders}, Snatched: {pendingVersion.snatched}, Size:{' '}
                {formatSizeGb(pendingVersion.sizeGB) || 'Unknown'} GB
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingVersion(null)}
              disabled={isSubmitting}
            >
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
