import { defineConfig } from 'astro/config';

// TODO(deploy): set `site` to the real domain before launch (used for canonical + OG urls).
export default defineConfig({
  site: 'https://cissa-product.example.com',
  devToolbar: { enabled: false },
  vite: {
    // Pre-bundle the motion/3D deps so the dev server never serves stale chunks.
    optimizeDeps: { include: ['three', 'gsap', 'gsap/ScrollTrigger', 'lenis', 'matter-js'] },
  },
});
