import type {
  DownloadRequest,
  DownloadResponse,
  HdbitsSearchResponse,
  ImdbDetails,
  MovieSearchResponse,
  TopMoviesResponse,
  TvDownloadRequest,
  VersionsResponse,
} from './types';

export const API_BASE = 'https://tools.drew.shoes/movies';
export const HDBITS_API_BASE = 'https://tools.drew.shoes/hdbits';

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

export async function searchTvShows(
  query: string,
  isEmbeddedApp: boolean = false,
): Promise<HdbitsSearchResponse> {
  if (isEmbeddedApp) {
    try {
      const toolResponse = await window.openai.callTool('search-tv', { search: query });
      if (toolResponse?.structuredContent) {
        return toolResponse.structuredContent as HdbitsSearchResponse;
      }
    } catch (toolError) {
      console.warn('search-tv tool failed, falling back to HTTP request', toolError);
    }
  }

  const token = getToken();
  const url = new URL(HDBITS_API_BASE + '/search');
  url.searchParams.set('query', query);
  url.searchParams.set('token', token);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `TV search failed (${res.status})`);
  }
  return (await res.json()) as HdbitsSearchResponse;
}

export async function downloadTvShow(
  { torrentId, title }: TvDownloadRequest,
  isEmbeddedApp: boolean = false,
): Promise<DownloadResponse> {
  if (isEmbeddedApp) {
    try {
      const toolResponse = await window.openai.callTool('download-tv', { torrentId, title });
      if (toolResponse?.structuredContent) {
        return toolResponse.structuredContent as DownloadResponse;
      }
    } catch (toolError) {
      console.warn('download-tv tool failed, falling back to HTTP request', toolError);
    }
  }

  const token = getToken();
  const res = await fetch(HDBITS_API_BASE + '/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ torrentId, title, token }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `TV download failed (${res.status})`);
  }
  return res.json();
}
