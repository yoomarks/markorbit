export type LifecycleSurfaceState =
  | 'READY'
  | 'LOADING'
  | 'NO_PROJECTION'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RECOVERABLE_ERROR'
  | 'PARTIAL'
  | 'STALE'
  | 'CONFLICTING'
  | 'LIMITED_MANUAL'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'NOT_COVERED'
  | 'OVERDUE';

export type LifecycleProcessState =
  'OCCURRED' | 'CURRENT' | 'UPCOMING' | 'FUTURE' | 'UNKNOWN' | 'NOT_APPLICABLE';

export type LifecycleTimeKind =
  | 'SOURCE_RECORDED'
  | 'REVIEWED_TIMING'
  | 'RULE_WINDOW'
  | 'MO_PREDICTION'
  | 'TYPICAL_RANGE'
  | 'UNKNOWN'
  | 'CONFLICTING';

export type LifecycleSourceState =
  'CURRENT' | 'STALE' | 'CONFLICTING' | 'PARTIAL' | 'UNAVAILABLE' | 'NOT_COVERED';

export type LifecycleActionState =
  'NONE' | 'NOTICE' | 'REQUIRED' | 'ACKNOWLEDGED' | 'DISMISSED' | 'INELIGIBLE' | 'OVERDUE';

export interface LifecycleTimeAssertion {
  kind: LifecycleTimeKind;
  label: string;
  value: string;
  dateTime?: string;
  endValue?: string;
  endDateTime?: string;
}

export interface LifecycleSourceFixture {
  id: string;
  label: string;
  owner: string;
  kind: 'SOURCE_SNAPSHOT' | 'MARKREG_PROJECTION' | 'RULE_PACK' | 'PREDICTION_METHOD';
  locator: string;
  version: string;
  observedAt: string;
  observedAtDateTime: string;
  state: LifecycleSourceState;
  note: string;
}

export interface LifecycleActionFixture {
  state: LifecycleActionState;
  title: string;
  summary: string;
  timing: string;
  eligibility: 'ELIGIBLE' | 'BLOCKED' | 'UNAVAILABLE';
  target: string;
}

export interface LifecycleMilestoneFixture {
  id: string;
  label: string;
  labelEn: string;
  processState: LifecycleProcessState;
  sourceState: LifecycleSourceState;
  description: string;
  time: LifecycleTimeAssertion;
  sources: readonly LifecycleSourceFixture[];
  action?: LifecycleActionFixture;
  limitation?: string;
}

export interface LifecycleStageFixture {
  id: string;
  label: string;
  labelEn: string;
  processState: LifecycleProcessState;
  summary: string;
  milestones: readonly LifecycleMilestoneFixture[];
}

export interface TrademarkLifecycleFixture {
  fixtureOnly: true;
  fixtureId: string;
  asset: {
    id: string;
    version: number;
    mark: string;
    jurisdictionCode: string;
    jurisdictionLabel: string;
    numberLabel: string;
    number: string;
    relationship: string;
    freshness: LifecycleSourceState;
    syncedAt: string;
    syncedAtDateTime: string;
    monogram: string;
  };
  projection: {
    id: string;
    version: number;
    asOf: string;
    asOfDateTime: string;
    currentStageId: string;
    currentLabel: string;
    nextSummary: string;
    sourceState: LifecycleSourceState;
    stages: readonly LifecycleStageFixture[];
    rulePack?: {
      label: string;
      version: string;
      effectiveWindow: string;
      admittedForRuntime: false;
    };
    predictionMethod?: {
      label: string;
      version: string;
      generatedAt: string;
    };
  };
  recommendedAction?: {
    id: string;
    version: number;
    milestoneId: string;
    status: Exclude<LifecycleActionState, 'NONE' | 'NOTICE' | 'INELIGIBLE'>;
    title: string;
    explanation: string;
    executionAuthorized: false;
  };
  limitations: readonly string[];
}

