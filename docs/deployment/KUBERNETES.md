# Kubernetes Deployment Guide

## Kubernetes Manifests

### Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ihuman
```

### ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ihuman-config
  namespace: ihuman
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  PORT: "5173"
  CORS_ORIGIN: "https://yourdomain.com"
```

### Secret
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ihuman-secrets
  namespace: ihuman
type: Opaque
stringData:
  JWT_SECRET: "your-very-secure-secret-key-here"
  DB_PASSWORD: "secure-db-password"
  SENTRY_DSN: "your-sentry-dsn"
  DATADOG_API_KEY: "your-datadog-key"
```

### PostgreSQL StatefulSet
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ihuman-db
  namespace: ihuman
spec:
  serviceName: ihuman-db
  replicas: 1
  selector:
    matchLabels:
      app: ihuman-db
  template:
    metadata:
      labels:
        app: ihuman-db
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: ihuman_db
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: ihuman-secrets
              key: DB_PASSWORD
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
        - name: init-script
          mountPath: /docker-entrypoint-initdb.d
        livenessProbe:
          exec:
            command: ["pg_isready", "-U", "postgres"]
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command: ["pg_isready", "-U", "postgres"]
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: init-script
        configMap:
          name: ihuman-db-init
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ihuman-web
  namespace: ihuman
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: ihuman-web
  template:
    metadata:
      labels:
        app: ihuman-web
    spec:
      serviceAccountName: ihuman-web
      containers:
      - name: web
        image: ihuman:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 5173
          name: http
        envFrom:
        - configMapRef:
            name: ihuman-config
        env:
        - name: DB_HOST
          value: ihuman-db-0.ihuman-db.ihuman.svc.cluster.local
        - name: DB_USER
          value: postgres
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: ihuman-secrets
              key: DB_PASSWORD
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: ihuman-secrets
              key: JWT_SECRET
        livenessProbe:
          httpGet:
            path: /api/health
            port: 5173
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 5173
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Service
```yaml
apiVersion: v1
kind: Service
metadata:
  name: ihuman-web
  namespace: ihuman
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 5173
    protocol: TCP
  selector:
    app: ihuman-web
```

### Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ihuman-ingress
  namespace: ihuman
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - yourdomain.com
    secretName: ihuman-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ihuman-web
            port:
              number: 80
```

## Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace ihuman

# Apply configurations
kubectl apply -f config-map.yaml
kubectl apply -f secret.yaml
kubectl apply -f statefulset-db.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# Check status
kubectl get pods -n ihuman
kubectl get svc -n ihuman
kubectl get ingress -n ihuman

# View logs
kubectl logs -f deployment/ihuman-web -n ihuman

# Port forward (local testing)
kubectl port-forward svc/ihuman-web 5173:80 -n ihuman

# Scale replicas
kubectl scale deployment ihuman-web --replicas=5 -n ihuman

# Rollout updates
kubectl set image deployment/ihuman-web web=ihuman:v2 -n ihuman
kubectl rollout history deployment/ihuman-web -n ihuman
kubectl rollout undo deployment/ihuman-web -n ihuman
```

## Monitoring

```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ihuman-monitor
  namespace: ihuman
spec:
  selector:
    matchLabels:
      app: ihuman-web
  endpoints:
  - port: http
    path: /api/metrics
    interval: 30s
```

## Auto-scaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ihuman-web-hpa
  namespace: ihuman
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ihuman-web
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```
