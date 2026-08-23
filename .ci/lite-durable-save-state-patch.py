from __future__ import annotations

import re
from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"expected one anchor in {path}, found {text.count(old)}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1))


def replace_n(path: str, old: str, new: str, count: int) -> None:
    file = Path(path)
    text = file.read_text()
    found = text.count(old)
    if found != count:
        raise SystemExit(f"expected {count} anchors in {path}, found {found}: {old[:140]!r}")
    file.write_text(text.replace(old, new, count))


def sub_once(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    file = Path(path)
    text = file.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"expected one regex match in {path}, found {count}: {pattern[:140]!r}")
    file.write_text(updated)


orbit = "services/lite/src/daily-orbit.ts"
sub_once(
    orbit,
    r"export interface DailyOrbitVisibilityProvider \{.*?\n\}\n\nexport interface DailyOrbitSnapshot",
    """export interface DailyOrbitVisibilityState {
  savedOrbitItemIds: ReadonlySet<string>;
  dismissedOrbitItemIds: ReadonlySet<string>;
}

export interface DailyOrbitVisibilityProvider {
  orbitItemState(
    workspaceId: string,
    subjectUserId: string
  ): Promise<Readonly<DailyOrbitVisibilityState>>;
}

export class NoDailyOrbitVisibilityProvider implements DailyOrbitVisibilityProvider {
  orbitItemState(): Promise<Readonly<DailyOrbitVisibilityState>> {
    return Promise.resolve({ savedOrbitItemIds: new Set(), dismissedOrbitItemIds: new Set() });
  }
}

export class PostgresDailyOrbitVisibilityProvider implements DailyOrbitVisibilityProvider {
  constructor(private readonly query: QueryClient) {}

  async orbitItemState(
    workspaceIdValue: string,
    subjectUserIdValue: string
  ): Promise<Readonly<DailyOrbitVisibilityState>> {
    const workspaceId = cleanWorkspaceId(workspaceIdValue);
    const subjectUserId = cleanUserId(subjectUserIdValue);
    try {
      const result = await this.query.query(
        `SELECT DISTINCT target_id,kind
           FROM lite_product_preference_events
          WHERE workspace_id=$1
            AND subject_user_id=$2
            AND target_type='DAILY_ORBIT_ITEM'
            AND kind IN ('SAVED','DISMISSED')
          ORDER BY target_id,kind`,
        [workspaceId, subjectUserId]
      );
      const savedOrbitItemIds = new Set<string>();
      const dismissedOrbitItemIds = new Set<string>();
      for (const row of result.rows) {
        const targetId = String((row as { target_id: unknown }).target_id);
        if ((row as { kind: unknown }).kind === 'SAVED') savedOrbitItemIds.add(targetId);
        if ((row as { kind: unknown }).kind === 'DISMISSED') dismissedOrbitItemIds.add(targetId);
      }
      return { savedOrbitItemIds, dismissedOrbitItemIds };
    } catch (error) {
      throw new DailyOrbitError(
        'PERSISTENCE_UNAVAILABLE',
        'Lite Daily Orbit visibility persistence is unavailable.',
        503,
        true,
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }
}

export interface DailyOrbitSnapshot""",
    re.S,
)
replace_once(
    orbit,
    "  preferenceSource: CreatorPreference['source'] | 'NONE';\n  items: ReadonlyArray<Readonly<DailyOrbitItem>>;",
    "  preferenceSource: CreatorPreference['source'] | 'NONE';\n  savedOrbitItemIds: readonly string[];\n  items: ReadonlyArray<Readonly<DailyOrbitItem>>;",
)
sub_once(
    orbit,
    r"    let dismissedOrbitItemIds: ReadonlySet<string> = new Set\(\);\n    try \{\n      dismissedOrbitItemIds = await this\.visibility\.dismissedOrbitItemIds\(\n        workspaceId,\n        subjectUserId\n      \);\n    \} catch \{\n      warnings\.push\('ORBIT_VISIBILITY_UNAVAILABLE'\);\n    \}",
    """    let orbitItemState: Readonly<DailyOrbitVisibilityState> = {
      savedOrbitItemIds: new Set(),
      dismissedOrbitItemIds: new Set()
    };
    try {
      orbitItemState = await this.visibility.orbitItemState(workspaceId, subjectUserId);
    } catch {
      warnings.push('ORBIT_VISIBILITY_UNAVAILABLE');
    }""",
)
replace_once(
    orbit,
    "      .filter((entry) => !dismissedOrbitItemIds.has(entry.item.dailyOrbitItemId))",
    "      .filter(\n        (entry) => !orbitItemState.dismissedOrbitItemIds.has(entry.item.dailyOrbitItemId)\n      )",
)
replace_once(
    orbit,
    "    const items = ranked.map((entry) => entry.item);\n    const contentPicks = ranked",
    "    const items = ranked.map((entry) => entry.item);\n    const savedOrbitItemIds = items\n      .filter((item) => orbitItemState.savedOrbitItemIds.has(item.dailyOrbitItemId))\n      .map((item) => item.dailyOrbitItemId);\n    const contentPicks = ranked",
)
replace_once(
    orbit,
    "      preferenceSource: preference?.source ?? 'NONE',\n      items,",
    "      preferenceSource: preference?.source ?? 'NONE',\n      savedOrbitItemIds,\n      items,",
)

