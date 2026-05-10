/**
 * Configuration for Ultimate Playlist Merger
 * Set API_BASE_URL before loading other scripts
 */

// For production Vercel deployment, set this in your HTML:
// <script>window.API_BASE_URL = 'https://your-openshift-backend.com';</script>
// <script src="/static/config.js"></script>

// Default to current origin if not set
if (!window.API_BASE_URL) {
  window.API_BASE_URL = window.location.origin;
}

console.log('API Base URL:', window.API_BASE_URL);
