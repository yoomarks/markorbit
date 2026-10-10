import type {
  ApplicationMaterialsReviewFixture,
  ReviewItem,
  ReviewSection,
  ReviewSource
} from './ApplicationMaterialsReview.js';

const source = (input: Omit<ReviewSource, 'id'> & { id: string }): ReviewSource =>
  Object.freeze(input);

export const reviewSections = Object.freeze([
  {
    id: 'applicant',
    label: '申请主体',
    labelEn: 'Applicant',
    description: '核对单一申请人的名称、地址与主体信息；本页不替代主体资格判断。'
  },
  {
    id: 'mark',
    label: '商标表示',
    labelEn: 'Mark',
    description: '核对标准文字或静态图形商标的表示，不判断显著性或可注册性。'
  },
  {
    id: 'goods',
    label: '商品与服务',
    labelEn: 'Goods & Services',
    description: '展示已确认类别与候选表述；不自动确认分类或法律充分性。'
  },
  {
    id: 'basis',
    label: '申请基础',
    labelEn: 'Filing Basis',
    description: '只读取上游已确认的 §1(a) 或 §1(b)，这里不能重新选择申请基础。'
  },
  {
    id: 'materials',
    label: '附属材料',
    labelEn: 'Supporting Materials',
    description: '核对签署人与已提供材料；缺失项可形成未发送问题草稿。'
  }
] satisfies readonly ReviewSection[]);

const commonSources = {
  applicantWorkspace: source({
    id: 'source_applicant_workspace',
    kind: 'WORKSPACE_CURRENT',
    value: 'Orbit Atlas LLC',
    recordLabel: 'Applicant profile',
    locator: 'applicant_orbit-atlas · legal_name',
    version: 'v8',
    observedAt: '2026-10-09 09:24 CST',
    currentness: 'CURRENT'
  }),
  applicantStatement: source({
    id: 'source_applicant_statement',
    kind: 'CUSTOMER_STATEMENT',
    value: 'Orbit Atlas Inc.',
    recordLabel: 'Customer Confirmation',
    locator: 'confirmation_orbit-atlas · applicant.name',
    version: 'v6',
    observedAt: '2026-10-09 10:02 CST',
    currentness: 'CURRENT'
  }),
  addressWorkspace: source({
    id: 'source_address_workspace',
    kind: 'WORKSPACE_CURRENT',
    value: '1 Orbit Way, Suite 210, Austin, TX 78701, US',
    recordLabel: 'Applicant profile',
    locator: 'applicant_orbit-atlas · principal_address',
    version: 'v8',
    observedAt: '2026-10-09 09:24 CST',
    currentness: 'CURRENT'
  }),
  markText: source({
    id: 'source_mark_text',
    kind: 'HANDLER_CONFIRMED',
    value: 'ORBIT ATLAS',
    recordLabel: 'Matter Draft',
    locator: 'matter-draft_orbit-atlas · mark.text',
    version: 'v12',
    observedAt: '2026-10-09 10:18 CST',
    currentness: 'CURRENT'
  }),
  markType: source({
    id: 'source_mark_type',
    kind: 'HANDLER_CONFIRMED',
    value: 'Standard character mark',
    recordLabel: 'Matter Draft',
    locator: 'matter-draft_orbit-atlas · mark.type',
    version: 'v12',
    observedAt: '2026-10-09 10:18 CST',
    currentness: 'CURRENT'
  }),
  classes: source({
    id: 'source_classes',
    kind: 'HANDLER_CONFIRMED',
    value: 'International Classes 9 and 42',
    recordLabel: 'Matter Draft',
    locator: 'matter-draft_orbit-atlas · classes',
    version: 'v12',
    observedAt: '2026-10-09 10:18 CST',
    currentness: 'CURRENT'
  }),
  goodsExtraction: source({
    id: 'source_goods_extraction',
    kind: 'DOCUMENT_EXTRACTION',
    value: 'Downloadable software for managing satellite imagery and geospatial datasets.',
    recordLabel: 'Product brief extraction',
    locator: 'document_product-brief · page 3 · paragraph 2',
    version: 'sha256:61c4…2a91',
    observedAt: '2026-10-09 10:21 CST',
    currentness: 'CURRENT'
  }),
  goodsSuggestion: source({
    id: 'source_goods_suggestion',
    kind: 'AI_SUGGESTION',
    value: 'Software as a service featuring software for analysis of geospatial information.',
    recordLabel: 'Brain suggestion fixture',
    locator: 'fixture-run_brain-m21 · candidate 2',
    version: 'demo-v1',
    observedAt: '2026-10-09 10:22 CST',
    currentness: 'UNKNOWN'
  }),
  filingBasis: source({
    id: 'source_filing_basis',
    kind: 'HANDLER_CONFIRMED',
    value: '§1(b) Intent to use',
    recordLabel: 'Customer Confirmation',
    locator: 'confirmation_orbit-atlas · filing_basis',
    version: 'v6',
    observedAt: '2026-10-09 10:02 CST',
    currentness: 'CURRENT',
    note: '仅表示上游已确认输入；本页面不选择或建议申请基础。'
  })
} as const;

