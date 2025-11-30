import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // Configure Cloudflare Pages adapter
    adapter: adapter(),
    // Path aliases for imports
    alias: {
      $lib: "./src/lib",
      $modules: "./src/modules",
    },
    // Content Security Policy
    csp: {
      mode: "auto",
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "img-src": ["'self'", "https:", "data:"],
        "connect-src": [
          "'self'",
          "https://books.google.com",
          "https://covers.openlibrary.org",
        ],
      },
    },
  },
};

export default config;
