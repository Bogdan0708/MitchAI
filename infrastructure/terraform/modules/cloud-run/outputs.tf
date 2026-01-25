output "api_url" {
  description = "API service URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "api_name" {
  description = "API service name"
  value       = google_cloud_run_v2_service.api.name
}

output "frontend_url" {
  description = "Frontend service URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "frontend_name" {
  description = "Frontend service name"
  value       = google_cloud_run_v2_service.frontend.name
}

output "api_service_account" {
  description = "API service account email"
  value       = google_service_account.api.email
}

output "frontend_service_account" {
  description = "Frontend service account email"
  value       = google_service_account.frontend.email
}
