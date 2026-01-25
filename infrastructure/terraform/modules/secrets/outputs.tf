output "db_password_secret_id" {
  description = "Database password secret ID"
  value       = google_secret_manager_secret.secrets["db_password"].id
}

output "db_password_secret_name" {
  description = "Database password secret name (for reference)"
  value       = google_secret_manager_secret.secrets["db_password"].secret_id
}

output "db_connection_string_secret_id" {
  description = "Database connection string secret ID"
  value       = google_secret_manager_secret.secrets["db_connection_string"].id
}

output "jwt_secret_id" {
  description = "JWT secret ID"
  value       = google_secret_manager_secret.secrets["jwt_secret"].id
}

output "stripe_secret_key_id" {
  description = "Stripe secret key secret ID"
  value       = google_secret_manager_secret.secrets["stripe_secret_key"].id
}

output "stripe_webhook_secret_id" {
  description = "Stripe webhook secret ID"
  value       = google_secret_manager_secret.secrets["stripe_webhook_secret"].id
}

output "openai_api_key_id" {
  description = "OpenAI API key secret ID"
  value       = google_secret_manager_secret.secrets["openai_api_key"].id
}

output "anthropic_api_key_id" {
  description = "Anthropic API key secret ID"
  value       = google_secret_manager_secret.secrets["anthropic_api_key"].id
}

output "perplexity_api_key_id" {
  description = "Perplexity API key secret ID"
  value       = google_secret_manager_secret.secrets["perplexity_api_key"].id
}

output "sendgrid_api_key_id" {
  description = "SendGrid API key secret ID"
  value       = google_secret_manager_secret.secrets["sendgrid_api_key"].id
}

output "n8n_password_secret_id" {
  description = "n8n password secret ID"
  value       = google_secret_manager_secret.secrets["n8n_password"].id
}

output "qdrant_api_key_id" {
  description = "Qdrant API key secret ID"
  value       = google_secret_manager_secret.secrets["qdrant_api_key"].id
}

# Generated values (for initial setup reference)
output "generated_db_password" {
  description = "Generated database password (use only for initial setup)"
  value       = random_password.db_password.result
  sensitive   = true
}

output "generated_jwt_secret" {
  description = "Generated JWT secret (use only for initial setup)"
  value       = random_password.jwt_secret.result
  sensitive   = true
}

output "generated_n8n_password" {
  description = "Generated n8n password (use only for initial setup)"
  value       = random_password.n8n_password.result
  sensitive   = true
}
