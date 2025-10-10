import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/Spinner';
import { searchMovies } from '@/api';
import { rememberMovies } from '@/lib/movieCache';
import type { MovieSummary } from '@/types';
import type { Dispatch, SetStateAction } from 'react';
import { toErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useEmbeddedAppContext } from '@/context/EmbeddedAppContext';

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

export interface SearchPageProps {
  topMovies: MovieSummary[];
  setError: Dispatch<SetStateAction<string>>;
  isEmbeddedApp: boolean;
}

export function SearchPage({ topMovies, setError, isEmbeddedApp }: SearchPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('query') || '';
  const [inputValue, setInputValue] = useState<string>(queryParam);
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(Boolean(queryParam));
  const navigate = useNavigate();

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
      } catch (error: unknown) {
        if (!cancelled) {
          console.error(error);
          setError(toErrorMessage(error));
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
      const { movies: list } = await searchMovies(movie.title);
      const nextMovies = Array.isArray(list) ? list : [];
      rememberMovies(nextMovies);
      params.set('title', movie.title);
      params.set('query', movie.title);
    }
    navigate(`/torrents/${movie.id}?${params.toString()}`);
  };

  return (
    <>
      <Card className={cn('mb-6', isEmbeddedApp && 'p-3 mb-1')}>
        {!isEmbeddedApp && (
          <CardHeader>
            <CardTitle>Search movies</CardTitle>
          </CardHeader>
        )}
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
            <Button
              className="w-full sm:w-auto"
              onClick={doSearch}
              disabled={!canSearch || loading}
            >
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
