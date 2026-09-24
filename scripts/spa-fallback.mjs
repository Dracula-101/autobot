// GitHub Pages serves 404.html for unknown paths; make it the app so deep
// links like /autobot/hunt (and push notification links) load correctly.
import { copyFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
console.log('spa-fallback: dist/404.html')