const usSource: LifecycleSourceFixture = {
  id: 'source-us-snapshot',
  label: '美国商标记录快照（演示）',
  owner: 'Data source fixture',
  kind: 'SOURCE_SNAPSHOT',
  locator: 'fixture://us/trademark/MO-FIX-6088196',
  version: 'snapshot-2026-10-08',
  observedAt: '2026年10月8日 18:20 CST',
  observedAtDateTime: '2026-10-08T18:20:00+08:00',
  state: 'CURRENT',
  note: '这是来源记录快照的演示形态；Lite 未将其核验为 Official Truth。'
};

const usRuleSource: LifecycleSourceFixture = {
  id: 'source-us-rule-pack',
  label: 'US maintenance Rule Pack（演示）',
  owner: 'MarkReg rule fixture',
  kind: 'RULE_PACK',
  locator: 'fixture://rule-pack/us-maintenance',
  version: 'draft-fixture-0.3',
  observedAt: '2026年10月9日 09:00 CST',
  observedAtDateTime: '2026-10-09T09:00:00+08:00',
  state: 'CURRENT',
  note: '尚未通过 LCR-A0 运行准入；窗口只用于核对交互，不是正式法律期限。'
};

const euSource: LifecycleSourceFixture = {
  id: 'source-eu-snapshot',
  label: 'EUIPO 来源快照（演示）',
  owner: 'Data source fixture',
  kind: 'SOURCE_SNAPSHOT',
  locator: 'fixture://euipo/application/MO-EU-2026-0142',
  version: 'snapshot-2026-10-09',
  observedAt: '2026年10月9日 08:40 CST',
  observedAtDateTime: '2026-10-09T08:40:00+08:00',
  state: 'PARTIAL',
  note: '可见申请与公告日期；当前数据不能确认异议数量，因此不会显示为 0。'
};

const euPrediction: LifecycleSourceFixture = {
  id: 'source-eu-prediction',
  label: 'MO 流程时间预测（演示）',
  owner: 'Brain prediction fixture',
  kind: 'PREDICTION_METHOD',
  locator: 'fixture://prediction/euipo-registration',
  version: 'method-fixture-0.2',
  observedAt: '2026年10月9日 09:10 CST',
  observedAtDateTime: '2026-10-09T09:10:00+08:00',
  state: 'CURRENT',
  note: '预测只有月份精度，不是 EUIPO 承诺、期限或官方日期。'
};

const phSource: LifecycleSourceFixture = {
  id: 'source-ph-workspace',
  label: 'Workspace 手工导入记录',
  owner: 'Workspace user',
  kind: 'SOURCE_SNAPSHOT',
  locator: 'fixture://workspace/import/ph-asset-18',
  version: 'import-4',
  observedAt: '2026年9月28日 15:30 CST',
  observedAtDateTime: '2026-09-28T15:30:00+08:00',
  state: 'PARTIAL',
  note: '当前没有已准入 Data Engine 或 Rule Pack 覆盖；需要人工核对。'
};

function milestone(value: LifecycleMilestoneFixture): Readonly<LifecycleMilestoneFixture> {
  return value;
}

