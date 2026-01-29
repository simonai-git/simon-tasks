import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simon Task Tracker",
  description: "Kanban board for tracking Simon's tasks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
