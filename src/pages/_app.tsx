import "@/styles/globals.css";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className="bg-gray-900 min-h-screen py-40">
      <Component {...pageProps} />;
    </main>
  )
}