export const usMaintenanceFixture: TrademarkLifecycleFixture = {
  fixtureOnly: true,
  fixtureId: 'lifecycle-us-maintenance',
  asset: {
    id: 'trademark-asset_north-star',
    version: 7,
    mark: 'NORTH STAR',
    jurisdictionCode: 'US',
    jurisdictionLabel: '美国',
    numberLabel: '演示注册号',
    number: '6,088,196',
    relationship: 'OWNED',
    freshness: 'CURRENT',
    syncedAt: '2026年10月9日 09:20 CST',
    syncedAtDateTime: '2026-10-09T09:20:00+08:00',
    monogram: 'NS'
  },
  projection: {
    id: 'fixture-lifecycle-rail_us-north-star',
    version: 3,
    asOf: '2026年10月9日 09:20 CST',
    asOfDateTime: '2026-10-09T09:20:00+08:00',
    currentStageId: 'maintenance',
    currentLabel: '注册后维持',
    nextSummary: '维护材料准备窗口将在 40 天后开启',
    sourceState: 'CURRENT',
    rulePack: {
      label: 'US maintenance Rule Pack（演示）',
      version: 'draft-fixture-0.3',
      effectiveWindow: '仅用于 2026-10-09 高保真审查',
      admittedForRuntime: false
    },
    stages: [
      {
        id: 'filing',
        label: '申请',
        labelEn: 'Filing',
        processState: 'OCCURRED',
        summary: '申请记录已出现',
        milestones: [
          milestone({
            id: 'us-filed',
            label: '申请提交',
            labelEn: 'Application filed',
            processState: 'OCCURRED',
            sourceState: 'CURRENT',
            description: '来源快照记录了申请提交日期。',
            time: {
              kind: 'SOURCE_RECORDED',
              label: '来源记录日期',
              value: '2020年2月3日',
              dateTime: '2020-02-03'
            },
            sources: [usSource]
          })
        ]
      },
      {
        id: 'examination',
        label: '审查',
        labelEn: 'Examination',
        processState: 'OCCURRED',
        summary: '已记录审查阶段完成',
        milestones: [
          milestone({
            id: 'us-examined',
            label: '审查通过记录',
            labelEn: 'Examination recorded',
            processState: 'OCCURRED',
            sourceState: 'CURRENT',
            description: '演示来源记录显示案件离开审查阶段。',
            time: {
              kind: 'SOURCE_RECORDED',
              label: '来源记录日期',
              value: '2020年8月18日',
              dateTime: '2020-08-18'
            },
            sources: [usSource]
          })
        ]
      },
      {
        id: 'publication',
        label: '公告',
        labelEn: 'Publication',
        processState: 'OCCURRED',
        summary: '公告事件已记录',
        milestones: [
          milestone({
            id: 'us-published',
            label: '公告记录',
            labelEn: 'Publication recorded',
            processState: 'OCCURRED',
            sourceState: 'CURRENT',
            description: '演示来源记录显示公告事件。',
            time: {
              kind: 'SOURCE_RECORDED',
              label: '来源记录日期',
              value: '2021年2月9日',
              dateTime: '2021-02-09'
            },
            sources: [usSource]
          })
        ]
      },
      {
        id: 'registration',
        label: '注册',
        labelEn: 'Registration',
        processState: 'OCCURRED',
        summary: '注册记录已出现，但注册不是管理终点',
        milestones: [
          milestone({
            id: 'us-registered',
            label: '注册记录',
            labelEn: 'Registration recorded',
            processState: 'OCCURRED',
            sourceState: 'CURRENT',
            description: '来源快照记录了注册日期，后续维持事项仍需单独判断。',
            time: {
              kind: 'SOURCE_RECORDED',
              label: '来源记录日期',
              value: '2021年11月18日',
              dateTime: '2021-11-18'
            },
            sources: [usSource]
          })
        ]
      },
      {
        id: 'maintenance',
        label: '维持',
        labelEn: 'Maintenance',
        processState: 'CURRENT',
        summary: '当前阶段 · 一项材料准备建议',
        milestones: [
          milestone({
            id: 'us-registration-complete',
            label: '进入维持阶段',
            labelEn: 'Maintenance begins',
            processState: 'OCCURRED',
            sourceState: 'CURRENT',
            description: '注册记录之后，资产进入持续维持阶段。',
            time: {
              kind: 'SOURCE_RECORDED',
              label: '来源记录日期',
              value: '2021年11月18日',
              dateTime: '2021-11-18'
            },
            sources: [usSource]
          }),
          milestone({
            id: 'us-section-8-window',
            label: '§8 使用宣誓准备',
            labelEn: 'Section 8 preparation',
            processState: 'CURRENT',
            sourceState: 'CURRENT',
            description:
              '演示 Rule Pack 计算出一个材料准备窗口。此处展示的是产品准备提示，不是 Lite 认证的官方期限。',
            time: {
              kind: 'RULE_WINDOW',
              label: '规则计算窗口（演示）',
              value: '2026年11月18日起',
              dateTime: '2026-11-18',
              endValue: '2027年11月18日',
              endDateTime: '2027-11-18'
            },
            sources: [usSource, usRuleSource],
            action: {
              state: 'REQUIRED',
              title: '提前准备使用证据与商品覆盖核对',
              summary: '建议在窗口开启前完成材料盘点；任何提交仍需进入受控工作台。',
              timing: '窗口预计 40 天后开启',
              eligibility: 'ELIGIBLE',
              target: 'Trademark maintenance preparation capability（演示）'
            },
            limitation: 'LCR-A0 尚未确认正式 Rule Pack、deadline authority 或 Capability action。'
          }),
          milestone({
            id: 'us-grace-period',
            label: '后续宽展期',
            labelEn: 'Later grace period',
            processState: 'FUTURE',
            sourceState: 'NOT_COVERED',
            description: '当前高保真不生成未经准入的精确宽展日期。',
            time: { kind: 'UNKNOWN', label: '时间未知', value: '待正式 Rule Pack' },
            sources: [usRuleSource]
          }),
          milestone({
            id: 'us-renewal',
            label: '续展周期',
            labelEn: 'Renewal cycle',
            processState: 'FUTURE',
            sourceState: 'NOT_COVERED',
            description: '后续续展继续属于同一资产生命周期，但本演示不计算精确日期。',
            time: { kind: 'TYPICAL_RANGE', label: '通常范围', value: '注册后续周期' },
            sources: [usRuleSource]
          })
        ]
      }
    ]
  },
  recommendedAction: {
    id: 'fixture-recommended-action_us-section-8',
    version: 2,
    milestoneId: 'us-section-8-window',
    status: 'REQUIRED',
    title: '准备 §8 使用材料（演示建议）',
    explanation: '这是与当前里程碑关联的 Recommended Action，不是执行授权。',
    executionAuthorized: false
  },
  limitations: [
    '所有法域规则、日期和编号均为高保真演示数据。',
    '来源快照未被 Lite 核验为 Official Truth。',
    'Recommended Action 不会自动创建 Matter、Work、Order 或 Filing。'
  ]
};

