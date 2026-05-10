# OpenShift Deployment Guide

## Quick Start

This application is now fully OpenShift-compatible with the following features:

✅ Non-root user support (runs as UID 1001 or arbitrary UID)  
✅ Writable directories use `/tmp` (OpenShift default writable location)  
✅ Health check endpoints for router probes  
✅ Comprehensive startup logging  
✅ Graceful handling of missing dependencies  
✅ Port 8080 (OpenShift default)

## Prerequisites

- OpenShift cluster access
- Docker registry access (or OpenShift internal registry)
- `oc` CLI tool installed

## Deployment Steps

### 1. Build and Push Image

```bash
# Build the image
docker build -t ultimate-playlist-merger:latest .

# Tag for your registry
docker tag ultimate-playlist-merger:latest <your-registry>/ultimate-playlist-merger:latest

# Push to registry
docker push <your-registry>/ultimate-playlist-merger:latest
```

### 2. Create OpenShift Resources

#### Create Deployment

```bash
oc create deployment ultimate-playlist-merger \
  --image=<your-registry>/ultimate-playlist-merger:latest \
  --port=8080
```

#### Create Service

```bash
oc expose deployment ultimate-playlist-merger \
  --port=8080 \
  --target-port=8080 \
  --name=ultimate-playlist-merger
```

#### Create Route

```bash
oc expose service ultimate-playlist-merger \
  --hostname=your-desired-hostname.apps.your-cluster.com
```

Or let OpenShift generate a hostname:

```bash
oc expose service ultimate-playlist-merger
```

### 3. Configure Health Probes (Recommended)

Add liveness and readiness probes to your deployment:

```bash
# Readiness probe (is the app ready to serve traffic?)
oc set probe deployment/ultimate-playlist-merger \
  --readiness \
  --get-url=http://:8080/health \
  --initial-delay-seconds=10 \
  --period-seconds=10 \
  --timeout-seconds=5 \
  --failure-threshold=3

# Liveness probe (is the app still running?)
oc set probe deployment/ultimate-playlist-merger \
  --liveness \
  --get-url=http://:8080/health \
  --initial-delay-seconds=30 \
  --period-seconds=30 \
  --timeout-seconds=5 \
  --failure-threshold=3
```

### 4. Optional: Add Cookies for YouTube Access

If you want to use YouTube cookies for better access:

```bash
# Create secret from your cookies.txt file
oc create secret generic youtube-cookies --from-file=cookies.txt

# Mount the secret as a file
oc set volume deployment/ultimate-playlist-merger \
  --add \
  --type=secret \
  --secret-name=youtube-cookies \
  --mount-path=/tmp/cookies.txt \
  --sub-path=cookies.txt
```

### 5. Optional: Configure Environment Variables

```bash
# Set bgutil provider URL (if using)
oc set env deployment/ultimate-playlist-merger \
  BGUTIL_PROVIDER_URL=http://your-bgutil-service:4416

# Set log level
oc set env deployment/ultimate-playlist-merger \
  LOG_LEVEL=INFO
```

## Verification

### Check Pod Status

```bash
oc get pods -l app=ultimate-playlist-merger
```

### View Logs

```bash
# Follow logs
oc logs -f deployment/ultimate-playlist-merger

# Look for this line in logs:
# ✓ Application startup complete - ready to accept requests
```

### Test Endpoints

```bash
# Get your route URL
ROUTE_URL=$(oc get route ultimate-playlist-merger -o jsonpath='{.spec.host}')

# Test health endpoint
curl https://$ROUTE_URL/health

# Expected response:
# {"status":"healthy","service":"ultimate-playlist-merger"}

# Test API status endpoint
curl https://$ROUTE_URL/api/status

# Test main page
curl https://$ROUTE_URL/
```

### Run Automated Tests

```bash
# Install requests if needed
pip install requests

# Run test script
python test_openshift_endpoints.py https://$ROUTE_URL
```

## Troubleshooting

### Route Shows "Application is not available"

1. **Check pod status:**

   ```bash
   oc get pods -l app=ultimate-playlist-merger
   ```

   Pod should be in `Running` state with `1/1` ready.

2. **Check pod logs:**

   ```bash
   oc logs deployment/ultimate-playlist-merger
   ```

   Look for startup errors or permission issues.

3. **Check service endpoints:**

   ```bash
   oc get endpoints ultimate-playlist-merger
   ```

   Should show the pod IP and port 8080.

