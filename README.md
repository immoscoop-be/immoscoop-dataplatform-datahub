# immoscoop-dataplatform-datahub

The Data Hub repository: the library of our data, the one entry point for business colleagues and their Claude.

Documentation, including all requirements and the architecture, is in [`docs/`](docs/README.md).

## Getting started

```sh
corepack enable        # provides pnpm
pnpm install
pnpm check             # type-check, test, and check the documentation
```

Node 24 is required (see `.node-version`). How the services are built into images and deployed is in [Build and deploy](docs/architecture/build-and-deploy.md).
