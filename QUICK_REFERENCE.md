# OpenShift Quick Reference

## 🚀 Quick Deploy

```bash
# Build and push
docker build -t ultimate-playlist-merger:latest .
docker push <registry>/ultimate-playlist-merger:latest

# Deploy to OpenShift
oc create deployment ultimate-playlist-merger --image=<registry>/ultimate-playlist-merger:latest
oc expose deployment ultimate-playlist-merger --port=8080
oc expose service ultimate-playlist-merger

# Add health probes
oc set probe deployment/ultimate-playlist-merger --readiness --get-url=http://:8080/health
oc set probe deployment/ultimate-playlist-merger --liveness --get-url=http://:8080/health
```

## 🔍 Quick Test

```bash
# Get route
ROUTE=$(oc get route ultimate-playlist-merger -o jsonpath='{.spec.host}')

# Test endpoints
curl https://$ROUTE/health        # Should return: {"status":"healthy"}
curl https://$ROUTE/api/status    # Should return detailed status
curl https://$ROUTE/               # Should return HTML page
```

## 📊 Key Endpoints

| Endpoint                 | Purpose             | Response               |
| ------------------------ | ------------------- | ---------------------- |
| `GET /`                  | Main app            | HTML page              |
| `GET /health`            | Health check        | `{"status":"healthy"}` |
| `GET /api/status`        | Detailed status     | JSON with diagnostics  |
| `POST /create-job`       | Create playlist job | `{"job_id":"..."}`     |
| `POST /create-video-job` | Create video job    | `{"job_id":"..."}`     |
| `GET /status/{job_id}`   | Job status          | Job progress           |
| `GET /download/{job_id}` | Download result     | MP3 file               |

## 🔧 Key Changes

| What            | Before             | After                 |
| --------------- | ------------------ | --------------------- |
| Temp path       | `/app/temp` ❌     | `/tmp/temp` ✅        |
| Cookies         | `./cookies.txt` ❌ | `/tmp/cookies.txt` ✅ |
| User            | root ❌            | UID 1001 ✅           |
| Health endpoint | None ❌            | `/health` ✅          |
| Port            | 8000 ❌            | 8080 ✅               |

## 🐛 Troubleshooting

### Route not working?

```bash
# Check pod
oc get pods -l app=ultimate-playlist-merger

# Check logs
oc logs -f deployment/ultimate-playlist-merger

# Look for: "✓ Application startup complete"
```

### Permission errors?

```bash
# Check user
oc exec deployment/ultimate-playlist-merger -- id
# Should show: uid=1001 or another non-root UID

# Check temp directory
oc logs deployment/ultimate-playlist-merger | grep TEMP_ROOT
# Should show: writable: True
```

### Cookies not working?

```bash
# Create secret
oc create secret generic youtube-cookies --from-file=cookies.txt

# Mount secret
oc set volume deployment/ultimate-playlist-merger \
  --add --type=secret --secret-name=youtube-cookies \
  --mount-path=/tmp/cookies.txt --sub-path=cookies.txt
```

## 📝 Logs to Look For

**Successful startup:**

```
=== OpenShift Startup Diagnostics ===
PORT: 8080
TEMP_ROOT: /tmp/temp (exists: True, writable: True)
COOKIES_PATH: /tmp/cookies.txt (exists: True)
ffmpeg (PATH): /usr/bin/ffmpeg
✓ Application startup complete - ready to accept requests
```

**Health check working:**

```
INFO:     127.0.0.1:xxxxx - "GET /health HTTP/1.1" 200 OK
```

## 🎯 Success Criteria

- [ ] Pod status: `Running` with `1/1` ready
- [ ] Logs show: "✓ Application startup complete"
- [ ] `curl https://$ROUTE/health` returns 200
- [ ] External route loads in browser
- [ ] Can create and download jobs

## 📚 Documentation

- **Full deployment guide:** `OPENSHIFT_DEPLOYMENT.md`
- **All changes explained:** `OPENSHIFT_FIXES.md`
- **Complete summary:** `CHANGES_SUMMARY.md`
- **Automated tests:** `test_openshift_endpoints.py`

## 🆘 Still Having Issues?

1. Read `OPENSHIFT_DEPLOYMENT.md` troubleshooting section
2. Check pod logs: `oc logs deployment/ultimate-playlist-merger`
3. Check events: `oc get events --sort-by='.lastTimestamp'`
4. Describe pod: `oc describe pod -l app=ultimate-playlist-merger`
5. Test from inside cluster:
   ```bash
   oc run test --image=curlimages/curl --rm -it -- \
     curl http://ultimate-playlist-merger:8080/health
   ```

## ✅ Compatibility

| Platform  | Status | Notes               |
| --------- | ------ | ------------------- |
| OpenShift | ✅     | Fully compatible    |
| Railway   | ✅     | No breaking changes |
| Docker    | ✅     | Works as before     |
| Local Dev | ✅     | Works as before     |

## 🔐 Security

- ✅ Non-root user (UID 1001)
- ✅ Read-only filesystem (except `/tmp`)
- ✅ No privileged access
- ✅ Secrets via OpenShift secrets
- ✅ Proper file permissions

---

**Need more details?** See the full documentation files listed above.
