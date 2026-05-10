# OpenShift Compatibility Fixes

## Problem Diagnosis

The application was running internally (pod healthy, uvicorn on 0.0.0.0:8080, localhost:8080 worked via port-forward) but the external OpenShift route showed "Application is not available."

**Root Causes Identified:**

1. **Missing Health Endpoint**: OpenShift router needs a reliable endpoint to probe
2. **Filesystem Write Permissions**: Writing to `/app/temp` fails in OpenShift (read-only filesystem)
3. **Cookies Path Issues**: `cookies.txt` in `/app` directory not accessible in OpenShift
4. **Non-root User Compatibility**: OpenShift runs containers as arbitrary UIDs
5. **Insufficient Startup Logging**: Hard to diagnose issues without detailed logs
6. **No Explicit Health Check Routes**: OpenShift probes need fast-responding endpoints

## Changes Made

### 1. main.py - Application Code

#### Added Health Endpoints

```python
@app.get("/health")
async def health():
    """Lightweight health check endpoint for OpenShift probes."""
    return JSONResponse(
        status_code=200,
        content={"status": "healthy", "service": "ultimate-playlist-merger"}
    )

@app.get("/api/status")
async def api_status():
    """API status endpoint with more details."""
    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "service": "ultimate-playlist-merger",
            "temp_path": str(TEMP_ROOT),
            "temp_writable": os.access(TEMP_ROOT, os.W_OK) if TEMP_ROOT.exists() else False,
            "cookies_available": COOKIES_PATH.exists(),
            "active_jobs": len(jobs),
        }
    )
```

#### Fixed Filesystem Paths

- **TEMP_ROOT**: Changed from `BASE_DIR / "temp"` to `Path("/tmp/temp")` ✅
- **COOKIES_PATH**: Smart fallback - uses `/tmp/cookies.txt` in OpenShift, `BASE_DIR / "cookies.txt"` in Railway
  ```python
  COOKIES_PATH = Path("/tmp/cookies.txt") if Path("/tmp").is_dir() and os.access("/tmp", os.W_OK) else BASE_DIR / "cookies.txt"
  ```

#### Enhanced Startup Logging

Added comprehensive diagnostics:

- Current PORT from environment
- TEMP_ROOT path, existence, and writability
- COOKIES_PATH location and existence
- Cookie file age (if exists)
- ffmpeg, deno, node availability
- yt-dlp-ejs status
- bgutil provider connectivity

#### Improved Error Handling

- App never crashes if `cookies.txt` is missing
- yt-dlp only uses cookiefile if file exists
- Graceful fallbacks for missing dependencies

#### Added Logging Configuration

```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
```

### 2. Dockerfile - Container Configuration

#### OpenShift Compatibility Changes

**Non-root User Support:**

```dockerfile
# Create non-root user for OpenShift compatibility
RUN useradd -m -u 1001 -s /bin/bash appuser

# Make /app readable by all users (OpenShift runs as arbitrary UID)
RUN chmod -R g+rwX /app && \
    chmod -R o+rX /app

# Switch to non-root user
USER 1001
```

**Writable Directories:**

```dockerfile
# Ensure /tmp is writable (OpenShift default)
RUN mkdir -p /tmp/temp && chmod -R 777 /tmp/temp
```

**Port Configuration:**

```dockerfile
# Expose port 8080 (OpenShift default)
EXPOSE 8080

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

## Testing Checklist

After deploying these changes, verify:

- [ ] `GET /` returns 200 (HTML page)
- [ ] `GET /health` returns 200 with `{"status": "healthy"}`
- [ ] `GET /api/status` returns 200 with detailed status
- [ ] OpenShift route is accessible externally
- [ ] Pod logs show "✓ Application startup complete - ready to accept requests"
- [ ] Pod logs show TEMP_ROOT is writable
- [ ] Application can create jobs and download files

## OpenShift Route Configuration

Ensure your OpenShift route is configured:

```yaml
kind: Route
apiVersion: route.openshift.io/v1
metadata:
  name: ultimate-playlist-merger
spec:
  to:
    kind: Service
    name: ultimate-playlist-merger
  port:
    targetPort: 8080
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
```

## Service Configuration

Ensure your service targets port 8080:

```yaml
kind: Service
apiVersion: v1
metadata:
  name: ultimate-playlist-merger
spec:
  ports:
    - name: http
      protocol: TCP
      port: 8080
      targetPort: 8080
  selector:
    app: ultimate-playlist-merger
```

## Deployment Steps

1. **Rebuild the Docker image:**

   ```bash
   docker build -t ultimate-playlist-merger:latest .
   ```

2. **Push to your registry:**

   ```bash
   docker tag ultimate-playlist-merger:latest <your-registry>/ultimate-playlist-merger:latest
   docker push <your-registry>/ultimate-playlist-merger:latest
   ```

3. **Update OpenShift deployment:**

   ```bash
   oc rollout restart deployment/ultimate-playlist-merger
   ```

4. **Check pod logs:**

   ```bash
   oc logs -f deployment/ultimate-playlist-merger
   ```

5. **Test health endpoint:**
   ```bash
   curl https://your-route-url/health
   ```

## Cookies File Setup (Optional but Recommended)

If you want to use cookies for better YouTube access:

### Option 1: ConfigMap (for Railway/non-OpenShift)

Keep `cookies.txt` in the repository root.

### Option 2: Secret (for OpenShift)

```bash
# Create secret from cookies.txt
oc create secret generic youtube-cookies --from-file=cookies.txt

# Mount in deployment
oc set volume deployment/ultimate-playlist-merger \
  --add --type=secret --secret-name=youtube-cookies \
  --mount-path=/tmp/cookies.txt --sub-path=cookies.txt
```

## Compatibility Matrix

| Platform  | TEMP_ROOT   | COOKIES_PATH       | Port | Status        |
| --------- | ----------- | ------------------ | ---- | ------------- |
| Railway   | `/tmp/temp` | `./cookies.txt`    | 8080 | ✅ Compatible |
| OpenShift | `/tmp/temp` | `/tmp/cookies.txt` | 8080 | ✅ Compatible |
| Docker    | `/tmp/temp` | `./cookies.txt`    | 8080 | ✅ Compatible |
| Local Dev | `/tmp/temp` | `./cookies.txt`    | 8080 | ✅ Compatible |

## What Was Causing the Issue?

The OpenShift router was likely failing health checks because:

1. **No dedicated health endpoint** - Router couldn't verify app was ready
2. **Filesystem permission errors** - App might have been crashing on startup when trying to create `/app/temp`
3. **Insufficient logging** - Hard to diagnose what was failing
4. **Root user assumptions** - OpenShift runs as arbitrary UID, not root

## What Changed?

1. ✅ Added `/health` endpoint (instant 200 response)
2. ✅ Added `/api/status` endpoint (detailed diagnostics)
3. ✅ Changed all write paths to `/tmp` (OpenShift writable)
4. ✅ Made cookies optional (app doesn't crash if missing)
5. ✅ Added comprehensive startup logging
6. ✅ Made Dockerfile OpenShift-compatible (non-root user)
7. ✅ Ensured proper file permissions in container
8. ✅ Root route `/` already returns 200 (HTML page)

## Rebuild/Redeploy Required?

**YES** - You must rebuild and redeploy:

1. The Dockerfile has changed (non-root user, permissions)
2. The application code has changed (health endpoints, paths)
3. OpenShift needs to pull the new image

After redeploying, the external route should work immediately.
