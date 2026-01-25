# =============================================================================
# Artifact Registry Module - Docker Image Repository
# =============================================================================

resource "google_artifact_registry_repository" "main" {
  provider      = google-beta
  project       = var.project_id
  location      = var.region
  repository_id = "${var.name_prefix}-docker"
  description   = "Docker repository for Hospitality SaaS"
  format        = "DOCKER"

  labels = var.labels

  # Cleanup policy - keep last 10 versions of each image
  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"

    most_recent_versions {
      package_name_prefixes = ["api", "frontend"]
      keep_count            = 10
    }
  }

  # Delete untagged images older than 7 days
  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }
}

# IAM binding for Cloud Run to pull images
resource "google_artifact_registry_repository_iam_member" "cloud_run_reader" {
  provider   = google-beta
  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.main.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

data "google_project" "current" {
  project_id = var.project_id
}
