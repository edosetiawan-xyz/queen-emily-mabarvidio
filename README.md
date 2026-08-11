# 👑 Queen Emily ♡ MabarVidio

Watch-party realtime untuk YouTube dan URL video langsung.

## Fitur

- Room dengan kode dan invite link
- Supabase Realtime Broadcast
- Supabase Presence untuk daftar member online
- Host / transfer host / kick
- Sinkron play, pause, seek dan heartbeat
- YouTube Player
- URL langsung `.mp4`, `.webm`, `.ogg`
- Playlist
- Live chat
- Reactions
- Tema feminine lavender/pink
- Responsive Android/desktop
- Vercel + Next.js

## 1. Install

```bash
npm install
```

## 2. Supabase

Buat project Supabase, lalu ambil Project URL dan Publishable Key dari dashboard.

Supabase Realtime menggunakan Broadcast untuk event realtime dan Presence untuk status anggota online.

Salin `.env.example` menjadi `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Tidak perlu memasukkan service-role key ke frontend.

## 3. Jalankan

```bash
npm run dev
```

Buka:

```text
http://localhost:3000
```

## 4. Deploy Vercel

Push repository ke GitHub, import repository tersebut ke Vercel, lalu tambahkan:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

ke Project Settings → Environment Variables.

## 5. YouTube

Paste salah satu:

```text
https://www.youtube.com/watch?v=VIDEO_ID
https://youtu.be/VIDEO_ID
https://www.youtube.com/shorts/VIDEO_ID
```

Website akan mengambil video ID dan memakai YouTube IFrame Player.

## 6. Netflix

Website tidak mengekstrak, mengunduh, atau membypass DRM Netflix. Untuk Netflix gunakan layanan/watch-party resmi atau tombol tautan keluar. Jangan mencoba memasukkan URL stream Netflix ke player.

## Catatan keamanan

Versi ini menggunakan Realtime channel untuk state room. Password room menggunakan challenge SHA-256 sehingga password tidak dikirim sebagai plaintext. Namun channel demo masih public; untuk production publik, tambahkan Supabase Auth + private Realtime channels + RLS/Realtime Authorization.

Jangan pernah memasukkan service-role key ke browser, GitHub, atau environment variable `NEXT_PUBLIC_*`.
