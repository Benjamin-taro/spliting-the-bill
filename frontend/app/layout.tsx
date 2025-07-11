// frontend/app/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Split-the-Bill OCR",
  description: "Upload receipts and extract items & prices",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
