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
  description = "The main domain of the Google Workspace, where the Role Groups such as the Data Team live."
  type        = string
  default     = "thenextimmoscoop.be"
}

variable "workspace_domains" {
  description = "The Google Workspace domains whose accounts may sign in: both domains of the one Workspace (DEC-UM-09)."
  type        = list(string)
  default     = ["thenextimmoscoop.be", "immoscoop.be"]

  validation {
    condition     = length(var.workspace_domains) > 0 && alltrue([for domain in var.workspace_domains : can(regex("^[a-z0-9.-]+$", domain))])
    error_message = "At least one domain, in lower case, or nobody can sign in."
  }
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

variable "dbt_cloud_url" {
  description = "The access URL of the dbt Cloud account that holds the Source Jobs."
  type        = string
  default     = "https://emea.dbt.com"
}

variable "dbt_account_id" {
  description = "The dbt Cloud account of the Source Jobs (DEC-AR-01)."
  type        = string
  default     = "576"
}

variable "dbt_source_jobs" {
  description = "The Source Job of each dbt project for this environment, dbt project ID => job ID (DEC-AR-01)."
  type        = map(string)

  validation {
    condition     = alltrue([for project, job in var.dbt_source_jobs : can(regex("^[0-9]+$", project)) && can(regex("^[0-9]+$", job))])
    error_message = "dbt projects and jobs are named by their numeric IDs."
  }
}

variable "mail_from" {
  description = "Who the e-mail of Data Hub comes from: an address of a Workspace domain whose replies are not read (DEC-PF-31)."
  type        = string

  validation {
    condition     = can(regex("^[^<>@]+ <[a-z0-9._-]+@[a-z0-9.-]+>$", var.mail_from)) && contains(var.workspace_domains, try(regex("@([a-z0-9.-]+)>$", var.mail_from)[0], ""))
    error_message = "A name and an address of a Workspace domain, such as Data Hub <datahub@immoscoop.be>: the relay sends for these only."
  }
}
