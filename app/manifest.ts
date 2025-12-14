import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MCX.NOTES',
    short_name: 'NOTES',
    description: 'Super simple. End-to-end encrypted.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#463d3d',
    theme_color: '#463d3d',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
