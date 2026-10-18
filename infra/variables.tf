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

variable "token_signing_key_versions" {
  description = "The versions of the key that signs Access Tokens, labelled by the year they were made, each ENABLED or DISABLED. The newest enabled version signs (infra/README.md#rotating-the-signing-key)."
  type        = map(string)

  validation {
    condition     = alltrue([for state in values(var.token_signing_key_versions) : contains(["ENABLED", "DISABLED"], state)])
    error_message = "Each version of the signing key is ENABLED or DISABLED."
  }

  validation {
    condition     = contains(values(var.token_signing_key_versions), "ENABLED")
    error_message = "At least one version of the signing key must be enabled, or nobody can sign in."
  }
}

variable "workspace_domain" {
  description = "The only Google Workspace domain whose accounts may sign in (DEC-UM-06)."
  type        = string
  default     = "thenextimmoscoop.be"
}

variable "mcp_redirect_uris" {
  description = "The only callbacks an MCP client may register at identity: Claude's (TR-PF-06)."
  type        = list(string)
  default     = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"]
}

variable "token_audience" {
  description = "The audience of the Access Tokens that identity issues and every service checks."
  type        = string
  default     = "datahub"
}
