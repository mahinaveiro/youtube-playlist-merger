# Cookies Deployment Guide

## Overview

The app uses YouTube cookies for authentication. Cookies are **ignored by default** in Git to prevent accidental commits of personal session data, but can be **intentionally committed** for deployments.

## How It Works

### Local Development

- Place `cookies.txt` in project root
- App automatically uses it if present
- File is ignored by Git (won't be committed accidentally)

### Deployments

- **Option 1:** Commit cookies to Git temporarily (for Railway/simple deploys)
- **Option 2:** Use OpenShift Secrets (for production)
- **Option 3:** Set `COOKIES_PATH` environment variable to custom location

## Committing Cookies for Deployment

### Step 1: Add Cookies to Git (Force)

```bash
# Force add the ignored file
git add -f cookies.txt

# Commit
git commit -m "Add cookies.txt for deployment"

# Push
git push
```

**Why `-f` is needed:** `cookies.txt` is in `.gitignore`, so Git ignores it by default. The `-f` (force) flag overrides this.

### Step 2: Deploy

Your deployment platform (Railway, OpenShift, etc.) will now include the cookies file.

### Step 3: Remove Cookies from Git (After Deployment)

```bash
# Remove from Git tracking (keeps local file)
git rm --cached cookies.txt

# Commit the removal
git commit -m "Remove cookies.txt from Git"

# Push
git push
```

**Result:** Cookies are removed from Git history going forward, but your local file remains.

## Alternative: OpenShift Secrets (Recommended for Production)

### Create Secret from Local File

```bash
# Create secret
oc create secret generic youtube-cookies --from-file=cookies.txt

# Mount to deployment
oc set volume deployment/ultimate-playlist-merger \
  --add --type=secret --secret-name=youtube-cookies \
  --mount-path=/tmp/cookies.txt --sub-path=cookies.txt
```

### Benefits

- ✅ Cookies never in Git
- ✅ Secure storage
- ✅ Easy to update without redeploying

### Update Cookies

```bash
# Delete old secret
oc delete secret youtube-cookies

# Create new secret with updated cookies
oc create secret generic youtube-cookies --from-file=cookies.txt

# Restart deployment to pick up changes
oc rollout restart deployment/ultimate-playlist-merger
```

## Alternative: Environment Variable Path

Set a custom cookies path:

```bash
# OpenShift
oc set env deployment/ultimate-playlist-merger \
  COOKIES_PATH=/custom/path/cookies.txt

# Railway
# Set in dashboard: COOKIES_PATH=/custom/path/cookies.txt

# Local
export COOKIES_PATH=/custom/path/cookies.txt
```

## How to Get cookies.txt

### Method 1: Browser Extension (Recommended)

1. Install "Get cookies.txt LOCALLY" extension
   - Chrome: https://chrome.google.com/webstore
   - Firefox: https://addons.mozilla.org

2. Go to youtube.com (logged in)

3. Click extension icon → Export cookies

4. Save as `cookies.txt` in project root

### Method 2: Manual Export

Use browser DevTools to export cookies in Netscape format.

## Updating Cookies

Cookies expire after ~2 weeks. Update them:

### Local Development

1. Export fresh cookies (see above)
2. Replace `cookies.txt`
3. Restart app

### Railway (Git-based)

1. Export fresh cookies
2. Replace local `cookies.txt`
3. Commit and push:
   ```bash
   git add -f cookies.txt
   git commit -m "Update cookies"
   git push
   ```

### OpenShift (Secret-based)

```bash
# Update secret
oc delete secret youtube-cookies
oc create secret generic youtube-cookies --from-file=cookies.txt
oc rollout restart deployment/ultimate-playlist-merger
```

## App Behavior

The app handles cookies gracefully:

```python
# Checks multiple locations
COOKIES_PATH = Path("/tmp/cookies.txt") if writable else BASE_DIR / "cookies.txt"

# Only uses if exists
if COOKIES_PATH.exists():
    ydl_opts["cookiefile"] = str(COOKIES_PATH)
else:
    # App still works, but YouTube may block some requests
    log.warning("cookies.txt not found - app will work but may face bot detection")
```

### Fallback Behavior

| Scenario        | Behavior                           |
| --------------- | ---------------------------------- |
| Cookies exist   | ✅ Full functionality              |
| Cookies missing | ⚠️ Works but may hit bot detection |
| Cookies expired | ⚠️ YouTube may block requests      |
| Cookies invalid | ⚠️ Falls back to no-auth mode      |

## Git Behavior Explained

### Why `git add cookies.txt` Failed

```bash
$ git add cookies.txt
# Nothing happens - file is ignored
```

**Reason:** `cookies.txt` is in `.gitignore`, so Git completely ignores it.

### Why `git add -f cookies.txt` Worked

```bash
$ git add -f cookies.txt
# File is staged
```

**Reason:** The `-f` (force) flag tells Git to add the file **even though it's ignored**.

### Current .gitignore Setup

```gitignore
# Cookies file (contains sensitive YouTube session data)
# Ignored by default to prevent accidental commits of personal cookies
# To intentionally commit for deployment: git add -f cookies.txt
# To remove after deployment: git rm --cached cookies.txt
cookies.txt
```

**Benefits:**

- ✅ Prevents accidental commits
- ✅ Can still be intentionally committed with `-f`
- ✅ Clear documentation in .gitignore itself

## Deployment Strategies Comparison

| Strategy                 | Pros                     | Cons                           | Best For                |
| ------------------------ | ------------------------ | ------------------------------ | ----------------------- |
| **Git commit**           | Simple, works everywhere | Cookies in Git history         | Railway, simple deploys |
| **OpenShift Secret**     | Secure, no Git history   | OpenShift-specific             | Production OpenShift    |
| **Environment variable** | Flexible                 | Need to manage file separately | Custom setups           |
| **No cookies**           | No management needed     | May hit bot detection          | Testing only            |

## Recommended Approach

### Development

- Keep `cookies.txt` local (ignored by Git)
- Update every 2 weeks

### Railway

- Commit cookies temporarily with `git add -f`
- Remove from Git after deployment

### OpenShift Production

- Use Secrets (never commit to Git)
- Update via `oc delete/create secret`

## Troubleshooting

### "cookies.txt not found"

**Check logs:**

```bash
oc logs deployment/ultimate-playlist-merger | grep cookies
```

**Solutions:**

1. Commit to Git: `git add -f cookies.txt`
2. Use Secret: `oc create secret generic youtube-cookies --from-file=cookies.txt`
3. Set custom path: `oc set env deployment/... COOKIES_PATH=/path/to/cookies.txt`

### "YouTube detected bot activity"

**Cause:** Cookies expired or missing

**Fix:**

1. Export fresh cookies from browser
2. Update deployment (see methods above)
3. Restart app

### "git add cookies.txt" does nothing

**Cause:** File is in `.gitignore`

**Fix:** Use force flag: `git add -f cookies.txt`

## Summary

- **Default:** cookies.txt is ignored by Git (safe)
- **Deploy:** Use `git add -f cookies.txt` to intentionally commit
- **Production:** Use OpenShift Secrets instead of Git
- **App:** Works with or without cookies (graceful fallback)
- **Update:** Every 2 weeks or when bot detection occurs
