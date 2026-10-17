variable "project_id" {
  description = "The GCP project of this environment."
  type        = string
}

variable "environment" {
  description = "uat or prod."
  type        = string

  validation {
    condition     = contains(["uat", "prod"], var.environment)
    error_message = "environment must be uat or prod."
  }
}

variable "region" {
  description = "Where everything runs; all BigQuery data of both projects is here too."
  type        = string
  default     = "europe-west1"
}

variable "images_project_id" {
  description = "The project that holds the image repository, shared by both environments (TR-PF-18)."
  type        = string
  default     = "immoscoop-dataplatform-398214"
}

variable "artifact_repository" {
  description = "The Artifact Registry repository with the images of the services."
  type        = string
  default     = "datahub"
}

variable "image_tag" {
  description = "The tag of the images to run: tree-<git tree hash>, set by CI (TR-PF-17)."
  type        = string
}

variable "database_tier" {
  description = "The machine type of the Cloud SQL instance."
  type        = string
}

variable "deletion_protection" {
  description = "Protects the database and the services against being deleted, by Terraform or by hand."
  type        = bool
}

variable "token_audience" {
  description = "The audience of the Access Tokens that identity issues and every service checks."
  type        = string
  default     = "datahub"
}