unit = "services/lite/tests/daily-orbit.test.ts"
replace_once(
    unit,
    "  type DailyOrbitPreferenceProvider,\n  type DailyOrbitTodayReader,\n  type DailyOrbitVisibilityProvider,\n  type DailySignalReader",
    "  type DailyOrbitPreferenceProvider,\n  type DailyOrbitTodayReader,\n  type DailyOrbitVisibilityProvider,\n  type DailyOrbitVisibilityState,\n  type DailySignalReader",
)
sub_once(
    unit,
    r"class Visibility implements DailyOrbitVisibilityProvider \{.*?\n\}\n\ndescribe\('M9-WP-03 Personal Daily Orbit'",
    """class Visibility implements DailyOrbitVisibilityProvider {
  constructor(private readonly value: Readonly<DailyOrbitVisibilityState> | Error) {}
  orbitItemState(
    requestWorkspaceId: string,
    requestUserId: string
  ): Promise<Readonly<DailyOrbitVisibilityState>> {
    expect(requestWorkspaceId).toBe(workspaceId);
    expect(requestUserId).toBe(userId);
    if (this.value instanceof Error) return Promise.reject(this.value);
    return Promise.resolve(this.value);
  }
}

describe('M9-WP-03 Personal Daily Orbit'""",
    re.S,
)
replace_once(
    unit,
    "      new Visibility(new Set([ranked.dailyOrbitItemId]))",
    "      new Visibility({\n        savedOrbitItemIds: new Set([ranked.dailyOrbitItemId]),\n        dismissedOrbitItemIds: new Set([ranked.dailyOrbitItemId])\n      })",
)
replace_once(
    unit,
    "    expect(snapshot.items).toEqual([]);\n    expect(snapshot.contentPicks).toEqual([]);\n    expect(snapshot.partial).toBe(false);\n  });\n\n  it('fails open with an explicit warning when durable Orbit visibility cannot be read', async () => {",
    """    expect(snapshot.items).toEqual([]);
    expect(snapshot.savedOrbitItemIds).toEqual([]);
    expect(snapshot.contentPicks).toEqual([]);
    expect(snapshot.partial).toBe(false);
  });

  it('returns durable saved state only for visible exact Orbit items', async () => {
    const ranked = rankDailyOrbitItem(
      signal(),
      userId,
      preference(),
      recommendation(),
      '2026-08-18T03:00:00.000Z'
    );
    const service = new DailyOrbitService(
      new Signals([signal()]),
      new Today(today(recommendation(true))),
      new Preferences(preference()),
      () => '2026-08-18T03:00:00.000Z',
      new Visibility({
        savedOrbitItemIds: new Set([ranked.dailyOrbitItemId]),
        dismissedOrbitItemIds: new Set()
      })
    );

    const snapshot = await service.snapshot(workspaceId, userId);

    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.savedOrbitItemIds).toEqual([ranked.dailyOrbitItemId]);
    expect(snapshot.partial).toBe(false);
  });

  it('fails open with an explicit warning when durable Orbit visibility cannot be read', async () => {""",
)

aggregate = "services/lite/src/daily-workspace-snapshot.ts"
replace_once(
    aggregate,
    "  see: {\n    preferenceSource: DailyOrbitSnapshot['preferenceSource'] | null;\n    orbitItems: ReadonlyArray<Readonly<DailyOrbitItem>>;\n  };",
    "  see: {\n    preferenceSource: DailyOrbitSnapshot['preferenceSource'] | null;\n    savedOrbitItemIds: readonly string[];\n    orbitItems: ReadonlyArray<Readonly<DailyOrbitItem>>;\n  };",
)
replace_once(
    aggregate,
    "      see: {\n        preferenceSource: orbit?.preferenceSource ?? null,\n        orbitItems: orbit?.items ?? []\n      },",
    "      see: {\n        preferenceSource: orbit?.preferenceSource ?? null,\n        savedOrbitItemIds: orbit?.savedOrbitItemIds ?? [],\n        orbitItems: orbit?.items ?? []\n      },",
)

