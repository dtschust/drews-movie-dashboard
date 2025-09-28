export const movieCache = new Map();

export function rememberMovies(movies) {
  if (!Array.isArray(movies)) return;
  movies.forEach((movie) => {
    if (!movie || movie.id == null) return;
    movieCache.set(String(movie.id), {
      posterUrl: movie.posterUrl,
      title: movie.title,
      year: movie.year,
    });
  });
}
