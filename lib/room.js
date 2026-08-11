export function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function makeClientId() {
  const old = typeof window !== "undefined" ? localStorage.getItem("qe-client-id") : null;
  if (old) return old;
  const id = crypto.randomUUID();
  localStorage.setItem("qe-client-id", id);
  return id;
}

export function makeRoomChannel(code) {
  return `queen-emily:room:${String(code).toUpperCase()}`;
}

export function getYouTubeId(value) {
  if (!value) return null;
  const raw = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const u = new URL(raw);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2];
    }
  } catch {}
  return null;
}

export function isDirectVideo(value) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(value || "");
}

export function initialState(hostId) {
  return {
    version: 1,
    hostId,
    media: null,
    playing: false,
    position: 0,
    updatedAt: Date.now(),
    playlist: []
  };
}