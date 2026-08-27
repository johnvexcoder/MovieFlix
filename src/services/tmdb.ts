import type { MediaType } from "@/types";

const TMDB_BASE_URL = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = process.env.TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p/";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genre_ids: number[];
  media_type?: string;
}

interface TMDBMovieDetails extends TMDBSearchResult {
  runtime: number;
  genres: { id: number; name: string }[];
  credits: {
    cast: { name: string; character: string }[];
    crew: { name: string; job: string }[];
  };
  videos: {
    results: { key: string; type: string; site: string }[];
  };
}

interface TMDBTVDetails extends TMDBSearchResult {
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: {
    season_number: number;
    name: string;
    overview: string;
    poster_path: string | null;
    air_date: string;
  }[];
  genres: { id: number; name: string }[];
  credits?: {
    cast: { name: string; character: string }[];
    crew: { name: string; job: string }[];
  };
}

interface TMDBSeasonDetails {
  season_number: number;
  name: string;
  overview: string;
  episodes: {
    episode_number: number;
    name: string;
    overview: string;
    still_path: string | null;
    air_date: string;
    runtime: number;
  }[];
}

export interface TMDBMetadata {
  tmdbId: number;
  title: string;
  overview: string;
  year: number | null;
  rating: number;
  posterUrl: string | null;
  backdropUrl: string | null;
  genres: string[];
  maturityRating: string;
  durationMinutes: number | null;
  trailerUrl: string | null;
  cast: string[];
  directors: string[];
}

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!TMDB_API_KEY) {
    console.warn("TMDB API key not configured");
    return null;
  }

  try {
    const searchParams = new URLSearchParams({
      api_key: TMDB_API_KEY,
      ...params,
    });

    const response = await fetch(`${TMDB_BASE_URL}${endpoint}?${searchParams}`);

    if (!response.ok) {
      console.error(`TMDB API error: ${response.status}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("TMDB fetch error:", error);
    return null;
  }
}

export async function searchMovie(
  title: string,
  year?: number
): Promise<TMDBMetadata | null> {
  const params: Record<string, string> = {
    query: title,
    include_adult: "false",
  };

  if (year) {
    params.year = year.toString();
  }

  const data = await fetchTMDB<{ results: TMDBSearchResult[] }>(
    "/search/movie",
    params
  );

  if (!data?.results?.length) {
    return null;
  }

  // Get the first result
  const result = data.results[0];

  // Fetch full details
  const details = await fetchTMDB<TMDBMovieDetails>(
    `/movie/${result.id}`,
    { append_to_response: "credits,videos" }
  );

  if (!details) {
    return null;
  }

  return extractMovieMetadata(details);
}

export async function searchTV(
  title: string
): Promise<TMDBMetadata | null> {
  const data = await fetchTMDB<{ results: TMDBSearchResult[] }>(
    "/search/tv",
    {
      query: title,
      include_adult: "false",
    }
  );

  if (!data?.results?.length) {
    return null;
  }

  const result = data.results[0];

  const details = await fetchTMDB<TMDBTVDetails>(
    `/tv/${result.id}`,
    { append_to_response: "credits" }
  );

  if (!details) {
    return null;
  }

  return extractTVMetadata(details);
}

export async function getSeasonDetails(
  tvId: number,
  seasonNumber: number
): Promise<TMDBSeasonDetails | null> {
  return fetchTMDB<TMDBSeasonDetails>(
    `/tv/${tvId}/season/${seasonNumber}`
  );
}

function extractMovieMetadata(details: TMDBMovieDetails): TMDBMetadata {
  const releaseYear = details.release_date
    ? parseInt(details.release_date.substring(0, 4))
    : null;

  const trailer = details.videos?.results?.find(
    (v) => v.type === "Trailer" && v.site === "YouTube"
  );

  const cast = details.credits?.cast?.slice(0, 10).map((c) => c.name) || [];
  const directors =
    details.credits?.crew?.filter((c) => c.job === "Director").map((c) => c.name) || [];

  return {
    tmdbId: details.id,
    title: details.title || details.name || "Unknown",
    overview: details.overview || "",
    year: releaseYear,
    rating: details.vote_average || 0,
    posterUrl: details.poster_path
      ? `${TMDB_IMAGE_BASE_URL}w500${details.poster_path}`
      : null,
    backdropUrl: details.backdrop_path
      ? `${TMDB_IMAGE_BASE_URL}w1280${details.backdrop_path}`
      : null,
    genres: details.genres?.map((g) => g.name) || [],
    maturityRating: getMaturityRating(details.vote_average),
    durationMinutes: details.runtime || null,
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    cast,
    directors,
  };
}

function extractTVMetadata(details: TMDBTVDetails): TMDBMetadata {
  const firstAirYear = details.first_air_date
    ? parseInt(details.first_air_date.substring(0, 4))
    : null;

  const cast = details.credits?.cast?.slice(0, 10).map((c: { name: string }) => c.name) || [];

  return {
    tmdbId: details.id,
    title: details.name || details.title || "Unknown",
    overview: details.overview || "",
    year: firstAirYear,
    rating: details.vote_average || 0,
    posterUrl: details.poster_path
      ? `${TMDB_IMAGE_BASE_URL}w500${details.poster_path}`
      : null,
    backdropUrl: details.backdrop_path
      ? `${TMDB_IMAGE_BASE_URL}w1280${details.backdrop_path}`
      : null,
    genres: details.genres?.map((g) => g.name) || [],
    maturityRating: getMaturityRating(details.vote_average),
    durationMinutes: null,
    trailerUrl: null,
    cast,
    directors: [],
  };
}

function getMaturityRating(rating: number): string {
  if (rating >= 8) return "PG-13";
  if (rating >= 6) return "PG";
  if (rating >= 4) return "R";
  return "NR";
}

export function getImageUrl(path: string | null, size: string = "w500"): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE_URL}${size}${path}`;
}
