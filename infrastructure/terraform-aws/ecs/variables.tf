variable "name" {
  description = "Name of the service"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for the service"
  type        = list(string)
}

variable "cluster_name" {
  description = "Name of the ECS cluster"
  type        = string
  default     = "mitch-cluster"
}

variable "create_cluster" {
  description = "Create a new ECS cluster"
  type        = bool
  default     = false
}

variable "existing_cluster_id" {
  description = "ID of existing ECS cluster to use"
  type        = string
  default     = ""
}

variable "container_image" {
  description = "Docker image for the container"
  type        = string
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 3000
}

variable "cpu" {
  description = "CPU units for the task"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memory for the task in MB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 1
}

variable "alb_security_groups" {
  description = "Security group IDs for ALB"
  type        = list(string)
  default     = []
}

variable "target_group_arn" {
  description = "Target group ARN for load balancer"
  type        = string
  default     = ""
}

variable "assign_public_ip" {
  description = "Assign public IP to tasks"
  type        = bool
  default     = true
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/api/v1/health"
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "secret_variables" {
  description = "Secret ARNs to inject as environment variables"
  type        = map(string)
  default     = {}
}

variable "secrets_arns" {
  description = "ARNs of secrets the task can access"
  type        = list(string)
  default     = ["*"]
}

variable "enable_container_insights" {
  description = "Enable Container Insights"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "eu-west-2"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
