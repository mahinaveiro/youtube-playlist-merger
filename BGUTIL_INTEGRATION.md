# bgutil-ytdlp-pot-provider Integration Complete

## What Was Changed

### 1. Dockerfile

- Added bgutil-ytdlp-pot-provider plugin installation
- Added verification check in build diagnostics

### 2. main.py

- Added bgutil provider URL configuration
- Added sleep_interval: 5 to avoid rate limiting
- Added youtubepot-bgutil:http extractor args with Railway private network URL
- Added bgutil connectivity check in startup diagnostics

## Railway Setup Required

### Step 1: Deploy bgutil-provider Service

1. Go to your Railway project
2. Click "New Service"
3. Select "Docker Image"
4. Enter image: `brainicism/bgutil-ytdlp-pot-provider`
5. Name the service: `bgutil-provider`
6. Set port: `4416`
7. Deploy

### Step 2: Verify Private Networking

Railway services in the same project automatically get private networking. Your backend will reach bgutil at:

```
http://bgutil-provider.railway.internal:4416
```

### Step 3: Deploy Your Backend

1. Commit changes:

```bash
git add Dockerfile main.py
git commit -m "Integrate bgutil-ytdlp-pot-provider"
git push
```

2. Railway will auto-deploy your backend

### Step 4: Verify Integration

Check your backend logs for:

```
=== Startup Diagnostics ===
bgutil-ytdlp-pot-provider: <version>
bgutil provider: CONNECTED at http://bgutil-provider.railway.internal:4416
```

## How It Works

1. Your backend makes yt-dlp request
2. bgutil plugin automatically calls bgutil-provider service
3. Provider generates fresh PO Token
4. Plugin passes token to yt-dlp
5. YouTube accepts request (no bot detection!)

## Configuration Summary

**bgutil Provider URL:** `http://bgutil-provider.railway.internal:4416`

**yt-dlp Options Added:**

- `sleep_interval: 5` - Rate limiting protection
- `extractor_args.youtubepot-bgutil:http.base_url` - Points to bgutil provider

**Cookies:** Still using your cookies.txt file (required for authentication)

## Troubleshooting

### "bgutil provider: NOT reachable"

**Causes:**

- bgutil-provider service not running
- Service named incorrectly (must be exactly `bgutil-provider`)
- Private networking not enabled (should be automatic)

**Fix:**

1. Check bgutil-provider service is running in Railway
2. Verify service name is exactly `bgutil-provider`
3. Check both services are in same Railway project

### "bgutil-ytdlp-pot-provider: NOT installed"

**Cause:** Plugin installation failed during Docker build

**Fix:**

1. Check Dockerfile build logs for errors
2. Verify pip install command succeeded
3. Rebuild: `railway up --detach`

### Still getting bot detection errors

**Possible causes:**

1. bgutil-provider service not responding
2. Cookies.txt expired (still needed for auth)
3. Rate limiting (increase sleep_interval)

**Debug steps:**

1. Check startup logs for bgutil connectivity
2. Update cookies.txt if old
3. Try increasing sleep_interval to 10

## Testing

After deployment, try merging a playlist. Check logs for:

```
Using deno runtime at: /root/.deno/bin/deno
Using node runtime at: /nix/store/.../bin/node
bgutil provider: CONNECTED
```

If you see these, bgutil is working!

## Benefits

- ✅ Automatic PO Token generation
- ✅ No manual token updates needed
- ✅ Reduced bot detection
- ✅ Better reliability for large playlists
- ✅ Works with existing cookies.txt

## Important Notes

- Cookies.txt still required (for authentication)
- bgutil handles PO Tokens (for bot detection bypass)
- Both work together for best results
- Update cookies every 1-2 weeks as usual
