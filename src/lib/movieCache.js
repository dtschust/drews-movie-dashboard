export const movieCache = new Map();

export function rememberMovies(movies) {
  if (!Array.isArray(movies)) return;
  movies.forEach((movie) => {
    if (!movie || movie.id == null) return;
    const cacheKey = String(movie.id);
    const existing = movieCache.get(cacheKey) || {};
    movieCache.set(cacheKey, {
      posterUrl: movie.posterUrl ?? existing.posterUrl,
      title: movie.title ?? existing.title,
      year: movie.year ?? existing.year,
      imdbId: movie.imdbId || existing.imdbId,
      synopsis: existing.synopsis,
    });
  });
}
