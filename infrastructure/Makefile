# =============================================================================
# Hospitality SaaS - Infrastructure Makefile
# =============================================================================
# Quick commands for common deployment operations
#
# Usage:
#   make setup PROJECT=my-project BILLING=01XXXX-XXXXXX
#   make deploy ENV=staging
#   make status ENV=production
# =============================================================================

.PHONY: help setup deploy destroy status secrets build push migrate

# Default values
ENV ?= staging
PROJECT ?= $(shell gcloud config get-value project 2>/dev/null)
REGION ?= us-central1
BILLING ?=

# Derived values
PREFIX = hospitality-saas-$(if $(filter production,$(ENV)),prod,staging)
REGISTRY = $(REGION)-docker.pkg.dev/$(PROJECT)/$(PREFIX)-docker
TAG ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)

help: ## Show this help
	@echo "Hospitality SaaS Infrastructure"
	@echo ""
	@echo "Usage: make <target> [ENV=staging|production] [PROJECT=xxx]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# =============================================================================
# Setup
# =============================================================================

setup: ## Initial GCP project setup
	@echo "Setting up GCP project: $(PROJECT)"
	@./scripts/setup-gcp.sh $(PROJECT) $(BILLING)

check-prereqs: ## Check required tools are installed
	@command -v gcloud >/dev/null 2>&1 || { echo "gcloud not installed"; exit 1; }
	@command -v terraform >/dev/null 2>&1 || { echo "terraform not installed"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "docker not installed"; exit 1; }
	@echo "All prerequisites installed ✓"

# =============================================================================
# Terraform
# =============================================================================

tf-init: ## Initialize Terraform
	cd terraform && terraform init

tf-plan: ## Plan Terraform changes
	cd terraform && terraform plan -var="environment=$(ENV)"

tf-apply: ## Apply Terraform changes
	cd terraform && terraform apply -var="environment=$(ENV)"

tf-destroy: ## Destroy Terraform infrastructure (DANGEROUS)
	@echo "WARNING: This will destroy all infrastructure!"
	@read -p "Type 'destroy' to confirm: " confirm && [ "$$confirm" = "destroy" ]
	cd terraform && terraform destroy -var="environment=$(ENV)"

tf-output: ## Show Terraform outputs
	cd terraform && terraform output

# =============================================================================
# Docker
# =============================================================================

docker-auth: ## Configure Docker for GCP Artifact Registry
	gcloud auth configure-docker $(REGION)-docker.pkg.dev --quiet

build: docker-auth ## Build all Docker images
	@echo "Building API image..."
	docker build -t $(REGISTRY)/api:$(TAG) -t $(REGISTRY)/api:latest --target production ..
	@echo "Building Frontend image..."
	docker build -t $(REGISTRY)/frontend:$(TAG) -t $(REGISTRY)/frontend:latest ../frontend

push: ## Push all Docker images
	docker push $(REGISTRY)/api:$(TAG)
	docker push $(REGISTRY)/api:latest
	docker push $(REGISTRY)/frontend:$(TAG)
	docker push $(REGISTRY)/frontend:latest

build-push: build push ## Build and push all images

# =============================================================================
# Database
# =============================================================================

migrate: ## Run database migrations
	@echo "Starting Cloud SQL Proxy..."
	@SQL_CONN=$$(cd terraform && terraform output -raw cloud_sql_connection_name) && \
	DB_PASS=$$(gcloud secrets versions access latest --secret=$(PREFIX)-db-password) && \
	cloud-sql-proxy $$SQL_CONN --port=5432 & \
	sleep 5 && \
	DATABASE_URL="postgresql://hospitality_admin:$$DB_PASS@localhost:5432/hospitality_db" npm run db:migrate --prefix=.. && \
	pkill -f cloud-sql-proxy || true

db-shell: ## Connect to database shell
	@SQL_CONN=$$(cd terraform && terraform output -raw cloud_sql_connection_name) && \
	DB_PASS=$$(gcloud secrets versions access latest --secret=$(PREFIX)-db-password) && \
	cloud-sql-proxy $$SQL_CONN --port=5432 & \
	sleep 5 && \
	PGPASSWORD=$$DB_PASS psql -h localhost -U hospitality_admin -d hospitality_db

