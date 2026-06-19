import { Geist, Geist_Mono } from "next/font/google";
import { PreferencesProvider } from "./context/preferences";
import SessionWrapper from "./context/SessionWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Money Manager",
  description: "Personal finance tracker",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionWrapper>
          <PreferencesProvider>{children}</PreferencesProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}