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
  runtime?: string;
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
  runtime?: string;
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

export interface TvDownloadRequest {
  torrentId: string | number;
  title: string;
}

export interface BtnDownloadRequest {
  downloadUrl: string;
  title: string;
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

export interface HdbitsImdbData {
  id: number;
  englishtitle: string;
  originaltitle: string;
  year: number;
  genres: string[];
  rating: number;
}

export interface HdbitsTvdbData {
  id: number;
  season: number;
  episode: number;
}

export interface HdbitsTorrentItem {
  id: number;
  hash: string;
  leechers: number;
  seeders: number;
  name: string;
  descr: string;
  times_completed: number;
  size: number;
  utadded: number;
  added: string;
  comments: number;
  numfiles: number;
  filename: string;
  freeleech: 'yes' | 'no';
  type_category: number;
  type_codec: number;
  type_medium: number;
  type_origin: number;
  type_exclusive: number;
  torrent_status: '' | 'seeding' | 'leeching' | 'completed';
  bookmarked: 0 | 1;
  wishlisted: 0 | 1;
  tags: string[];
  username: string;
  owner: number;
  imdb?: HdbitsImdbData;
  tvdb?: HdbitsTvdbData;
}

export interface HdbitsSearchResponse {
  status: number;
  data: HdbitsTorrentItem[];
}

export interface BtnTorrentItem {
  GroupName?: string;
  GroupID?: string;
  TorrentID?: string;
  SeriesID?: string;
  Series?: string;
  SeriesBanner?: string;
  SeriesPoster?: string;
  YoutubeTrailer?: string;
  Category?: string;
  Snatched?: string;
  Seeders?: string;
  Leechers?: string;
  Source?: string;
  Container?: string;
  Codec?: string;
  Resolution?: string;
  Origin?: string;
  ReleaseName?: string;
  Size?: string;
  Time?: string;
  TvdbID?: string;
  TvrageID?: string;
  ImdbID?: string;
  InfoHash?: string;
  Tags?: string[];
  Genres?: string[];
  DownloadURL?: string;
}

export interface BtnSearchResponse {
  id?: number;
  result?: {
    results?: string;
    torrents?: Record<string, BtnTorrentItem>;
  };
}
