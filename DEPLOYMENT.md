# Deployment Guide

## OpenShift Backend Deployment

Your backend is already deployed at:

```
https://youtube-playlist-merger-mahinisnggs-dev.apps.rm1.0a51.p1.openshiftapps.com
```

### Environment Variables (OpenShift)

Set these in your OpenShift deployment:

```bash
# Required: API URL for frontend
oc set env deployment/ultimate-playlist-merger \
  API_URL=https://youtube-playlist-merger-mahinisnggs-dev.apps.rm1.0a51.p1.openshiftapps.com

# Optional: bgutil provider
oc set env deployment/ultimate-playlist-merger \
  BGUTIL_PROVIDER_URL=http://bgutil-provider:4416

# Optional: CORS origins (comma-separated)
oc set env deployment/ultimate-playlist-merger \
  ALLOWED_ORIGINS=https://ytsubliminal.vercel.app,https://your-domain.com
```

## Vercel Frontend Deployment

### Option 1: Deploy Full App to Vercel (Recommended)

Since this is a Python FastAPI app with server-rendered HTML, you can deploy the entire app to Vercel using their Python runtime.

**Steps:**

1. Create `vercel.json` in project root:

```json
{
  "builds": [
    {
      "src": "main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "main.py"
    }
  ]
}
```

2. Deploy:

```bash
vercel --prod
```

3. Set environment variables in Vercel dashboard:
   - `BGUTIL_PROVIDER_URL` (if using bgutil)
   - `ALLOWED_ORIGINS` (optional)

### Option 2: Separate Frontend/Backend

If you want to keep backend on OpenShift and deploy only static files to Vercel:

**Backend (OpenShift):**

```bash
# Set API_URL to your OpenShift backend
oc set env deployment/ultimate-playlist-merger \
  API_URL=https://youtube-playlist-merger-mahinisnggs-dev.apps.rm1.0a51.p1.openshiftapps.com

# Allow Vercel origin
oc set env deployment/ultimate-playlist-merger \
  ALLOWED_ORIGINS=https://ytsubliminal.vercel.app
```

**Frontend (Vercel):**

1. Create a simple `index.html` that loads from OpenShift:

```html
<!DOCTYPE html>
<html>
  <head>
    <script>
      // Set API URL before loading the app
      window.API_BASE_URL =
        "https://youtube-playlist-merger-mahinisnggs-dev.apps.rm1.0a51.p1.openshiftapps.com";
    </script>
    <script>
      // Redirect to OpenShift backend (serves the full app)
      window.location.href = window.API_BASE_URL;
    </script>
  </head>
  <body>
    <p>Loading...</p>
  </body>
</html>
```

2. Or create `vercel.json` to proxy to OpenShift:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "https://youtube-playlist-merger-mahinisnggs-dev.apps.rm1.0a51.p1.openshiftapps.com/$1"
    }
  ]
}
```

## Recommended Approach

**Deploy everything to OpenShift** - it's simpler since this is a server-rendered app:

1. Backend serves HTML + API
2. Frontend JavaScript makes API calls to same origin
3. No CORS issues
4. Single deployment

Your current OpenShift URL works perfectly:

```
https://youtube-playlist-merger-mahinisnggs-dev.apps.rm1.0a51.p1.openshiftapps.com
```

## Testing

After deployment, check browser console for:

```
API Base URL: https://youtube-playlist-merger-mahinisnggs-dev.apps.rm1.0a51.p1.openshiftapps.com
```

All API calls should now use the full URL instead of relative paths.

## Troubleshooting

### "API calls still use relative URLs"

Check:

1. Browser console shows correct API_BASE_URL
2. OpenShift has `API_URL` environment variable set
3. Clear browser cache and hard refresh

### "CORS errors"

Set `ALLOWED_ORIGINS` in OpenShift:

```bash
oc set env deployment/ultimate-playlist-merger \
  ALLOWED_ORIGINS=https://ytsubliminal.vercel.app
```

### "Cannot connect to server"

1. Check OpenShift pod is running: `oc get pods`
2. Check logs: `oc logs deployment/ultimate-playlist-merger`
3. Test health endpoint: `curl https://your-url/health`