# =============================================================================
# Deployment
# =============================================================================

deploy: check-prereqs tf-apply build-push migrate deploy-run ## Full deployment (infra + app)
	@echo "Deployment complete!"
	@make urls

deploy-app: build-push deploy-run ## Deploy only application (skip infra)
	@echo "App deployment complete!"
	@make urls

deploy-run: ## Deploy to Cloud Run
	@echo "Deploying API..."
	gcloud run deploy $(PREFIX)-api \
		--image=$(REGISTRY)/api:$(TAG) \
		--region=$(REGION) \
		--platform=managed \
		--allow-unauthenticated \
		--quiet
	@echo "Deploying Frontend..."
	@API_URL=$$(gcloud run services describe $(PREFIX)-api --region=$(REGION) --format='value(status.url)') && \
	gcloud run deploy $(PREFIX)-frontend \
		--image=$(REGISTRY)/frontend:$(TAG) \
		--region=$(REGION) \
		--platform=managed \
		--allow-unauthenticated \
		--set-env-vars="NEXT_PUBLIC_API_URL=$$API_URL/api/v1" \
		--quiet

# =============================================================================
# Status & Monitoring
# =============================================================================

status: ## Show deployment status
	@echo "Cloud Run Services:"
	@gcloud run services list --filter="metadata.name~$(PREFIX)" --format="table(metadata.name,status.url,status.conditions[0].status)"
	@echo ""
	@echo "Cloud SQL Instances:"
	@gcloud sql instances list --filter="name~$(PREFIX)" --format="table(name,state,settings.tier)"
	@echo ""
	@echo "Compute Engine VMs:"
	@gcloud compute instances list --filter="name~$(PREFIX)" --format="table(name,status,zone,networkInterfaces[0].accessConfigs[0].natIP)"

urls: ## Show deployment URLs
	@echo ""
	@echo "Deployment URLs:"
	@echo "  API:      $$(gcloud run services describe $(PREFIX)-api --region=$(REGION) --format='value(status.url)' 2>/dev/null || echo 'Not deployed')"
	@echo "  Frontend: $$(gcloud run services describe $(PREFIX)-frontend --region=$(REGION) --format='value(status.url)' 2>/dev/null || echo 'Not deployed')"
	@echo "  n8n:      http://$$(gcloud compute instances list --filter='name~$(PREFIX)-n8n' --format='value(networkInterfaces[0].accessConfigs[0].natIP)' 2>/dev/null || echo 'Not deployed'):5678"
	@echo ""

health: ## Check API health
	@API_URL=$$(gcloud run services describe $(PREFIX)-api --region=$(REGION) --format='value(status.url)') && \
	echo "Checking $$API_URL/api/v1/health..." && \
	curl -s "$$API_URL/api/v1/health" | jq .

logs-api: ## Tail API logs
	gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$(PREFIX)-api" --limit=50 --format="table(timestamp,textPayload)"

logs-frontend: ## Tail Frontend logs
	gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$(PREFIX)-frontend" --limit=50 --format="table(timestamp,textPayload)"

# =============================================================================
# Secrets
# =============================================================================

secrets-list: ## List all secrets
	@echo "Secrets for $(ENV):"
	@gcloud secrets list --filter="name~$(PREFIX)" --format="table(name,createTime)"

secrets-set: ## Set a secret (usage: make secrets-set NAME=stripe-secret-key)
ifndef NAME
	$(error NAME is required. Usage: make secrets-set NAME=stripe-secret-key)
endif
	@echo "Enter value for $(NAME):"
	@read -s value && echo -n "$$value" | gcloud secrets versions add $(PREFIX)-$(NAME) --data-file=-
	@echo "Secret updated ✓"

# =============================================================================
# SSH
# =============================================================================

ssh-n8n: ## SSH into n8n VM
	gcloud compute ssh $(PREFIX)-n8n-vm --zone=$(REGION)-a

# =============================================================================
# Cleanup
# =============================================================================

destroy: tf-destroy ## Destroy all infrastructure (DANGEROUS)
	@echo "Infrastructure destroyed"

clean: ## Clean local build artifacts
	rm -rf terraform/.terraform
	rm -f terraform/tfplan
	rm -f terraform/*.tfstate*
	docker system prune -f
