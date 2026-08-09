from pathlib import Path

path = Path('services/mgsn/tests/provider-registry-postgres.test.ts')
text = path.read_text()
old = """import {
  ProviderRegistryError,
  ProviderRegistryService,
  isSupplyOperationallyEligibleAt,
  providerRegistryAuthorityConsequences,
  type CoreWorkspaceIdentityReference
} from '../src/provider-registry.js';"""
new = """import {
  ProviderRegistryService,
  isSupplyOperationallyEligibleAt,
  providerRegistryAuthorityConsequences,
  type CoreWorkspaceIdentityReference,
  type ProviderRegistryError
} from '../src/provider-registry.js';"""
if old not in text:
    raise SystemExit('provider registry import block not found')
text = text.replace(old, new, 1)
old = """        getWorkspace: async (workspaceId) => {
          const value = core.get(workspaceId);
          return value ? structuredClone(value) : undefined;
        }"""
new = """        getWorkspace: (workspaceId) => {
          const value = core.get(workspaceId);
          return Promise.resolve(value ? structuredClone(value) : undefined);
        }"""
if old not in text:
    raise SystemExit('Core Workspace fixture block not found')
path.write_text(text.replace(old, new, 1))

# Repository diff policy rejects trailing whitespace, including Markdown hard-break spaces.
evidence = Path('docs/tasks/MO-MVP-M4-WP-03-DURABLE-MGSN-PROVIDER-REGISTRY.md')
lines = evidence.read_text().splitlines()
evidence.write_text('\n'.join(line.rstrip() for line in lines) + '\n')
