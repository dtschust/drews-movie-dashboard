import type { MovieCacheEntry, MovieSummary } from '../types';

export const movieCache = new Map<string, MovieCacheEntry>();

export function rememberMovies(movies: MovieSummary[] | null | undefined): void {
  if (!Array.isArray(movies)) return;
  movies.forEach((movie) => {
    if (!movie || movie.id == null) return;
    const cacheKey = String(movie.id);
    const existing = movieCache.get(cacheKey) ?? {};
    const nextEntry: MovieCacheEntry = {
      posterUrl: movie.posterUrl ?? existing.posterUrl,
      title: movie.title ?? existing.title,
      year: movie.year ?? existing.year,
      runtime: movie.runtime ?? existing.runtime,
      imdbId: movie.imdbId ?? existing.imdbId,
      synopsis: existing.synopsis,
      credits: existing.credits,
      imdbDetailsFetched: existing.imdbDetailsFetched,
    };
    movieCache.set(cacheKey, nextEntry);
  });
}