export const euOppositionFixture: TrademarkLifecycleFixture = {
  fixtureOnly: true,
  fixtureId: 'lifecycle-eu-opposition',
  asset: {
    id: 'trademark-asset_blue-orbit-eu',
    version: 4,
    mark: 'BLUE ORBIT',
    jurisdictionCode: 'EUIPO',
    jurisdictionLabel: '欧盟',
    numberLabel: '演示申请号',
    number: 'MO-EU-2026-0142',
    relationship: 'MANAGED',
    freshness: 'PARTIAL',
    syncedAt: '2026年10月9日 08:40 CST',
    syncedAtDateTime: '2026-10-09T08:40:00+08:00',
    monogram: 'BO'
  },
  projection: {
    id: 'fixture-lifecycle-rail_eu-blue-orbit',
    version: 2,
    asOf: '2026年10月9日 08:40 CST',
    asOfDateTime: '2026-10-09T08:40:00+08:00',
    currentStageId: 'publication',
    currentLabel: '公告与异议期',
    nextSummary: '当前无法确认异议数量；注册月份仅为 MO 预测',
    sourceState: 'PARTIAL',
    predictionMethod: {
      label: 'EUIPO typical duration model（演示）',
      version: 'method-fixture-0.2',
      generatedAt: '2026年10月9日 09:10 CST'
    },
    stages: [
      {
        id: 'filing',
        label: '申请',
        labelEn: 'Filing',
        processState: 'OCCURRED',
        summary: '申请日期已记录',
        milestones: [
          milestone({
            id: 'eu-filed',
            label: '申请提交',
            labelEn: 'Application received',
            processState: 'OCCURRED',
            sourceState: 'PARTIAL',
            description: '来源快照记录了申请日期。',
            time: {
              kind: 'SOURCE_RECORDED',
              label: '来源记录日期',
              value: '2026年7月13日',
              dateTime: '2026-07-13'
            },
            sources: [euSource]
          })
        ]
      },
      {
        id: 'examination',
        label: '审查',
        labelEn: 'Examination',
        processState: 'OCCURRED',
        summary: '已进入公告前阶段',
        milestones: [
          milestone({
            id: 'eu-examined',
            label: '审查阶段记录',
            labelEn: 'Examination stage recorded',
            processState: 'OCCURRED',
            sourceState: 'PARTIAL',
            description: '快照可支持阶段顺序，但本演示不把它称为官方审查结论。',
            time: {
              kind: 'SOURCE_RECORDED',
              label: '来源记录日期',
              value: '2026年7月20日',
              dateTime: '2026-07-20'
            },
            sources: [euSource]
          })
        ]
      },
      {
        id: 'publication',
        label: '公告',
        labelEn: 'Publication',
        processState: 'CURRENT',
        summary: '异议期进行中 · 异议数量数据不可用',
        milestones: [
          milestone({
            id: 'eu-published',
            label: '申请公告',
            labelEn: 'Application published',
            processState: 'OCCURRED',
            sourceState: 'PARTIAL',
            description: '演示来源记录了公告日期。',
            time: {
              kind: 'SOURCE_RECORDED',
              label: '来源记录日期',
              value: '2026年7月20日',
              dateTime: '2026-07-20'
            },
            sources: [euSource]
          }),
          milestone({
            id: 'eu-opposition-current',
            label: '异议期',
            labelEn: 'Opposition period',
            processState: 'CURRENT',
            sourceState: 'PARTIAL',
            description:
              '来源快照显示当前处于异议期，但异议数量字段不可用，MO 不会将未观察显示为 0。',
            time: {
              kind: 'SOURCE_RECORDED',
              label: '来源记录结束日期（Lite 未核验）',
              value: '2026年10月20日',
              dateTime: '2026-10-20'
            },
            sources: [euSource],
            limitation: 'Opposition count: unavailable — not zero.'
          })
        ]
      },
      {
        id: 'registration',
        label: '注册',
        labelEn: 'Registration',
        processState: 'UPCOMING',
        summary: '预计 2026年12月，不是官方承诺',
        milestones: [
          milestone({
            id: 'eu-registration-predicted',
            label: '预计注册',
            labelEn: 'Predicted registration',
            processState: 'UPCOMING',
            sourceState: 'PARTIAL',
            description: '根据演示预测方法输出月份级时间；不伪造具体日期。',
            time: {
              kind: 'MO_PREDICTION',
              label: 'MO 预测',
              value: '预计 2026年12月'
            },
            sources: [euPrediction],
            limitation: '预测不是 EUIPO 承诺、期限或 Official Truth。'
          })
        ]
      },
      {
        id: 'maintenance',
        label: '维持',
        labelEn: 'Maintenance',
        processState: 'FUTURE',
        summary: '尚未进入',
        milestones: [
          milestone({
            id: 'eu-maintenance-future',
            label: '注册后维持',
            labelEn: 'Post-registration maintenance',
            processState: 'FUTURE',
            sourceState: 'NOT_COVERED',
            description: '当前演示未加载相应 Rule Pack。',
            time: { kind: 'UNKNOWN', label: '时间未知', value: '尚未进入' },
            sources: []
          })
        ]
      }
    ]
  },
  limitations: [
    '异议数量当前不可用，不能显示为 0。',
    '预计注册月份来自演示预测方法，并非 EUIPO 日期。',
    'Lite 未独立核验来源快照为 Official Truth。'
  ]
};