export const workingReviewItems = Object.freeze([
  {
    id: 'applicant-name',
    sectionId: 'applicant',
    label: '申请人法定名称',
    labelEn: 'Applicant legal name',
    status: 'CONFLICTING',
    blocking: true,
    summary: 'Workspace 当前值与客户最新陈述的主体后缀不同。',
    sources: [commonSources.applicantWorkspace, commonSources.applicantStatement],
    questionDraft:
      '请确认申请人的完整法定名称以及 “LLC / Inc.” 何者与当前主体登记一致，并提供对应主体文件或来源位置。'
  },
  {
    id: 'applicant-address',
    sectionId: 'applicant',
    label: '申请人主要地址',
    labelEn: 'Principal address',
    status: 'PRESENT',
    blocking: false,
    summary: 'Workspace 当前记录中已有地址。',
    workingValue: commonSources.addressWorkspace.value,
    workingValueSourceId: commonSources.addressWorkspace.id,
    sources: [commonSources.addressWorkspace]
  },
  {
    id: 'mark-type',
    sectionId: 'mark',
    label: '商标类型',
    labelEn: 'Mark type',
    status: 'PRESENT',
    blocking: false,
    summary: '上游已记录为标准文字商标。',
    workingValue: commonSources.markType.value,
    workingValueSourceId: commonSources.markType.id,
    sources: [commonSources.markType]
  },
  {
    id: 'mark-text',
    sectionId: 'mark',
    label: '商标文字',
    labelEn: 'Mark wording',
    status: 'PRESENT',
    blocking: false,
    summary: 'Matter Draft 与已确认展示一致。',
    workingValue: commonSources.markText.value,
    workingValueSourceId: commonSources.markText.id,
    sources: [commonSources.markText]
  },
  {
    id: 'classes',
    sectionId: 'goods',
    label: '已确认类别',
    labelEn: 'Confirmed classes',
    status: 'PRESENT',
    blocking: false,
    summary: '类别 9、42 已由上游确认；本页面不可修改。',
    workingValue: commonSources.classes.value,
    workingValueSourceId: commonSources.classes.id,
    sources: [commonSources.classes]
  },
  {
    id: 'goods-wording',
    sectionId: 'goods',
    label: '商品/服务表述',
    labelEn: 'Goods and services wording',
    status: 'UNVERIFIED',
    blocking: false,
    summary: '文件抽取与 Brain 建议均为候选，尚未由经办人员核验。',
    sources: [commonSources.goodsExtraction, commonSources.goodsSuggestion],
    questionDraft: '请确认产品当前实际提供的功能，以及计划覆盖的软件与在线服务范围。'
  },
  {
    id: 'filing-basis',
    sectionId: 'basis',
    label: '已确认申请基础',
    labelEn: 'Confirmed filing basis',
    status: 'PRESENT',
    blocking: false,
    summary: '只读展示上游已确认的 §1(b)；本页面不重新选择。',
    workingValue: commonSources.filingBasis.value,
    workingValueSourceId: commonSources.filingBasis.id,
    sources: [commonSources.filingBasis]
  },
  {
    id: 'signatory',
    sectionId: 'materials',
    label: '签署人姓名与职务',
    labelEn: 'Signatory name and title',
    status: 'MISSING',
    blocking: true,
    summary: '当前快照未包含拟签署人的姓名和职务。',
    sources: [],
    questionDraft: '请提供拟签署人的完整姓名、职务及其与申请人的关系。'
  },
  {
    id: 'device-file',
    sectionId: 'materials',
    label: '图形文件',
    labelEn: 'Device mark file',
    status: 'NOT_APPLICABLE',
    blocking: false,
    summary: '本 fixture 为标准文字商标，不需要静态图形文件。',
    sources: []
  }
] satisfies readonly ReviewItem[]);

