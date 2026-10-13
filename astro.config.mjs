// @ts-check
import { defineConfig } from 'astro/config';
import { sessionDrivers } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
	site: 'https://orboro.net',
	output: 'server',
	security: { checkOrigin: true },
	build: {
		// Nonce-based CSP needs every inline <style>/<script> to be one we
		// authored (and can attach a nonce to) — never let Astro's own
		// component styles get auto-inlined depending on their size.
		inlineStylesheets: 'never',
	},
	vite: {
		build: {
			// Astro inlines processed <script> chunks under this limit as an
			// unnonced <script type="module">, which the CSP blocks. Keep every
			// script chunk external under /_astro/ (guarded by
			// `npm run check:inline-scripts`). Fonts stay external too: a small
			// subset inlined as a data: URI breaks `font-src 'self'`. Other
			// assets keep Vite's default 4 KB limit.
			assetsInlineLimit: (filePath) => (/\.(?:[cm]?js|woff2?|ttf|otf)$/.test(filePath) ? false : undefined),
		},
	},
	session: {
		// Auth uses custom D1 sessions; this driver prevents an unused Astro KV binding.
		driver: sessionDrivers.lruCache(),
	},
	adapter: cloudflare({
		imageService: 'compile',
	}),
});