4. **Test from within cluster:**

   ```bash
   oc run test-pod --image=curlimages/curl --rm -it --restart=Never -- \
     curl http://ultimate-playlist-merger:8080/health
   ```

5. **Check route configuration:**
   ```bash
   oc describe route ultimate-playlist-merger
   ```

### Permission Errors in Logs

If you see permission errors:

```bash
# Check if pod is running as non-root
oc exec deployment/ultimate-playlist-merger -- id

# Should show UID 1001 or another non-root UID
```

### Temp Directory Not Writable

The app uses `/tmp/temp` which should always be writable in OpenShift. Check logs:

```bash
oc logs deployment/ultimate-playlist-merger | grep TEMP_ROOT
```

Should show:

```
TEMP_ROOT: /tmp/temp (exists: True, writable: True)
```

### Cookies Not Found

If you need cookies for YouTube access:

```bash
# Check if secret is mounted
oc exec deployment/ultimate-playlist-merger -- ls -la /tmp/cookies.txt

# Check logs
oc logs deployment/ultimate-playlist-merger | grep cookies
```

## YAML Deployment (Alternative)

Create a file `openshift-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ultimate-playlist-merger
  labels:
    app: ultimate-playlist-merger
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ultimate-playlist-merger
  template:
    metadata:
      labels:
        app: ultimate-playlist-merger
    spec:
      containers:
        - name: app
          image: <your-registry>/ultimate-playlist-merger:latest
          ports:
            - containerPort: 8080
              protocol: TCP
          env:
            - name: PORT
              value: "8080"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
          volumeMounts:
            - name: cookies
              mountPath: /tmp/cookies.txt
              subPath: cookies.txt
              readOnly: true
      volumes:
        - name: cookies
          secret:
            secretName: youtube-cookies
            optional: true
---
apiVersion: v1
kind: Service
metadata:
  name: ultimate-playlist-merger
  labels:
    app: ultimate-playlist-merger
spec:
  ports:
    - name: http
      port: 8080
      targetPort: 8080
      protocol: TCP
  selector:
    app: ultimate-playlist-merger
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: ultimate-playlist-merger
  labels:
    app: ultimate-playlist-merger
spec:
  to:
    kind: Service
    name: ultimate-playlist-merger
  port:
    targetPort: http
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
```

Deploy with:

```bash
oc apply -f openshift-deployment.yaml
```

## Monitoring

### Check Application Status

```bash
# Get route URL
oc get route ultimate-playlist-merger

# Check detailed status
curl https://$(oc get route ultimate-playlist-merger -o jsonpath='{.spec.host}')/api/status
```

### View Metrics

```bash
# CPU and Memory usage
oc adm top pod -l app=ultimate-playlist-merger
```

### Scale Application

```bash
# Scale to 2 replicas
oc scale deployment ultimate-playlist-merger --replicas=2

# Auto-scale based on CPU
oc autoscale deployment ultimate-playlist-merger \
  --min=1 --max=5 --cpu-percent=80
```

## Security Considerations

1. **Non-root User**: Application runs as UID 1001 (or arbitrary UID in OpenShift)
2. **Read-only Filesystem**: Only `/tmp` is writable
3. **No Privileged Access**: Container doesn't require elevated privileges
4. **Secrets Management**: Cookies stored in OpenShift secrets, not in image
5. **Network Policies**: Consider adding network policies to restrict traffic

## Performance Tuning

### Resource Limits

Adjust based on your workload:

```bash
oc set resources deployment/ultimate-playlist-merger \
  --requests=cpu=500m,memory=1Gi \
  --limits=cpu=2000m,memory=4Gi
```

### Persistent Storage (Optional)

If you want to persist downloaded files:

```bash
# Create PVC
oc create -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: playlist-storage
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
EOF

# Mount to deployment
oc set volume deployment/ultimate-playlist-merger \
  --add --type=persistentVolumeClaim \
  --claim-name=playlist-storage \
  --mount-path=/tmp/temp
```

## Cleanup

```bash
# Delete all resources
oc delete deployment ultimate-playlist-merger
oc delete service ultimate-playlist-merger
oc delete route ultimate-playlist-merger
oc delete secret youtube-cookies
```

## Support

For issues specific to OpenShift deployment, check:

- Pod logs: `oc logs deployment/ultimate-playlist-merger`
- Events: `oc get events --sort-by='.lastTimestamp'`
- Pod description: `oc describe pod -l app=ultimate-playlist-merger`
