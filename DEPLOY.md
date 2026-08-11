# Upload ke GitHub

```bash
git init
git add .
git commit -m "feat: Queen Emily MabarVidio"
git branch -M main
git remote add origin https://github.com/edosetiawan-xyz/queen-emily-mabarvidio.git
git push -u origin main
```

Jika repository sudah memiliki remote, jangan menjalankan `git remote add origin` dua kali.

# Vercel

Import repository `edosetiawan-xyz/queen-emily-mabarvidio`.

Environment Variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Lalu Deploy.
