# AWS Deployment Guide

## AWS Services Setup

### RDS PostgreSQL
```bash
# Create RDS database
aws rds create-db-instance \
  --db-instance-identifier ihuman-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 100 \
  --db-name ihuman_db \
  --publicly-accessible false \
  --backup-retention-period 7 \
  --storage-encrypted true \
  --enable-cloudwatch-logs-exports postgresql

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier ihuman-db \
  --query 'DBInstances[0].Endpoint.Address'
```

### ECR (Container Registry)
```bash
# Create repository
aws ecr create-repository \
  --repository-name ihuman \
  --region us-east-1

# Get login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  123456789.dkr.ecr.us-east-1.amazonaws.com

# Build and push image
docker build -t ihuman:latest .
docker tag ihuman:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/ihuman:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/ihuman:latest
```

### ECS Task Definition
```json
{
  "family": "ihuman-web",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "ihuman-web",
      "image": "123456789.dkr.ecr.us-east-1.amazonaws.com/ihuman:latest",
      "portMappings": [
        {
          "containerPort": 5173,
          "hostPort": 5173,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "DB_HOST",
          "value": "ihuman-db.123456.us-east-1.rds.amazonaws.com"
        },
        {
          "name": "DB_NAME",
          "value": "ihuman_db"
        }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:ihuman-db-password"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:ihuman-jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ihuman",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:5173/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### ECS Cluster and Service
```bash
# Create cluster
aws ecs create-cluster --cluster-name ihuman-prod

# Create log group
aws logs create-log-group --log-group-name /ecs/ihuman

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster ihuman-prod \
  --service-name ihuman-web \
  --task-definition ihuman-web:1 \
  --desired-count 3 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789:targetgroup/ihuman/xxx,containerName=ihuman-web,containerPort=5173"

# Update service
aws ecs update-service \
  --cluster ihuman-prod \
  --service ihuman-web \
  --task-definition ihuman-web:2
```

### CloudFront CDN
```bash
# Create distribution for static assets
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json
```

### Auto Scaling
```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/ihuman-prod/ihuman-web \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 3 \
  --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --policy-name ihuman-scaling-policy \
  --service-namespace ecs \
  --resource-id service/ihuman-prod/ihuman-web \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

## GCP Deployment

### Create GKE Cluster
```bash
# Create cluster
gcloud container clusters create ihuman-prod \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-1 \
  --enable-autorepair \
  --enable-autoupgrade

# Get credentials
gcloud container clusters get-credentials ihuman-prod --zone us-central1-a

# Deploy to cluster
kubectl apply -f kubernetes/
```

### Cloud SQL
```bash
# Create PostgreSQL instance
gcloud sql instances create ihuman-db \
  --database-version POSTGRES_15 \
  --tier db-f1-micro \
  --region us-central1 \
  --storage-auto-increase

# Create database
gcloud sql databases create ihuman_db \
  --instance ihuman-db

# Create user
gcloud sql users create ihuman \
  --instance ihuman-db \
  --password

# Get connection string
gcloud sql instances describe ihuman-db \
  --format='get(ipAddresses[0].ipAddress)'
```

## Azure Deployment

### Create App Service
```bash
# Create resource group
az group create --name ihuman-rg --location eastus

# Create App Service plan
az appservice plan create \
  --name ihuman-plan \
  --resource-group ihuman-rg \
  --sku B2

# Create web app
az webapp create \
  --resource-group ihuman-rg \
  --plan ihuman-plan \
  --name ihuman-web

# Deploy code
az webapp deployment source config-zip \
  --resource-group ihuman-rg \
  --name ihuman-web \
  --src app.zip
```

### Azure Database
```bash
# Create PostgreSQL server
az postgres server create \
  --name ihuman-db-server \
  --resource-group ihuman-rg \
  --location eastus \
  --admin-user dbadmin \
  --admin-password YourSecurePassword123!

# Create database
az postgres db create \
  --name ihuman_db \
  --server-name ihuman-db-server \
  --resource-group ihuman-rg
```

## Monitoring & Alerts

### CloudWatch Alarms (AWS)
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name ihuman-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

### Prometheus (Multi-cloud)
```yaml
# prometheus-config.yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: ihuman
    static_configs:
      - targets: ['localhost:5173']
    metrics_path: '/api/metrics'
```

## Backup Strategy

```bash
# Automated RDS backups (AWS)
# - Daily snapshots
# - Retention: 7 days
# - Multi-AZ enabled

# Manual backup
aws rds create-db-snapshot \
  --db-instance-identifier ihuman-db \
  --db-snapshot-identifier ihuman-db-backup-$(date +%Y%m%d)

# Restore from backup
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier ihuman-db-restored \
  --db-snapshot-identifier ihuman-db-backup-20240205
```

## Cost Optimization

- Use spot instances for non-critical workloads
- Enable auto-scaling
- Use reserved instances for baseline load
- Implement caching (CloudFront, Redis)
- Use serverless options where applicable
- Regular cost audits with AWS Cost Explorer
