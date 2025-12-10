# PWA Icons

This directory should contain PNG icons for the PWA manifest.

Required sizes:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

You can generate these from the `calendar.svg` file in the parent directory using tools like:
- [Real Favicon Generator](https://realfavicongenerator.net/)
- ImageMagick: `convert -background none -resize 192x192 ../calendar.svg icon-192x192.png`
- Sharp (Node.js)

For development, the app will work without these icons - they're only needed for PWA installation.
