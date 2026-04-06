# How to Update YouTube Cookies

## Why do I need to update cookies?

YouTube detects automated requests and blocks them with "Sign in to confirm you're not a bot" errors. Fresh cookies from your logged-in browser session allow yt-dlp to bypass this detection.

## Step-by-Step Guide

### 1. Install Browser Extension

Choose based on your browser:

- **Chrome/Edge/Brave**: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
- **Firefox**: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

### 2. Export YouTube Cookies

1. Go to [youtube.com](https://youtube.com) and make sure you're logged in
2. Click the extension icon in your browser toolbar
3. Click "Export" or "Download" (extension will save a `cookies.txt` file)

### 3. Replace Your cookies.txt File

Replace the `cookies.txt` file in your project root with the newly downloaded file.

### 4. Redeploy

Commit and push the changes, then redeploy on Runway:

```bash
git add cookies.txt
git commit -m "Update YouTube cookies"
git push
```

Runway will automatically redeploy with the fresh cookies.

## How Often Should I Update?

- YouTube cookies typically expire after 1-2 weeks
- Update whenever you see bot detection errors
- Consider updating weekly for best reliability

## Security Note

- Never share your cookies.txt file publicly (it contains your YouTube session)
- Add `cookies.txt` to `.gitignore` if your repo is public
- For production, consider using environment variables or secrets management

## Troubleshooting

**Still getting bot errors after updating?**

- Make sure you're logged into YouTube when exporting
- Try using a different browser
- Clear your browser cache and re-export
- Some videos may be region-restricted regardless of cookies

**Cookies file not working?**

- Verify the file format (should be Netscape format)
- Check file permissions (should be readable)
- Ensure no extra whitespace or formatting issues
