import "./globals.css";

export const metadata = {
  title: "Queen Emily ♡ MabarVidio",
  description: "Watch party realtime untuk Queen Emily"
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}