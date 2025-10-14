export type Theme = 'light' | 'dark';

export interface MoviePerson {
  id?: string | number;
  name?: string;
  image?: string;
  [key: string]: unknown;
}

export interface MovieCredits {
  writers: MoviePerson[];
  directors: MoviePerson[];
  stars: MoviePerson[];
}

export interface MovieSummary {
  id: string | number;
  title?: string;
  year?: string | number;
  posterUrl?: string;
  imdbId?: string;
  synopsis?: string;
  credits?: MovieCredits;
  imdbDetailsFetched?: boolean;
}

export interface MovieCacheEntry {
  posterUrl?: string;
  title?: string;
  year?: string | number;
  imdbId?: string;
  synopsis?: string;
  credits?: MovieCredits;
  imdbDetailsFetched?: boolean;
}

export type NumericDisplayValue =
  | number
  | string
  | { toFixed: (fractionDigits?: number) => string };

export interface MovieVersion {
  id: string | number;
  quality?: string;
  codec?: string;
  container?: string;
  source?: string;
  resolution?: string;
  scene?: boolean;
  remasterTitle?: string;
  goldenPopcorn?: boolean;
  checked?: boolean;
  seeders?: number;
  snatched?: number;
  sizeGB?: NumericDisplayValue;
}

export interface MovieSearchResponse {
  movies?: MovieSummary[];
}

export interface TopMoviesResponse extends MovieSearchResponse {}

export interface VersionsResponse {
  versions?: MovieVersion[];
}

export interface DownloadRequest {
  torrentId: string | number;
  movieTitle: string;
}

export interface DownloadResponse {
  ok?: boolean;
  started?: boolean;
  message?: string;
}

export interface ImdbDetails {
  credits?: Record<string, unknown>;
  [key: string]: unknown;
}
