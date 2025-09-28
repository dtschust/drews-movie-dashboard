export const API_BASE = "https://tools.drew.shoes/movies";

function getToken() {
  try {
    return localStorage.getItem("token") || "";
  } catch (_) {
    return "";
  }
}

export async function searchMovies(query) {
  const token = getToken();
  const url = new URL(API_BASE + "/search");
  url.searchParams.set("q", query);
  url.searchParams.set("token", token);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Search failed (${res.status})`);
  }
  return res.json(); // { movies }
}

export async function getTopMovies() {
  const token = getToken();
  const url = new URL(API_BASE + "/topMovies");
  url.searchParams.set("token", token);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Top movies failed (${res.status})`);
  }
  return res.json(); // { movies }
}

export async function getVersions(id, title = "") {
  const token = getToken();
  const url = new URL(API_BASE + "/getVersions");
  url.searchParams.set("id", id);
  url.searchParams.set("title", title ?? "");
  url.searchParams.set("token", token);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Get versions failed (${res.status})`);
  }
  return res.json(); // { versions }
}

export async function downloadMovie({ torrentId, movieTitle }) {
  const token = getToken();
  const res = await fetch(API_BASE + "/downloadMovie", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ torrentId, movieTitle, token }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Download failed (${res.status})`);
  }
  return res.json(); // { ok, started }
}

export async function getImdbDetails(imdbId) {
  if (!imdbId) {
    throw new Error("Missing imdb id");
  }

  const url = new URL(`https://api.imdbapi.dev/titles/tt${imdbId}`);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Could not load IMDb details (${res.status})`);
  }
  return res.json();
}
