import type { Meta, StoryObj } from '@storybook/react';
import { OperationsApp } from './App.js';
import { SuperAdminV2 } from './super-admin-v2/SuperAdminV2.js';
import { SUPER_ADMIN_LOCALE_STORAGE_KEY } from './super-admin-v2/i18n.js';
export default {
  title: 'Products/Operations Console',
  component: OperationsApp,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof OperationsApp>;
export const Overview: StoryObj<typeof OperationsApp> = {};
export const SmallScreen: StoryObj<typeof OperationsApp> = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};

export const SuperAdminV2Overview = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/overview/platform" useBrowserHistory={false} />
);

export const SuperAdminV2DataPartial = () => (
  <SuperAdminV2
    initialPath="/super-admin-v2/data/coverage"
    initialState="partial"
    useBrowserHistory={false}
  />
);

export const SuperAdminV2DataJobs = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/data/jobs" useBrowserHistory={false} />
);

export const SuperAdminV2KnowledgeEvidence = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/knowledge/evidence" useBrowserHistory={false} />
);

export const SuperAdminV2CommandCenter = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/overview/platform" useBrowserHistory={false} />
);

export const SuperAdminV2ControlledRecovery = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/operations/recovery" useBrowserHistory={false} />
);

export const SuperAdminV2IntegrationLayers = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/integrations/switches" useBrowserHistory={false} />
);

export const SuperAdminV2WorkspaceDirectory = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/workspaces/directory" useBrowserHistory={false} />
);

export const SuperAdminV2IdentityRelationships = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/users/relationships" useBrowserHistory={false} />
);

export const SuperAdminV2ProductEntitlements = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/products/entitlements" useBrowserHistory={false} />
);

export const SuperAdminV2BrainRun = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/brain/runs" useBrowserHistory={false} />
);

export const SuperAdminV2CapabilityLineage = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/capabilities/versions" useBrowserHistory={false} />
);

export const SuperAdminV2PaymentOwnerRecord = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/billing/payments" useBrowserHistory={false} />
);

export const SuperAdminV2ProtectedRiskOperation = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/governance/risk" useBrowserHistory={false} />
);

export const SuperAdminV221DeterministicDataQuery = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/data/query" useBrowserHistory={false} />
);

export const SuperAdminV221DeterministicKnowledgeSearch = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/knowledge/search" useBrowserHistory={false} />
);

export const SuperAdminV221MobileEvidenceReview = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/knowledge/evidence" useBrowserHistory={false} />
);
SuperAdminV221MobileEvidenceReview.parameters = { viewport: { defaultViewport: 'mobile1' } };

export const SuperAdminV222RawArtifactSelection = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/knowledge/raw-files" useBrowserHistory={false} />
);

export const SuperAdminV222AddressableTransform = () => (
  <SuperAdminV2
    initialPath="/super-admin-v2/knowledge/transforms?focus=CONV-9813&alert=ALT-7718&return=%2Fsuper-admin-v2%2Foverview%2Falerts"
    useBrowserHistory={false}
  />
);

export const SuperAdminV222UnknownRoute = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/nonexisting/module" useBrowserHistory={false} />
);

export const SuperAdminV223UsageHierarchy = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/overview/usage" useBrowserHistory={false} />
);

export const SuperAdminV223TaskHierarchy = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/data/jobs" useBrowserHistory={false} />
);

export const SuperAdminV223EvidenceHierarchy = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/knowledge/evidence" useBrowserHistory={false} />
);

export const SuperAdminV23RealUnconnectedBoundary = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/data/jobs?mode=real" useBrowserHistory={false} />
);

export const SuperAdminV2Permission = () => (
  <SuperAdminV2
    initialPath="/super-admin-v2/governance/risk"
    initialState="permission"
    useBrowserHistory={false}
  />
);

export const SuperAdminV2Narrow = () => (
  <SuperAdminV2 initialPath="/super-admin-v2/knowledge/evidence" useBrowserHistory={false} />
);
SuperAdminV2Narrow.parameters = { viewport: { defaultViewport: 'mobile1' } };

function bilingualFixture(locale: 'zh-CN' | 'en-US', path: string) {
  window.localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, locale);
  return <SuperAdminV2 initialPath={path} useBrowserHistory={false} />;
}

export const SuperAdminV2ChineseEvidenceFixture = () =>
  bilingualFixture('zh-CN', '/super-admin-v2/knowledge/evidence');

export const SuperAdminV2EnglishEvidenceFixture = () =>
  bilingualFixture('en-US', '/super-admin-v2/knowledge/evidence');

export const SuperAdminV2EnglishDataJobsFixture = () =>
  bilingualFixture('en-US', '/super-admin-v2/data/jobs');

export const SuperAdminV2ChineseMobileFixture = () =>
  bilingualFixture('zh-CN', '/super-admin-v2/data/jobs');
SuperAdminV2ChineseMobileFixture.parameters = { viewport: { defaultViewport: 'mobile1' } };
