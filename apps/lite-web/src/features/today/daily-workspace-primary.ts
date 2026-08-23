import type { DailyOrbitSnapshot, DailyWorkspaceSnapshot } from '../../api/daily-workspace.js';
import type { TodayProductLoopSnapshot } from '../../api/product-loop.js';

const SEE_PREFIX = 'SEE_CREATE:';
const MOVE_PREFIX = 'MOVE:';

function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

export interface DailyWorkspacePrimaryProjection {
  readonly orbit: DailyOrbitSnapshot;
  readonly today: TodayProductLoopSnapshot;
}

export function projectDailyWorkspacePrimary(
  snapshot: Readonly<DailyWorkspaceSnapshot>
): DailyWorkspacePrimaryProjection {
  const seeWarnings = snapshot.warnings
    .filter((warning) => warning === 'SEE_CREATE_UNAVAILABLE' || warning.startsWith(SEE_PREFIX))
    .map((warning) => stripPrefix(warning, SEE_PREFIX));
  const moveWarnings = snapshot.warnings
    .filter((warning) => warning === 'MOVE_UNAVAILABLE' || warning.startsWith(MOVE_PREFIX))
    .map((warning) => stripPrefix(warning, MOVE_PREFIX));

  return {
    orbit: {
      schemaVersion: 1,
      workspaceId: snapshot.workspaceId,
      subjectUserId: snapshot.subjectUserId,
      generatedAt: snapshot.generatedAt,
      preferenceSource: snapshot.see.preferenceSource ?? 'NONE',
      items: snapshot.see.orbitItems,
      contentPicks: snapshot.create.contentPicks,
      partial: seeWarnings.length > 0,
      warnings: seeWarnings,
      executionAuthorized: false,
      legalTruthVerified: false
    },
    today: {
      schemaVersion: 1,
      workspaceId: snapshot.workspaceId,
      generatedAt: snapshot.generatedAt,
      items: snapshot.move.todayItems,
      partial: moveWarnings.length > 0,
      warnings: moveWarnings,
      recentFeedback: snapshot.move.recentFeedback,
      feedbackPendingPackages: snapshot.move.feedbackPendingPackages
    }
  };
}