api = "apps/lite-web/src/api/daily-workspace.ts"
replace_once(
    api,
    "  readonly preferenceSource: 'EXPLICIT' | 'PRODUCT_FEEDBACK' | 'NONE';\n  readonly items: ReadonlyArray<Readonly<DailyOrbitItem>>;",
    "  readonly preferenceSource: 'EXPLICIT' | 'PRODUCT_FEEDBACK' | 'NONE';\n  readonly savedOrbitItemIds: readonly string[];\n  readonly items: ReadonlyArray<Readonly<DailyOrbitItem>>;",
)
replace_once(
    api,
    "  readonly see: {\n    readonly preferenceSource: DailyOrbitSnapshot['preferenceSource'] | null;\n    readonly orbitItems: ReadonlyArray<Readonly<DailyOrbitItem>>;\n  };",
    "  readonly see: {\n    readonly preferenceSource: DailyOrbitSnapshot['preferenceSource'] | null;\n    readonly savedOrbitItemIds: readonly string[];\n    readonly orbitItems: ReadonlyArray<Readonly<DailyOrbitItem>>;\n  };",
)

primary = "apps/lite-web/src/features/today/daily-workspace-primary.ts"
replace_once(
    primary,
    "      preferenceSource: snapshot.see.preferenceSource ?? 'NONE',\n      items: snapshot.see.orbitItems,",
    "      preferenceSource: snapshot.see.preferenceSource ?? 'NONE',\n      savedOrbitItemIds: snapshot.see.savedOrbitItemIds,\n      items: snapshot.see.orbitItems,",
)

primary_test = "apps/lite-web/src/features/today/daily-workspace-primary.test.ts"
replace_once(
    primary_test,
    "    see: { preferenceSource: 'PRODUCT_FEEDBACK', orbitItems: [] },",
    "    see: {\n      preferenceSource: 'PRODUCT_FEEDBACK',\n      savedOrbitItemIds: ['daily-orbit-item_saved'],\n      orbitItems: []\n    },",
)
replace_once(
    primary_test,
    "    expect(result.orbit.items).toEqual([]);\n    expect(result.orbit.contentPicks).toEqual([]);",
    "    expect(result.orbit.savedOrbitItemIds).toEqual(['daily-orbit-item_saved']);\n    expect(result.orbit.items).toEqual([]);\n    expect(result.orbit.contentPicks).toEqual([]);",
)
replace_once(
    primary_test,
    "        see: { preferenceSource: null, orbitItems: [] },",
    "        see: { preferenceSource: null, savedOrbitItemIds: [], orbitItems: [] },",
)

ui = "apps/lite-web/src/features/today/TodayWorkspace.tsx"
replace_n(
    ui,
    "                saved={savedOrbitItemIds.has(item.dailyOrbitItemId)}",
    "                saved={\n                  savedOrbitItemIds.has(item.dailyOrbitItemId) ||\n                  Boolean(orbit?.savedOrbitItemIds.includes(item.dailyOrbitItemId))\n                }",
    2,
)

e2e = "tests/e2e/product-loop-today-real-runtime.spec.ts"
replace_once(
    e2e,
    "      see: {\n        preferenceSource: string | null;\n        orbitItems: Array<{",
    "      see: {\n        preferenceSource: string | null;\n        savedOrbitItemIds: string[];\n        orbitItems: Array<{",
)
replace_once(
    e2e,
    "    expect(personalizedWorkspace.see.preferenceSource).toBe('PRODUCT_FEEDBACK');\n    const personalizedItem = personalizedWorkspace.see.orbitItems.find(",
    "    expect(personalizedWorkspace.see.preferenceSource).toBe('PRODUCT_FEEDBACK');\n    expect(personalizedWorkspace.see.savedOrbitItemIds).toContain(initialItem.dailyOrbitItemId);\n    const personalizedItem = personalizedWorkspace.see.orbitItems.find(",
)
replace_once(
    e2e,
    "    await expect(\n      page.getByText(`Relevance ${personalizedItem!.score.personalRelevance.score}`, {\n        exact: true\n      })\n    ).toBeVisible();",
    "    await expect(\n      page.getByText(`Relevance ${personalizedItem!.score.personalRelevance.score}`, {\n        exact: true\n      })\n    ).toBeVisible();\n    await expect(orbitCard.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();",
)
