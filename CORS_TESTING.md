# CORS Testing Guide

## Quick Test Commands

### 1. Test with curl (OPTIONS preflight)

```bash
curl -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type" \
  -v \
  http://localhost:8000/cors-test
```

**Expected headers in response:**

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: *
Access-Control-Allow-Headers: *
Access-Control-Allow-Credentials: true
```

### 2. Test with curl (GET request)

```bash
curl -H "Origin: https://example.com" \
  -v \
  http://localhost:8000/cors-test
```

**Expected headers in response:**

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

### 3. Test with Python script

```bash
python test_cors.py
```

### 4. Test from browser console

```javascript
// Open browser console on any website and run:
fetch("http://localhost:8000/cors-test")
  .then((r) => r.json())
  .then((data) => console.log("✓ CORS working:", data))
  .catch((err) => console.error("✗ CORS error:", err));
```

### 5. Test production endpoint

```bash
# Replace with your actual OpenShift URL
curl -H "Origin: https://example.com" \
  https://youtube-playlist-merger-mahinisnggs-dev.apps.rm1.0a51.p1.openshiftapps.com/cors-test
```

## Endpoints to Test

All endpoints should return CORS headers:

1. **GET /cors-test** - Dedicated CORS test endpoint
2. **GET /health** - Health check
3. **GET /api/status** - API status
4. **POST /create-job** - Create playlist job
5. **POST /create-video-job** - Create video job
6. **GET /status/{job_id}** - Job status
7. **GET /download/{job_id}** - Download file

## Expected Behavior

### ✓ Correct CORS Response

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
Content-Type: application/json

{"cors": "enabled", "message": "CORS is working correctly"}
```

### ✗ Broken CORS Response

```
HTTP/1.1 200 OK
Content-Type: application/json

{"cors": "enabled", "message": "CORS is working correctly"}
```

_Missing Access-Control-Allow-Origin header_

## Troubleshooting

### Problem: No CORS headers in response

**Check 1:** Verify middleware is loaded

```bash
# Look for this in startup logs:
✓ CORS middleware enabled
  - allow_origins: ['*']
  - allow_credentials: True
```

**Check 2:** Verify middleware order

```python
# In main.py, CORS middleware should be added BEFORE routes:
app = FastAPI(title="Ultimate Playlist Merger")
app.add_middleware(CORSMiddleware, ...)  # ← Must be here
app.mount("/static", ...)                 # ← After middleware
```

**Check 3:** Restart the server

```bash
# Kill and restart uvicorn
uvicorn main:app --reload
```

### Problem: CORS works locally but not in production

**Check 1:** Verify deployment logs

```bash
# OpenShift logs should show:
=== CORS Configuration ===
CORS middleware: ENABLED
```

**Check 2:** Test production endpoint directly

```bash
curl -v https://your-backend.com/cors-test
```

**Check 3:** Check for reverse proxy interference
Some reverse proxies strip CORS headers. Verify OpenShift route configuration.

## Browser DevTools Inspection

### Chrome/Edge DevTools

1. Open DevTools (F12)
2. Go to **Network** tab
3. Make a request to your API
4. Click on the request
5. Go to **Headers** tab
6. Look for **Response Headers** section
7. Verify `Access-Control-Allow-Origin: *` is present

### Firefox DevTools

1. Open DevTools (F12)
2. Go to **Network** tab
3. Make a request to your API
4. Click on the request
5. Go to **Response Headers** section
6. Verify `Access-Control-Allow-Origin: *` is present

## Common CORS Errors

### Error 1: "No 'Access-Control-Allow-Origin' header"

**Cause:** CORS middleware not loaded or not working
**Fix:** Verify middleware configuration in `main.py`

### Error 2: "Credentials flag is 'true', but 'Access-Control-Allow-Origin' is '\*'"

**Cause:** Browser security restriction (some browsers don't allow this combination)
**Fix:** This is actually allowed in modern browsers. If you see this, update your browser.

### Error 3: "CORS preflight request failed"

**Cause:** OPTIONS request not handled properly
**Fix:** Verify `allow_methods=["*"]` is set in middleware

### Error 4: "Request header field X is not allowed"

**Cause:** Custom header not in allowed list
**Fix:** Verify `allow_headers=["*"]` is set in middleware

## Success Indicators

✓ Startup logs show CORS configuration
✓ `/cors-test` endpoint returns 200 OK
✓ Response includes `Access-Control-Allow-Origin: *`
✓ Response includes `Access-Control-Allow-Credentials: true`
✓ OPTIONS preflight requests return 200 OK
✓ Frontend can make requests without CORS errors
✓ Browser DevTools shows CORS headers in Network tab

## Production Deployment Checklist

- [ ] Code deployed to OpenShift
- [ ] Server restarted
- [ ] Startup logs show CORS configuration
- [ ] `/cors-test` endpoint accessible
- [ ] CORS headers present in response
- [ ] Frontend can make requests successfully
- [ ] No CORS errors in browser console
- [ ] All API endpoints return CORS headers