export const philippinesLimitedFixture: TrademarkLifecycleFixture = {
  fixtureOnly: true,
  fixtureId: 'lifecycle-ph-limited',
  asset: {
    id: 'trademark-asset_island-signal',
    version: 2,
    mark: 'ISLAND SIGNAL',
    jurisdictionCode: 'PH',
    jurisdictionLabel: '菲律宾',
    numberLabel: 'Workspace 参考号',
    number: 'PH-MANUAL-018',
    relationship: 'REPRESENTED',
    freshness: 'PARTIAL',
    syncedAt: '2026年9月28日 15:30 CST',
    syncedAtDateTime: '2026-09-28T15:30:00+08:00',
    monogram: 'IS'
  },
  projection: {
    id: 'fixture-lifecycle-rail_ph-island-signal',
    version: 1,
    asOf: '2026年9月28日 15:30 CST',
    asOfDateTime: '2026-09-28T15:30:00+08:00',
    currentStageId: 'filing',
    currentLabel: '阶段需人工核对',
    nextSummary: '当前无已准入 Rule Pack；不生成 DAU 日期或自动办理入口',
    sourceState: 'NOT_COVERED',
    stages: [
      {
        id: 'filing',
        label: '申请',
        labelEn: 'Filing',
        processState: 'UNKNOWN',
        summary: '存在手工导入记录，阶段未核验',
        milestones: [
          milestone({
            id: 'ph-imported-record',
            label: 'Workspace 导入记录',
            labelEn: 'Workspace imported record',
            processState: 'UNKNOWN',
            sourceState: 'PARTIAL',
            description: '资产可以继续管理，但当前来源不足以确定正式生命周期位置。',
            time: { kind: 'UNKNOWN', label: '时间未知', value: '需人工核对' },
            sources: [phSource],
            action: {
              state: 'INELIGIBLE',
              title: '人工核对当前阶段',
              summary: '先补充来源证据，再决定是否建立正式工作。',
              timing: '未计算期限',
              eligibility: 'BLOCKED',
              target: 'Manual source review'
            }
          })
        ]
      },
      ...['examination', 'publication', 'registration', 'maintenance'].map((id) => ({
        id,
        label:
          id === 'examination'
            ? '审查'
            : id === 'publication'
              ? '公告'
              : id === 'registration'
                ? '注册'
                : '维持',
        labelEn:
          id === 'examination'
            ? 'Examination'
            : id === 'publication'
              ? 'Publication'
              : id === 'registration'
                ? 'Registration'
                : 'Maintenance',
        processState: 'UNKNOWN' as const,
        summary: '未覆盖，未推算',
        milestones: []
      }))
    ]
  },
  limitations: [
    '菲律宾 Rule Pack 与 Data Engine 覆盖尚未准入。',
    '不生成 DAU、续展或其他未来日期。',
    '未观察或不覆盖不等于没有义务。'
  ]
};

