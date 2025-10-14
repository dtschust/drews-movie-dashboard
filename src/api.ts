import type {
  DownloadRequest,
  DownloadResponse,
  ImdbDetails,
  MovieSearchResponse,
  TopMoviesResponse,
  VersionsResponse,
} from './types';

export const API_BASE = 'https://tools.drew.shoes/movies';

function getToken(): string {
  try {
    return localStorage.getItem('token') || '';
  } catch (_) {
    return '';
  }
}

export async function searchMovies(
  query: string,
  isEmbeddedApp: boolean = false,
): Promise<MovieSearchResponse> {
  if (isEmbeddedApp) {
    const toolResponse = await window.openai.callTool('search-movies', { search: query });
    return toolResponse?.structuredContent as MovieSearchResponse;
  } else {
    const token = getToken();
    const url = new URL(API_BASE + '/search');
    url.searchParams.set('q', query);
    url.searchParams.set('token', token);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Search failed (${res.status})`);
    }
    return (await res.json()) as MovieSearchResponse;
  }
}

export async function getTopMovies(isEmbeddedApp: boolean = false): Promise<TopMoviesResponse> {
  if (isEmbeddedApp) {
    const toolResponse = await window.openai.callTool('get-top-movies', {});
    return toolResponse?.structuredContent as TopMoviesResponse;
  } else {
    const token = getToken();
    const url = new URL(API_BASE + '/topMovies');
    url.searchParams.set('token', token);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Top movies failed (${res.status})`);
    }
    return res.json();
  }
}

export async function getVersions(
  id: string | number,
  title = '',
  isEmbeddedApp: boolean = false,
): Promise<VersionsResponse> {
  if (isEmbeddedApp) {
    const toolResponse = await window.openai.callTool('get-versions', { id, title });
    return toolResponse?.structuredContent as VersionsResponse;
  } else {
    const token = getToken();
    const url = new URL(API_BASE + '/getVersions');
    url.searchParams.set('id', String(id));
    url.searchParams.set('title', title ?? '');
    url.searchParams.set('token', token);
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Get versions failed (${res.status})`);
    }
    return res.json();
  }
}

export async function downloadMovie(
  { torrentId, movieTitle }: DownloadRequest,
  isEmbeddedApp: boolean = false,
): Promise<DownloadResponse> {
  const token = getToken();
  if (isEmbeddedApp) {
    const toolResponse = await window.openai.callTool('fetch-movie', { torrentId, movieTitle });
    return toolResponse?.structuredContent as DownloadResponse;
  } else {
    const res = await fetch(API_BASE + '/downloadMovie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ torrentId, movieTitle, token }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Download failed (${res.status})`);
    }
    return res.json();
  }
}

export async function getImdbDetails(imdbId: string | number): Promise<ImdbDetails> {
  if (!imdbId) {
    throw new Error('Missing imdb id');
  }

  const url = new URL(`https://api.imdbapi.dev/titles/tt${imdbId}`);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Could not load IMDb details (${res.status})`);
  }
  return res.json();
}
