import './globals.css'

export const metadata = {
  title: 'GOÄ Rechnungsbutler',
  description: 'Gebührenordnung Alt → Neu Übersetzung',
}

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body className="bg-gray-50 antialiased">{children}</body>
    </html>
  )
}
