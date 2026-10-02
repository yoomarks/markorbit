import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { TradingDirectionSelectionV1 } from '@markorbit/contracts/trading-direction-selection';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import type { TradingStudioClient, TradingStudioState } from '../api/trading-studio.js';
import { TradingStudioHttpError } from '../api/trading-studio.js';
import type {
  CreativePilotScenario,
  DemoDraftStorage
} from '../features/trading-studio/TradingSellerValidationFlow.js';
import { TradingStudio } from '../features/trading-studio/TradingStudio.js';
import {
  selectedTradingStudioPreviewState,
  tradingStudioPreviewState,
  TRADING_STUDIO_PREVIEW_RUN_ID,
  TRADING_STUDIO_PREVIEW_WORKSPACE_ID
} from '../features/trading-studio/preview-fixture.js';

type PreviewScenario =
  | CreativePilotScenario
  | 'DIRECTIONS'
  | 'EMPTY'
  | 'LEGACY_PROFILE'
  | 'PERMISSION'
  | 'STALE'
  | 'STORAGE_FAILURE';

const scenarios = new Set<PreviewScenario>([
  'CAPABILITY_UNAVAILABLE',
  'NO_MATERIALS',
  'PARTIAL',
  'RUNNING',
  'QA_FAILED',
  'SAVED',
  'DIRECTIONS',
  'EMPTY',
  'LEGACY_PROFILE',
  'PERMISSION',
  'STALE',
  'STORAGE_FAILURE'
]);

const unavailableStorage: DemoDraftStorage = {
  getItem(): string | null {
    throw new Error('Demo storage unavailable');
  },
  setItem(): void {
    throw new Error('Demo storage unavailable');
  },
  removeItem(): void {
    throw new Error('Demo storage unavailable');
  }
};

function stateForScenario(scenario: PreviewScenario): TradingStudioState | Error {
  if (scenario === 'PERMISSION')
    return new TradingStudioHttpError(403, 'PERMISSION_DENIED', 'Forbidden');
  if (scenario === 'DIRECTIONS') return tradingStudioPreviewState;

  const selected = selectedTradingStudioPreviewState();
  if (scenario === 'EMPTY') return { ...selected, directionSet: null, selection: null };
  if (scenario === 'STALE')
    return {
      ...selected,
      run: { ...selected.run, currentness: 'STALE' }
    };
  if (scenario === 'LEGACY_PROFILE')
    return {
      ...selected,
      aiProfile: selected.aiProfile
        ? { ...selected.aiProfile, commercialInsights: undefined }
        : null
    } as TradingStudioState;
  return selected;
}

function previewClient(initial: TradingStudioState | Error): TradingStudioClient {
  let current = initial;
  return {
    loadState: () =>
      current instanceof Error ? Promise.reject(current) : Promise.resolve(current),
    selectDirection(command) {
      if (current instanceof Error || !current.directionSet)
        throw new TradingStudioHttpError(409, 'DIRECTION_SET_UNAVAILABLE', 'Direction unavailable');
      const direction = current.directionSet.directions.find(
        (candidate) =>
          candidate.commercialDirectionId === command.selectedDirectionId &&
          candidate.version === command.expectedDirectionVersion
      );
      if (!direction)
        throw new TradingStudioHttpError(409, 'DIRECTION_VERSION_CHANGED', 'Direction changed');
      const selection = {
        selectedDirection: { id: direction.commercialDirectionId, version: direction.version }
      } as TradingDirectionSelectionV1;
      current = { ...current, selection };
      return Promise.resolve(selection);
    }
  };
}

const parameters = new URL(window.location.href).searchParams;
const requestedScenario = parameters.get('scenario')?.toUpperCase() ?? 'CAPABILITY_UNAVAILABLE';
const scenario = scenarios.has(requestedScenario as PreviewScenario)
  ? (requestedScenario as PreviewScenario)
  : 'CAPABILITY_UNAVAILABLE';
const creativeScenario: CreativePilotScenario = (
  ['CAPABILITY_UNAVAILABLE', 'NO_MATERIALS', 'PARTIAL', 'RUNNING', 'QA_FAILED', 'SAVED'] as const
).includes(scenario as CreativePilotScenario)
  ? (scenario as CreativePilotScenario)
  : 'CAPABILITY_UNAVAILABLE';
const trustedPrincipalId =
  parameters.get('session') === 'memory'
    ? undefined
    : (parameters.get('principal') ?? 'preview-trading-person');
const root = document.getElementById('root');

if (!root) throw new Error('Trading Studio preview root was not found.');

createRoot(root).render(
  <StrictMode>
    <Alert tone="info" title="Preview fixture · 非生产数据">
      此入口用于体验确定性的视觉创作
      Demo。它不会调用模型、产生费用、修改原商标、创建正式资产或发布内容。
    </Alert>
    <TradingStudio
      workspaceId={TRADING_STUDIO_PREVIEW_WORKSPACE_ID}
      studioRunId={TRADING_STUDIO_PREVIEW_RUN_ID}
      client={previewClient(stateForScenario(scenario))}
      sellerValidationPrototype
      sellerValidationScenario={creativeScenario}
      sellerValidationTrustedPrincipalId={trustedPrincipalId}
      sellerValidationStorage={
        scenario === 'STORAGE_FAILURE' ? unavailableStorage : window.localStorage
      }
    />
  </StrictMode>
);
