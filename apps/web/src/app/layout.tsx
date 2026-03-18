import type { Metadata } from "vinext/shims/metadata";
import { Geist_Mono } from "next/font/google";
import { QueryProvider } from "./providers/query-provider";
import { ThemeProvider, ThemeScript } from "@app/ui";
import Footer from "@/widgets/footer/Footer";
import "./globals.css";
import Header from "@/widgets/header/Header";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SEOJing",
  description: "SEOJing은 프론트엔드 개발 블로그 플랫폼입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <ThemeScript />
      </head>
      <body className={geistMono.variable}>
        <ThemeProvider>
          <QueryProvider>
            <div className="sticky top-0 z-30 w-full border-b border-foreground/5 bg-background/80 px-4 backdrop-blur-sm sm:px-8 dark:bg-[#0a0a0a]/80">
              <div className="mx-auto">
                <Header />
              </div>
            </div>
            <main className="mx-auto mt-6 w-full max-w-5xl px-4 sm:mt-8 sm:px-6 lg:mt-10 lg:px-8">
              {children}
            </main>
            <Footer />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
