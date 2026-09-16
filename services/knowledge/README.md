# Knowledge Integration Bridge

`services/knowledge` is the main-repository **integration bridge** for MarkOrbit Knowledge. It preserves the stable `knowledge` service/package/port identity used by existing integration and deployment code.

The canonical Knowledge domain and Evidence Plane owner is the separate `yoomarks/markorbit-knowledge` repository. That repository owns source acquisition, provenance, evidence versions, evidence-side currentness/readiness and governed evidence export.

This bridge may expose bounded provenance-query / ready-package-consumption compatibility and transport adapters. It must not create a second Knowledge source registry, evidence database, currentness authority, health/readiness hierarchy, Brain/Method interpretation layer or product Workspace authority.

This workspace remains independently deployable. It must not import another service's implementation or read another service's database; integration must use explicit contracts and service boundaries.
