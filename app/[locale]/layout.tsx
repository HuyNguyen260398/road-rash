import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import "../globals.css";
import { routing } from "@/i18n/routing";
import ConfigureAmplifyClientSide from "@/components/ConfigureAmplifyClientSide";
import GsapProvider from "@/components/GsapProvider";
import FavoritesProvider from "@/components/FavoritesProvider";
import ThemeProvider from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  // Geist has no "vietnamese" Google Fonts subset; "latin-ext" covers the
  // Vietnamese diacritics (ậ/ữ/ỗ/ặ).
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Road Rash",
  description:
    "Discover, save, and share road trip routes with maps and AI suggestions.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <ConfigureAmplifyClientSide />
        <GsapProvider />
        <NextIntlClientProvider>
          <ThemeProvider>
            <FavoritesProvider>{children}</FavoritesProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