const baseMatter = Object.freeze({
  trademark: 'ORBIT ATLAS',
  jurisdiction: 'US' as const,
  filingBasis: '§1(b)' as const,
  filingBasisLabel: 'Intent to use',
  classes: [9, 42] as const,
  matterId: 'formal-matter_orbit-atlas',
  matterVersion: 5,
  matterDraftId: 'matter-draft_orbit-atlas',
  matterDraftVersion: 12,
  customerConfirmationId: 'confirmation_orbit-atlas',
  customerConfirmationVersion: 6,
  sourceAsOf: '2026-10-09 10:24 CST'
});

const baseQuestions = Object.freeze([
  {
    id: 'question_applicant-name',
    itemId: 'applicant-name',
    audience: '向客户确认',
    text: workingReviewItems[0]!.questionDraft!
  },
  {
    id: 'question_goods-wording',
    itemId: 'goods-wording',
    audience: '向业务人员确认',
    text: workingReviewItems[5]!.questionDraft!
  },
  {
    id: 'question_signatory',
    itemId: 'signatory',
    audience: '向客户确认',
    text: workingReviewItems[7]!.questionDraft!
  }
]);

export const partialConflictFixture: ApplicationMaterialsReviewFixture = Object.freeze({
  fixtureOnly: true,
  fixtureId: 'fixture_m21_partial-conflict',
  matter: baseMatter,
  snapshot: {
    id: 'review-snapshot_fixture-orbit-atlas',
    version: 7,
    updatedAt: '2026-10-09 10:26 CST',
    actor: 'Lin · MarkReg preparation operator'
  },
  sections: reviewSections,
  items: workingReviewItems,
  questions: baseQuestions,
  handoffAllowed: false
});

const readyItems: readonly ReviewItem[] = workingReviewItems.map((item) => {
  if (item.id === 'applicant-name')
    return {
      ...item,
      status: 'PRESENT',
      blocking: false,
      summary: '经办确认结果与当前主体文件一致。',
      workingValue: 'Orbit Atlas LLC',
      workingValueSourceId: commonSources.applicantWorkspace.id,
      sources: [commonSources.applicantWorkspace]
    };
  if (item.id === 'signatory')
    return {
      ...item,
      status: 'PRESENT',
      blocking: false,
      summary: '当前快照包含签署人姓名与职务。',
      workingValue: 'Maya Chen · Chief Executive Officer',
      sources: [
        source({
          id: 'source_signatory_confirmed',
          kind: 'HANDLER_CONFIRMED',
          value: 'Maya Chen · Chief Executive Officer',
          recordLabel: 'Customer Confirmation',
          locator: 'confirmation_orbit-atlas · signatory',
          version: 'v7',
          observedAt: '2026-10-09 11:12 CST',
          currentness: 'CURRENT'
        })
      ]
    };
  if (item.id === 'goods-wording')
    return {
      ...item,
      status: 'REVIEW_REQUIRED',
      blocking: false,
      summary: '候选表述已由准备人员整理，仍需经办复核，不代表法律充分性。'
    };
  return item;
});

export const readyForHandoffFixture: ApplicationMaterialsReviewFixture = Object.freeze({
  ...partialConflictFixture,
  fixtureId: 'fixture_m21_ready-for-handoff',
  matter: { ...baseMatter, customerConfirmationVersion: 7 },
  snapshot: {
    id: 'review-snapshot_fixture-orbit-atlas',
    version: 8,
    updatedAt: '2026-10-09 11:18 CST',
    actor: 'Lin · MarkReg preparation operator'
  },
  items: readyItems,
  questions: [],
  handoffAllowed: true
});

export const unsupportedFixture: ApplicationMaterialsReviewFixture = Object.freeze({
  ...partialConflictFixture,
  fixtureId: 'fixture_m21_unsupported',
  unsupportedReason:
    '此演示案件包含两个申请人，超出 D-042 首批单一申请人范围。核对已停止；系统不会把它当作普通缺项继续。'
});
