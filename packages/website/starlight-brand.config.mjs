/*
 * Brand-critical Starlight wiring.
 *
 * Spread `starlightBrand` into your starlight() options in astro.config.mjs
 * alongside per-site fields (title, description, sidebar, social).
 */

export const starlightBrand = {
  customCss: ['./src/styles/base.css', './src/styles/starlight.css'],
};
