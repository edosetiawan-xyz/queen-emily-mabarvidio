 "use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "../lib/supabase";
import {
  getYouTubeId,
  initialState,
  isDirectVideo,
  makeClientId,
  makeRoomChannel,
  makeRoomCode
} from "../lib/room";

const EMOJIS = ["💗", "😂", "✨", "🌸", "🥰", "👏"];

function cleanName(v) {
  return (v || "").trim().slice(0, 32) || "Guest";
}

export default function Home() {
  const [screen, setScreen] = useState("home");
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [room, setRoom] = useState(null);
  const [state, setState] = useState(null);
  const [members, setMembers] = useState([]);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [videoInput, setVideoInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [joinAccepted, setJoinAccepted] = useState(true);

  const clientId = useMemo(() => (typeof window !== "undefined" ? makeClientId() : ""), []);
  const channelRef = useRef(null);
  const ytRef = useRef(null);
  const htmlVideoRef = useRef(null);
  const ytReadyRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const stateRef = useRef(null);
  const roomRef = useRef(null);

  useEffect(() => {
    const savedName = localStorage.getItem("qe-name");
    if (savedName) setName(savedName);

    const urlRoom = new URLSearchParams(location.search).get("room");
    if (urlRoom) setJoinCode(urlRoom.toUpperCase());
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  function notify(message) {
    setToast(message);
  }

  function saveName() {
    const n = cleanName(name);
    setName(n);
    localStorage.setItem("qe-name", n);
    return n;
  }

  async function connectRoom(roomData, isHost) {
    setError("");
    setJoinAccepted(isHost);
    let supabase;
    try {
      supabase = getSupabase();
    } catch (e) {
      setError(e.message);
      return false;
    }

    const channel = supabase.channel(makeRoomChannel(roomData.code), {
      config: { presence: { key: clientId } }
    });

    channel
      .on("broadcast", { event: "state" }, ({ payload }) => {
        if (!payload?.state) return;
        setState(payload.state);
      })
      .on("broadcast", { event: "state_request" }, ({ payload }) => {
        if (payload?.from === clientId) return;
        if (roomRef.current?.hostId === clientId && stateRef.current) {
          send("state", { state: stateRef.current });
        }
      })
      .on("broadcast", { event: "join_request" }, async ({ payload }) => {
        if (roomRef.current?.hostId !== clientId) return;
        const expected = await hashText(`${roomRef.current.code}:${roomRef.current.password || ""}`);
        const accepted = !roomRef.current.password || payload?.proof === expected;
        await send("join_result", { clientId: payload?.clientId, accepted });
        if (accepted && stateRef.current) {
          await send("state", { state: stateRef.current });
          await send("room_info", { room: { ...roomRef.current, password: "" } });
        }
      })
      .on("broadcast", { event: "join_result" }, ({ payload }) => {
        if (payload?.clientId !== clientId) return;
        if (!payload.accepted) {
          channel.unsubscribe();
          channelRef.current = null;
          setConnected(false);
          setScreen("home");
          setRoom(null);
          setState(null);
          setError("Password room salah atau room tidak menerima kamu.");
          history.replaceState({}, "", "/");
          return;
        }
        setJoinAccepted(true);
        send("state_request", { from: clientId });
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        if (!payload?.message) return;
        setChat((old) => [...old, payload.message].slice(-150));
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        if (payload?.emoji) showReaction(payload.emoji);
      })
      .on("broadcast", { event: "media" }, ({ payload }) => {
        if (!payload?.state) return;
        setState(payload.state);
      })
      .on("broadcast", { event: "kicked" }, ({ payload }) => {
        if (payload?.clientId === clientId) {
          channel.unsubscribe();
          channelRef.current = null;
          setScreen("home");
          setRoom(null);
          setState(null);
          notify("Kamu dikeluarkan dari room.");
          history.replaceState({}, "", "/");
        }
      })
      .on("broadcast", { event: "host" }, ({ payload }) => {
        if (payload?.hostId) {
          setState((old) => old ? { ...old, hostId: payload.hostId } : old);
        }
      })
      .on("broadcast", { event: "room_info" }, ({ payload }) => {
        if (payload?.room) setRoom(payload.room);
      })
      .on("presence", { event: "sync" }, () => {
        const presence = channel.presenceState();
        const list = Object.entries(presence).map(([key, values]) => {
          const latest = values?.[values.length - 1] || {};
          return {
            clientId: key,
            name: latest.name || "Guest",
            joinedAt: latest.joinedAt || Date.now()
          };
        });
        setMembers(list);
      })
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        setConnected(true);
        channelRef.current = channel;

        await channel.track({
          name: cleanName(name),
          joinedAt: Date.now()
        });

        if (isHost) {
          const initial = initialState(clientId);
          setState(initial);
          await sendWithChannel(channel, "state", { state: initial });
          await sendWithChannel(channel, "room_info", { room: { ...roomData, password: "" } });
        } else {
          const proof = await hashText(`${roomData.code}:${roomData.password || ""}`);
          await sendWithChannel(channel, "join_request", { from: clientId, clientId, proof });
        }
      });

    return true;
  }

  async function send(event, payload) {
    const channel = channelRef.current;
    if (!channel) return;
    await sendWithChannel(channel, event, payload);
  }

  async function sendWithChannel(channel, event, payload) {
    await channel.send({
      type: "broadcast",
      event,
      payload
    });
  }

  async function hashText(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function createRoom() {
    const n = saveName();
    const code = makeRoomCode();
    const roomData = {
      code,
      name: roomName.trim().slice(0, 60) || "Queen Emily Room",
      password: roomPassword,
      hostId: clientId
    };

    setRoom(roomData);
    const ok = await connectRoom(roomData, true);
    if (!ok) return;

    setScreen("room");
    history.replaceState({}, "", `/?room=${code}`);
    notify(`Room ${code} berhasil dibuat ♡`);
  }

  async function joinExistingRoom() {
    const n = saveName();
    const code = joinCode.trim().toUpperCase();
    if (!code) return setError("Masukkan kode room.");

    // Password is checked by the current host over the realtime channel.
    // This is a convenience gate, not a secure access-control boundary.
    const roomData = {
      code,
      name: "Queen Emily Room",
      password: joinPassword,
      hostId: null
    };

    const ok = await connectRoom(roomData, false);
    if (!ok) return;

    setScreen("room");
    history.replaceState({}, "", `/?room=${code}`);
    notify("Berhasil masuk room.");
  }

  function isHost() {
    return state?.hostId === clientId;
  }

  async function publishState(next, event = "media") {
    if (!isHost()) {
      notify("Hanya host yang dapat mengontrol video.");
      return;
    }
    const normalized = {
      ...next,
      hostId: clientId,
      updatedAt: Date.now()
    };
    setState(normalized);
    await send(event, { state: normalized });
  }

  async function addVideo() {
    const raw = videoInput.trim();
    if (!raw) return setError("Masukkan link YouTube atau URL video langsung.");

    const yt = getYouTubeId(raw);
    if (yt) {
      await publishState({
        ...stateRef.current,
        media: { type: "youtube", id: yt, title: titleInput.trim() || "YouTube Video" },
        playing: false,
        position: 0
      });
      setVideoInput("");
      setTitleInput("");
      return;
    }

    if (isDirectVideo(raw)) {
      await publishState({
        ...stateRef.current,
        media: { type: "direct", url: raw, title: titleInput.trim() || "Video" },
        playing: false,
        position: 0
      });
      setVideoInput("");
      setTitleInput("");
      return;
    }

    setError("Link harus berupa YouTube atau URL langsung .mp4/.webm/.ogg.");
  }

  async function addPlaylist() {
    const raw = videoInput.trim();
    if (!raw) return setError("Masukkan link video.");
    const yt = getYouTubeId(raw);
    const item = yt
      ? { type: "youtube", id: yt, title: titleInput.trim() || "YouTube Video" }
      : isDirectVideo(raw)
        ? { type: "direct", url: raw, title: titleInput.trim() || "Video" }
        : null;

    if (!item) return setError("URL tidak dikenali.");
    const next = [...(stateRef.current?.playlist || []), { ...item, id: crypto.randomUUID() }];
    await publishState({ ...stateRef.current, playlist: next });
    setVideoInput("");
    setTitleInput("");
  }

  async function playPlaylistItem(item) {
    await publishState({
      ...stateRef.current,
      media: item,
      playing: false,
      position: 0
    });
  }

  async function removePlaylistItem(id) {
    await publishState({
      ...stateRef.current,
      playlist: (stateRef.current?.playlist || []).filter((x) => x.id !== id)
    });
  }

  async function hostPlayPause() {
    if (!isHost()) return notify("Hanya host yang dapat mengontrol video.");
    const current = getCurrentPosition();
    await publishState({
      ...stateRef.current,
      position: current,
      playing: !stateRef.current.playing
    });
  }

  async function hostSeek(delta) {
    if (!isHost()) return notify("Hanya host yang dapat mengontrol video.");
    const current = getCurrentPosition();
    await publishState({
      ...stateRef.current,
      position: Math.max(0, current + delta)
    });
  }

  function getCurrentPosition() {
    if (stateRef.current?.media?.type === "youtube" && ytRef.current?.getCurrentTime) {
      return ytRef.current.getCurrentTime() || 0;
    }
    if (htmlVideoRef.current) return htmlVideoRef.current.currentTime || 0;
    return stateRef.current?.position || 0;
  }

  function showReaction(emoji) {
    const el = document.createElement("div");
    el.className = "floating-reaction";
    el.textContent = emoji;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  async function reaction(emoji) {
    showReaction(emoji);
    await send("reaction", { emoji });
  }

  async function sendChat() {
    const text = input.trim().slice(0, 500);
    if (!text) return;
    const message = {
      id: crypto.randomUUID(),
      name: cleanName(name),
      text,
      at: Date.now()
    };
    setChat((old) => [...old, message].slice(-150));
    setInput("");
    await send("chat", { message });
  }

  async function invite() {
    const url = `${location.origin}/?room=${room.code}`;
    await navigator.clipboard?.writeText(url);
    notify("Link invite disalin ♡");
  }

  async function transferHost(targetId) {
    if (!isHost()) return;
    await publishState({ ...stateRef.current, hostId: targetId });
    await send("host", { hostId: targetId });
    notify("Host dipindahkan.");
  }

  async function kick(targetId) {
    if (!isHost()) return;
    await send("kicked", { clientId: targetId });
    notify("Permintaan kick dikirim.");
  }

  function leaveRoom() {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setConnected(false);
    setScreen("home");
    setRoom(null);
    setState(null);
    setMembers([]);
    history.replaceState({}, "", "/");
  }

  // Apply remote state to players.
  useEffect(() => {
    if (!state?.media) return;
    const target = state.playing
      ? state.position + Math.max(0, (Date.now() - state.updatedAt) / 1000)
      : state.position;

    applyingRemoteRef.current = true;

    if (state.media.type === "direct" && htmlVideoRef.current) {
      const v = htmlVideoRef.current;
      if (Math.abs(v.currentTime - target) > 0.8) v.currentTime = target;
      if (state.playing) v.play().catch(() => {});
      else v.pause();
    }

    if (state.media.type === "youtube" && ytRef.current && ytReadyRef.current) {
      const current = ytRef.current.getCurrentTime?.() || 0;
      if (Math.abs(current - target) > 0.8) ytRef.current.seekTo(target, true);
      if (state.playing) ytRef.current.playVideo();
      else ytRef.current.pauseVideo();
    }

    const timer = setTimeout(() => { applyingRemoteRef.current = false; }, 350);
    return () => clearTimeout(timer);
  }, [state]);

  // Host heartbeat for smoother sync.
  useEffect(() => {
    if (!isHost()) return;
    const timer = setInterval(async () => {
      if (!stateRef.current?.media) return;
      const pos = getCurrentPosition();
      const next = { ...stateRef.current, position: pos, updatedAt: Date.now() };
      stateRef.current = next;
      setState(next);
      await send("media", { state: next });
    }, 2500);
    return () => clearInterval(timer);
  }, [state?.hostId, state?.media?.type, state?.media?.id, clientId]);

  useEffect(() => {
    return () => channelRef.current?.unsubscribe();
  }, []);

  const host = isHost();

  return (
    <div className="site">
      <div className="glow glow1" /><div className="glow glow2" />
      <div className="petal p1">🌸</div><div className="petal p2">🌷</div>
      <div className="petal p3">💗</div><div className="petal p4">✨</div>

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">👑</div>
          <div><div className="brand-title">Queen Emily</div><div className="brand-sub">MABAR VIDEO ♡</div></div>
        </div>
        <div className="connection">{connected ? "● ONLINE" : "○ OFFLINE"}</div>
      </header>

      {screen === "home" ? (
        <main className="home">
          <section className="hero glass">
            <div className="flowers">🌸　✨　💕　✨　🌸</div>
            <h1>Welcome to Queen Emily&apos;s<br />Watch Party</h1>
            <p>Nonton video bersama, ngobrol, dan berbagi momen dalam satu room yang cantik.</p>

            <div className="form-grid">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="♡ Nama kamu" />
              <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="♡ Nama room" />
            </div>
            <div className="form-grid">
              <input value={roomPassword} onChange={e => setRoomPassword(e.target.value)} placeholder="🔒 Password room (opsional)" />
              <button onClick={createRoom}>👑 Buat Room</button>
            </div>

            <div className="or"><span>atau gabung dengan kode</span></div>
            <div className="form-grid">
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="KODE ROOM" />
              <input value={joinPassword} onChange={e => setJoinPassword(e.target.value)} placeholder="Password" />
            </div>
            <button className="soft-button wide" onClick={joinExistingRoom}>💗 Gabung Room</button>
            {error && <div className="error">{error}</div>}
          </section>

          <section className="feature-row">
            {[
              ["🎬","Video Sync","Play, pause & seek bersama"],
              ["💬","Live Chat","Ngobrol realtime di room"],
              ["👭","Party Room","Invite teman dengan link"],
              ["🌸","Queen Theme","Feminine & elegant"]
            ].map(([icon,title,desc]) => <div className="glass feature" key={title}><div>{icon}</div><b>{title}</b><span>{desc}</span></div>)}
          </section>
        </main>
      ) : (
        <main className="room-page">
          <div className="room-head glass">
            <div><span className="pill">💗 ROOM {room?.code}</span><h2>{room?.name || "Queen Emily Room"}</h2></div>
            <div className="room-actions"><button className="soft-button" onClick={invite}>🔗 Invite</button><button className="soft-button" onClick={leaveRoom}>Keluar</button></div>
          </div>

          <div className="room-grid">
            <section>
              <div className="glass video-card">
                <VideoPlayer
                  state={state}
                  host={host}
                  ytRef={ytRef}
                  ytReadyRef={ytReadyRef}
                  htmlVideoRef={htmlVideoRef}
                />
                <div className="controls">
                  <button onClick={hostPlayPause}>▶ / ⏸</button>
                  <button className="soft-button" onClick={() => hostSeek(-10)}>↶ 10</button>
                  <button className="soft-button" onClick={() => hostSeek(10)}>10 ↷</button>
                  <button className="soft-button" onClick={() => document.querySelector(".video-stage")?.requestFullscreen?.()}>⛶</button>
                  <span className="sync-label">{host ? "👑 Kamu Host" : "♡ Host mengontrol video"}</span>
                </div>
              </div>

              <div className="glass panel">
                <div className="panel-title"><h3>🎞️ Tambahkan Video</h3><span>YouTube / direct video</span></div>
                <div className="form-grid">
                  <input value={videoInput} onChange={e => setVideoInput(e.target.value)} placeholder="Paste link YouTube atau .mp4/.webm" />
                  <input value={titleInput} onChange={e => setTitleInput(e.target.value)} placeholder="Judul video" />
                </div>
                <div className="button-row"><button onClick={addVideo}>▶ Putar Sekarang</button><button className="soft-button" onClick={addPlaylist}>＋ Playlist</button></div>
                <p className="hint">Contoh: youtube.com/watch?v=... atau https://domain.com/video.mp4</p>
              </div>

              <div className="glass panel">
                <div className="panel-title"><h3>🎀 Playlist</h3><span>{state?.playlist?.length || 0} video</span></div>
                {(state?.playlist || []).length === 0 ? <div className="empty">Belum ada playlist.</div> :
                  state.playlist.map((item, i) => <div className="playlist-item" key={item.id || i}><div><b>{i+1}. {item.title}</b><small>{item.type === "youtube" ? "YouTube" : "Video langsung"}</small></div><div><button className="soft-button" onClick={() => playPlaylistItem(item)}>Putar</button>{host && <button className="danger-button" onClick={() => removePlaylistItem(item.id)}>Hapus</button>}</div></div>)}
              </div>
            </section>

            <aside>
              <div className="glass panel">
                <div className="panel-title"><h3>👭 Teman</h3><span>{members.length} online</span></div>
                <div className="members">{members.map(m => <div className="member" key={m.clientId}><div className="avatar">👩🏻</div><div className="member-name"><b>{m.name}</b>{m.clientId === clientId && <small>kamu</small>}</div>{m.clientId === state?.hostId && <span>👑</span>}{host && m.clientId !== clientId && <div className="member-actions"><button className="tiny" onClick={() => transferHost(m.clientId)}>Host</button><button className="tiny danger" onClick={() => kick(m.clientId)}>Kick</button></div>}</div>)}</div>
              </div>

              <div className="glass panel chat-panel">
                <div className="panel-title"><h3>💬 Obrolan</h3></div>
                <div className="chat">{chat.map(m => <div className={`chat-bubble ${m.name === name ? "mine" : ""}`} key={m.id}><b>{m.name}</b><div>{m.text}</div></div>)}</div>
                <div className="chat-input"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="Tulis pesan..." /><button onClick={sendChat}>Kirim</button></div>
                <div className="reactions">{EMOJIS.map(e => <button className="emoji-button" key={e} onClick={() => reaction(e)}>{e}</button>)}</div>
              </div>
            </aside>
          </div>
        </main>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function VideoPlayer({ state, host, ytRef, ytReadyRef, htmlVideoRef }) {
  const [ytLoaded, setYtLoaded] = useState(false);
  const mountRef = useRef(null);

  useEffect(() => {
    if (!state?.media || state.media.type !== "youtube") return;
    if (window.YT?.Player) {
      setYtLoaded(true);
      return;
    }
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }
    const old = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      old?.();
      setYtLoaded(true);
    };
    return () => {
      window.onYouTubeIframeAPIReady = old;
    };
  }, [state?.media?.type]);

  useEffect(() => {
    if (!ytLoaded || state?.media?.type !== "youtube" || !mountRef.current) return;

    ytRef.current?.destroy?.();
    ytReadyRef.current = false;

    ytRef.current = new window.YT.Player(mountRef.current, {
      videoId: state.media.id,
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => { ytReadyRef.current = true; },
        onError: () => console.warn("YouTube player error")
      }
    });

    return () => {
      ytRef.current?.destroy?.();
      ytRef.current = null;
      ytReadyRef.current = false;
    };
  }, [ytLoaded, state?.media?.id, state?.media?.type]);

  if (!state?.media) return <div className="video-stage placeholder"><div><div className="big-icon">🌸</div><h3>Pilih video untuk memulai</h3><p>Host dapat memasukkan link YouTube atau video langsung.</p></div></div>;

  if (state.media.type === "youtube") return <div className="video-stage"><div ref={mountRef} className="yt-mount" /></div>;

  return <div className="video-stage"><video ref={htmlVideoRef} src={state.media.url} controls playsInline /></div>;
}