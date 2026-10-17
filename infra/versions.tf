terraform {
  required_version = "~> 1.16"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.7"
    }
  }

  # The bucket is passed at init: terraform init -backend-config="bucket=<TF_STATE_BUCKET>".
  # Each environment has its own bucket in its own project (docs/architecture/gcp-setup.md).
  backend "gcs" {
    prefix = "datahub"
  }
}
