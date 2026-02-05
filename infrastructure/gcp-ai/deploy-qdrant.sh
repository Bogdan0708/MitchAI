#!/bin/bash
# =============================================================================
# Deploy Qdrant Vector DB to Compute Engine
# =============================================================================

set -e

PROJECT_ID="mitch-ai-services"
REGION="europe-west2"
ZONE="${REGION}-a"
INSTANCE_NAME="qdrant-server"
MACHINE_TYPE="e2-small"  # 2 vCPU, 2GB RAM - $15/mo

echo "🚀 Deploying Qdrant to Compute Engine..."

# Check if instance exists
if gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID >/dev/null 2>&1; then
  echo "⚠️  Instance $INSTANCE_NAME already exists"
  read -p "Delete and recreate? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    gcloud compute instances delete $INSTANCE_NAME --zone=$ZONE --project=$PROJECT_ID --quiet
  else
    echo "Aborting."
    exit 1
  fi
fi

# Create instance with container
gcloud compute instances create-with-container $INSTANCE_NAME \
  --project=$PROJECT_ID \
  --zone=$ZONE \
  --machine-type=$MACHINE_TYPE \
  --container-image=qdrant/qdrant:latest \
  --container-mount-host-path=host-path=/mnt/disks/qdrant,mount-path=/qdrant/storage \
  --boot-disk-size=20GB \
  --boot-disk-type=pd-ssd \
  --tags=qdrant-server \
  --metadata=google-logging-enabled=true

echo "⏳ Waiting for instance to start..."
sleep 30

# Get internal IP
INTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME \
  --zone=$ZONE \
  --project=$PROJECT_ID \
  --format='get(networkInterfaces[0].networkIP)')

echo ""
echo "=========================================="
echo "✅ Qdrant deployed!"
echo "=========================================="
echo ""
echo "Instance: $INSTANCE_NAME"
echo "Internal IP: $INTERNAL_IP"
echo "Qdrant URL: http://$INTERNAL_IP:6333"
echo ""
echo "Test (from Cloud Run or another GCP VM):"
echo "  curl http://$INTERNAL_IP:6333/health"
echo ""
echo "⚠️  Note: Qdrant is only accessible within GCP (internal IP)"
echo "   Cloud Run will connect via VPC connector"