const usWithoutRecommendedAction: TrademarkLifecycleFixture = { ...usMaintenanceFixture };
delete usWithoutRecommendedAction.recommendedAction;

export const noActionFixture: TrademarkLifecycleFixture = {
  ...usWithoutRecommendedAction,
  fixtureId: 'lifecycle-us-no-action',
  projection: {
    ...usMaintenanceFixture.projection,
    nextSummary: '目前无已准入待办；继续关注来源更新'
  },
  limitations: [...usMaintenanceFixture.limitations]
};

export const staleFixture: TrademarkLifecycleFixture = {
  ...usMaintenanceFixture,
  fixtureId: 'lifecycle-us-stale',
  asset: { ...usMaintenanceFixture.asset, freshness: 'STALE' },
  projection: { ...usMaintenanceFixture.projection, sourceState: 'STALE' }
};

export const conflictFixture: TrademarkLifecycleFixture = {
  ...euOppositionFixture,
  fixtureId: 'lifecycle-eu-conflict',
  asset: { ...euOppositionFixture.asset, freshness: 'CONFLICTING' },
  projection: {
    ...euOppositionFixture.projection,
    currentLabel: '当前阶段存在来源冲突',
    nextSummary: '已停在最后无争议节点；不会自动选择当前阶段',
    sourceState: 'CONFLICTING'
  }
};

export const overdueFixture: TrademarkLifecycleFixture = {
  ...usMaintenanceFixture,
  fixtureId: 'lifecycle-us-overdue',
  projection: {
    ...usMaintenanceFixture.projection,
    nextSummary: '演示建议处理日期已过去 6 天；需人工核对来源与适用规则'
  },
  recommendedAction: {
    ...usMaintenanceFixture.recommendedAction!,
    status: 'OVERDUE',
    title: '维护材料建议处理日期已过（演示）'
  }
};

export const portfolioLifecycleFixtures = [
  usMaintenanceFixture,
  euOppositionFixture,
  philippinesLimitedFixture
] as const;
