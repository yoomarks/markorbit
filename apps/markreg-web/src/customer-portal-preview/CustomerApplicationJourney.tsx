import { useEffect, useRef } from 'react';
import { Button } from '@markorbit/ui';
import { paymentFixture, quoteFixture, type PortalState } from './domain.js';
import './customer-application-journey.css';

interface CustomerApplicationJourneyProps {
  state: PortalState;
  quoteExpired?: boolean;
  onClose: () => void;
  onUpdate: (next: Partial<PortalState>, announcement?: string) => void;
  onProgress: () => void;
}

export function CustomerApplicationJourney({
  state,
  quoteExpired = false,
  onClose,
  onUpdate,
  onProgress
}: CustomerApplicationJourneyProps) {
  const t = (zh: string, en: string) => (state.locale === 'zh-CN' ? zh : en);
  const brandName = state.draftBrandName;
  const applicant = state.draftApplicant;
  const couponInput = state.couponCode;
  const fileReady = state.draftFileReady;
  const extractionConfirmed = state.draftExtractionConfirmed;
  const country = state.draftCountry;
  const classes = state.draftClasses;
  const scrollRoot = useRef<HTMLDivElement>(null);
  const step = Math.min(Math.max(state.applicationStep, 0), 7);
  const money = (minor: number) =>
    new Intl.NumberFormat(state.locale, {
      style: 'currency',
      currency: quoteFixture.currency
    }).format(minor / 100);
  const discount = state.couponStatus === 'VALID' ? paymentFixture.discountMinor : 0;
  const payable = quoteFixture.totalMinor - discount;

  const setStep = (nextStep: number, status = state.applicationStatus) =>
    onUpdate({ applicationStep: nextStep, applicationStatus: status });

  const validateCoupon = () => {
    const normalized = couponInput.trim().toUpperCase();
    const couponStatus =
      normalized === 'SAVE600'
        ? 'VALID'
        : normalized === 'EXPIRED'
          ? 'EXPIRED'
          : normalized === 'USED'
            ? 'USED'
            : normalized === 'CNONLY'
              ? 'INAPPLICABLE'
              : 'NON_STACKABLE';
    onUpdate({ couponCode: normalized, couponStatus });
  };

  useEffect(() => {
    scrollRoot.current?.scrollTo?.({ top: 0, behavior: 'auto' });
  }, [state.paymentStatus, step]);

  return (
    <div className="journey-backdrop" ref={scrollRoot}>
      <section
        className="journey-shell"
        role="dialog"
        aria-modal="true"
        aria-label={t('申请办理', 'Application journey')}
      >
        <header className="journey-topbar">
          <button className="journey-close" onClick={onClose} aria-label={t('关闭', 'Close')}>
            ×
          </button>
          <div>
            <span>{t('商标申请 · 对话式办理', 'Trademark filing · guided journey')}</span>
            <strong>{t('NOVA 美国商标申请', 'NOVA US trademark filing')}</strong>
          </div>
          <span className="journey-demo">PREVIEW · DEMO</span>
        </header>

        <div className="journey-progress" aria-label={t('申请步骤', 'Application steps')}>
          {[
            t('需求', 'Needs'),
            t('资料', 'Files'),
            t('核对', 'Review'),
            t('范围', 'Scope'),
            t('检查', 'Check'),
            t('草稿', 'Draft'),
            t('报价', 'Quote'),
            t('付款', 'Payment')
          ].map((label, index) => (
            <span
              key={label}
              className={index === step ? 'is-current' : index < step ? 'is-done' : ''}
            >
              <i>{index < step ? '✓' : index + 1}</i>
              {label}
            </span>
          ))}
        </div>

        <div className="journey-layout">
          <main className="journey-conversation">
            {step === 0 && (
              <JourneyStep
                eyebrow={t('先说清楚你的需求', 'Start with your needs')}
                title={t('准备申请哪个商标？', 'Which mark would you like to file?')}
                intro={t(
                  'MO 办事助手只负责整理信息和准备草稿；身份验证、专业审核与正式递交由受支持的结构化流程和业务 Owner 完成。',
                  'MO Assistant organizes information and prepares a draft. Identity verification, professional review and formal filing remain with supported structured flows and business owners.'
                )}
              >
                <AssistantBubble
                  text={t(
                    '你好，我会逐步整理申请信息。你可以随时查看右侧摘要并返回修改。',
                    'I’ll organize the filing step by step. You can review the summary and go back at any time.'
                  )}
                />
                <label className="journey-field">
                  <span>{t('商标名称', 'Trademark name')}</span>
                  <input
                    value={brandName}
                    onChange={(event) => onUpdate({ draftBrandName: event.target.value })}
                  />
                </label>
                <div className="journey-choice-grid">
                  <button className="is-selected">
                    {t('企业申请', 'Company applicant')}
                    <small>{t('需要核对企业授权', 'Company authorization required')}</small>
                  </button>
                  <button>
                    {t('个人申请', 'Individual applicant')}
                    <small>{t('需要核对个人身份证明', 'Identity evidence required')}</small>
                  </button>
                </div>
                <div className="journey-boundary-note">
                  {t(
                    '验证码、身份证明和企业授权不会通过聊天文本直接通过；本 Preview 不执行真实验证。',
                    'Verification codes, identity evidence and company authorization cannot be approved through chat text. This Preview performs no real verification.'
                  )}
                </div>
                <JourneyActions
                  onBack={onClose}
                  onNext={() => setStep(1, 'DRAFT')}
                  next={t('继续准备资料', 'Continue to files')}
                />
              </JourneyStep>
            )}

            {step === 1 && (
              <JourneyStep
                eyebrow={t('资料准备', 'Prepare files')}
                title={t('上传并预览申请资料', 'Upload and preview filing files')}
                intro={t(
                  '文件先进入受控资料流程；Demo 不会上传或保存真实文件。',
                  'Files enter a controlled document flow. The Demo does not upload or retain real files.'
                )}
              >
                <AssistantBubble
                  text={t(
                    '企业申请通常需要主体证明、商标图样和商品/服务说明。',
                    'A company filing usually needs entity evidence, a mark image and goods/services information.'
                  )}
                />
                <button
                  className={`journey-upload ${fileReady ? 'is-ready' : ''}`}
                  onClick={() => onUpdate({ draftFileReady: true })}
                >
                  <span>{fileReady ? '✓' : '↑'}</span>
                  <strong>
                    {fileReady
                      ? 'NOVA-brand-kit-demo.pdf'
                      : t('选择 Demo 资料包', 'Choose Demo file package')}
                  </strong>
                  <small>
                    {fileReady
                      ? t('3 页 · 2.4 MB · 可预览', '3 pages · 2.4 MB · preview ready')
                      : t('PDF、JPG 或 PNG', 'PDF, JPG or PNG')}
                  </small>
                </button>
                {fileReady && (
                  <div className="journey-file-preview">
                    <b>NOVA</b>
                    <span>{t('企业营业执照（演示）', 'Business license (Demo)')}</span>
                    <span>{t('商标图样（原文）', 'Mark image (original)')}</span>
                  </div>
                )}
                <JourneyActions
                  onBack={() => setStep(0)}
                  onNext={() => setStep(2)}
                  next={t('提取并核对', 'Extract and review')}
                  disabled={!fileReady}
                />
              </JourneyStep>
            )}

            {step === 2 && (
              <JourneyStep
                eyebrow={t('信息核对', 'Review extracted information')}
                title={t('请核对从资料中整理的信息', 'Check information organized from files')}
                intro={t(
                  '提取结果不是官方事实；必须由客户确认，并由正确 Owner 在正式流程中复核。',
                  'Extracted information is not official truth. The customer must confirm it and the correct owner must review it in the formal flow.'
                )}
              >
                <AssistantBubble
                  text={t(
                    '我从 Demo 文件中整理出以下字段，并保留了每项来源。',
                    'I organized these fields from the Demo file and kept the source for each item.'
                  )}
                />
                <div className="journey-review-card">
                  <label>
                    <span>{t('申请人原文', 'Applicant · original')}</span>
                    <input
                      value={applicant}
                      onChange={(event) => onUpdate({ draftApplicant: event.target.value })}
                    />
                    <small>NOVA-brand-kit-demo.pdf · p.1</small>
                  </label>
                  <label>
                    <span>{t('商标名称原文', 'Mark name · original')}</span>
                    <input
                      value={brandName}
                      onChange={(event) => onUpdate({ draftBrandName: event.target.value })}
                    />
                    <small>NOVA-brand-kit-demo.pdf · p.2</small>
                  </label>
                </div>
                <label className="journey-check">
                  <input
                    type="checkbox"
                    checked={extractionConfirmed}
                    onChange={(event) =>
                      onUpdate({ draftExtractionConfirmed: event.target.checked })
                    }
                  />
                  <span>
                    {t(
                      '我已核对以上原文信息；确认不等于正式申请递交。',
                      'I reviewed the original information. Confirmation is not formal filing.'
                    )}
                  </span>
                </label>
                <JourneyActions
                  onBack={() => setStep(1)}
                  onNext={() => setStep(3)}
                  next={t('选择国家与类别', 'Choose country and classes')}
                  disabled={!extractionConfirmed}
                />
              </JourneyStep>
            )}

            {step === 3 && (
              <JourneyStep
                eyebrow={t('申请范围', 'Filing scope')}
                title={t('选择国家和商品/服务类别', 'Choose country and goods/services classes')}
                intro={t(
                  '类别建议仅用于准备草稿，不替代专业检索和法律判断。',
                  'Class suggestions prepare the draft and do not replace professional search or legal judgment.'
                )}
              >
                <AssistantBubble
                  text={t(
                    '根据你的品牌说明，Demo 建议先评审美国第 9 类和第 42 类。',
                    'Based on the brand description, the Demo suggests reviewing US Classes 9 and 42.'
                  )}
                />
                <fieldset className="journey-options">
                  <legend>{t('国家/地区', 'Country/region')}</legend>
                  {['US', 'CN', 'EU'].map((value) => (
                    <button
                      type="button"
                      className={country === value ? 'is-selected' : ''}
                      key={value}
                      onClick={() => onUpdate({ draftCountry: value })}
                    >
                      {value === 'US'
                        ? t('美国', 'United States')
                        : value === 'CN'
                          ? t('中国', 'China')
                          : t('欧盟', 'European Union')}
                    </button>
                  ))}
                </fieldset>
                <fieldset className="journey-options">
                  <legend>{t('尼斯类别', 'Nice classes')}</legend>
                  {['9', '35', '42'].map((value) => (
                    <button
                      type="button"
                      className={classes.includes(value) ? 'is-selected' : ''}
                      key={value}
                      onClick={() =>
                        onUpdate({
                          draftClasses: classes.includes(value)
                            ? classes.filter((item) => item !== value)
                            : [...classes, value]
                        })
                      }
                    >
                      {t(`第 ${value} 类`, `Class ${value}`)}
                    </button>
                  ))}
                </fieldset>
                <div className="journey-risk-note">
                  <strong>{t('风险说明', 'Risk note')}</strong>
                  {t(
                    '跨国家申请规则、可注册性和正式商品项目需由专业人员进一步审核。',
                    'Country-specific rules, registrability and formal goods/services require professional review.'
                  )}
                </div>
                <JourneyActions
                  onBack={() => setStep(2)}
                  onNext={() => setStep(4)}
                  next={t('检查缺失信息', 'Check missing information')}
                  disabled={!country || classes.length === 0}
                />
              </JourneyStep>
            )}

            {step === 4 && (
              <JourneyStep
                eyebrow={t('提交前检查', 'Pre-draft check')}
                title={t(
                  '关键信息已齐全，可以生成草稿',
                  'Key information is complete and ready for a draft'
                )}
                intro={t(
                  '系统只检查 Demo 必填项，不代表可注册性判断或正式审核完成。',
                  'The system checks Demo required fields only. It is not a registrability decision or completed formal review.'
                )}
              >
                <div className="journey-checklist">
                  <span>
                    ✓ <b>{t('申请主体', 'Applicant')}</b>
                    <small>{applicant}</small>
                  </span>
                  <span>
                    ✓ <b>{t('商标名称与图样', 'Mark name and image')}</b>
                    <small>{brandName}</small>
                  </span>
                  <span>
                    ✓ <b>{t('国家和类别', 'Country and classes')}</b>
                    <small>
                      {country} · {classes.map((value) => `Class ${value}`).join(', ')}
                    </small>
                  </span>
                  <span className="is-review">
                    ! <b>{t('仍需专业审核', 'Professional review still required')}</b>
                    <small>
                      {t(
                        '商品项目、近似风险及递交文件',
                        'Goods/services, similarity risk and filing documents'
                      )}
                    </small>
                  </span>
                </div>
                <JourneyActions
                  onBack={() => setStep(3)}
                  onNext={() => setStep(5)}
                  next={t('生成申请草稿', 'Generate application draft')}
                />
              </JourneyStep>
            )}

            {step === 5 && (
              <JourneyStep
                eyebrow={t('申请草稿', 'Application draft')}
                title={t('审核完整草稿后再查看报价', 'Review the complete draft before the quote')}
                intro={t(
                  '草稿编号和业务对象保持稳定；可返回任何步骤修改。',
                  'The draft ID and business object remain stable. You may return to any step to edit.'
                )}
              >
                <div className="journey-draft-sheet">
                  <header>
                    <span>APPLICATION DRAFT · DEMO</span>
                    <code>draft-us-nova-042</code>
                  </header>
                  <dl>
                    <div>
                      <dt>{t('申请人', 'Applicant')}</dt>
                      <dd>{applicant}</dd>
                    </div>
                    <div>
                      <dt>{t('商标', 'Mark')}</dt>
                      <dd>{brandName}</dd>
                    </div>
                    <div>
                      <dt>{t('申请范围', 'Scope')}</dt>
                      <dd>
                        {country} · {classes.map((value) => `Class ${value}`).join(', ')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('来源 Site', 'Source Site')}</dt>
                      <dd>
                        {quoteFixture.sourceSiteId} · {quoteFixture.sourceChannel}
                      </dd>
                    </div>
                  </dl>
                  <p>
                    {t(
                      '待服务机构进行专业审核；未提交至任何官方机构。',
                      'Awaiting professional review by the service firm. Nothing has been filed with an official authority.'
                    )}
                  </p>
                </div>
                <JourneyActions
                  onBack={() => setStep(3)}
                  onNext={() => setStep(6, 'QUOTE_READY')}
                  next={t('查看报价', 'View quote')}
                />
              </JourneyStep>
            )}

            {step === 6 && (
              <JourneyStep
                eyebrow={t('报价与优惠', 'Quote and offer')}
                title={t('确认服务、主体和最终金额', 'Confirm service, entities and final amount')}
                intro={t(
                  '展示价不等于最终可执行报价；本页引用 exact Quote Demo 对象。',
                  'Display pricing is not an executable quote. This page references an exact Demo Quote object.'
                )}
              >
                <div className="journey-quote-card">
                  <header>
                    <div>
                      <span>{t('正式报价投影 · Demo', 'Formal quote projection · Demo')}</span>
                      <strong>{quoteFixture.number}</strong>
                      <code>{quoteFixture.id}</code>
                    </div>
                    <b>{money(quoteFixture.totalMinor)}</b>
                  </header>
                  <dl>
                    <div>
                      <dt>{t('服务提供主体', 'Service provider')}</dt>
                      <dd>
                        {state.locale === 'zh-CN'
                          ? quoteFixture.serviceProvider
                          : quoteFixture.serviceProviderEn}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('收款主体', 'Merchant of record')}</dt>
                      <dd>
                        {state.locale === 'zh-CN'
                          ? quoteFixture.merchantEntity
                          : quoteFixture.merchantEntityEn}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('币种', 'Currency')}</dt>
                      <dd>{quoteFixture.currency}</dd>
                    </div>
                  </dl>
                  <ul>
                    {quoteFixture.lines.map((line) => (
                      <li key={line.label}>
                        <span>{state.locale === 'zh-CN' ? line.label : line.labelEn}</span>
                        <b>{money(line.amountMinor)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="journey-coupon">
                  <label>
                    <span>{t('优惠券', 'Coupon')}</span>
                    <input
                      value={couponInput}
                      onChange={(event) =>
                        onUpdate({ couponCode: event.target.value, couponStatus: 'IDLE' })
                      }
                      placeholder={t(
                        '输入 SAVE600 体验有效优惠',
                        'Enter SAVE600 for a valid offer'
                      )}
                    />
                  </label>
                  <Button variant="secondary" className="cp-secondary" onClick={validateCoupon}>
                    {t('验证', 'Validate')}
                  </Button>
                </div>
                <CouponResult state={state} t={t} money={money} />
                <div className="journey-total">
                  <span>
                    {t('最终应付', 'Final amount due')}
                    <small>
                      {quoteFixture.currency} ·{' '}
                      {t('不因语言切换而重算', 'not recalculated by locale')}
                    </small>
                  </span>
                  <strong>{money(payable)}</strong>
                </div>
                {quoteExpired && (
                  <div className="journey-error" role="alert">
                    {t(
                      '该报价已过有效期，不能确认或付款。请联系服务机构获取新报价。',
                      'This quote has expired and cannot be confirmed or paid. Contact the service firm for a new quote.'
                    )}
                  </div>
                )}
                <JourneyActions
                  onBack={() => setStep(5)}
                  onNext={() => {
                    onUpdate(
                      {
                        quoteStatus: 'CONFIRMED_DEMO',
                        applicationStatus: 'PAYMENT_PENDING',
                        applicationStep: 7,
                        paymentStatus: 'UNPAID'
                      },
                      t('Demo 报价已确认，尚未付款', 'Demo quote confirmed; payment not received')
                    );
                  }}
                  next={t('明确确认并进入付款', 'Confirm and continue to payment')}
                  disabled={
                    quoteExpired || (couponInput.length > 0 && state.couponStatus !== 'VALID')
                  }
                />
              </JourneyStep>
            )}

            {step === 7 && (
              <JourneyStep
                eyebrow={t('受控付款', 'Controlled payment')}
                title={
                  state.paymentStatus === 'PAID_DEMO'
                    ? t('Demo 支付回执已生成', 'Demo payment receipt generated')
                    : t('选择获授权的支付方式', 'Choose an authorized payment method')
                }
                intro={t(
                  '聊天不会执行扣款。此 Preview 不连接真实支付渠道，也不产生真实资金、冻结或结算。',
                  'Chat never charges funds. This Preview has no live payment channel and creates no real funds, holds or settlement.'
                )}
              >
                {state.paymentStatus !== 'PAID_DEMO' ? (
                  <>
                    <div className="journey-payment-method">
                      <span>微</span>
                      <div>
                        <strong>
                          {state.locale === 'zh-CN'
                            ? paymentFixture.method
                            : paymentFixture.methodEn}
                        </strong>
                        <small>
                          {t(
                            '由当前 Workspace / Payment 授权 · 不可手工输入其他商户',
                            'Authorized by current Workspace / Payment · another merchant cannot be typed in'
                          )}
                        </small>
                        <code>{paymentFixture.merchantAccountRef}</code>
                      </div>
                      <b>✓</b>
                    </div>
                    <div className="journey-payment-summary">
                      <span>
                        {t('订单', 'Order')}
                        <b>{paymentFixture.orderId}</b>
                      </span>
                      <span>
                        {t('收款主体', 'Merchant')}
                        <b>
                          {state.locale === 'zh-CN'
                            ? quoteFixture.merchantEntity
                            : quoteFixture.merchantEntityEn}
                        </b>
                      </span>
                      <span>
                        {t('应付金额', 'Amount due')}
                        <b>{money(payable)}</b>
                      </span>
                    </div>
                    {state.paymentStatus === 'FAILED_DEMO' && (
                      <div className="journey-error" role="alert">
                        {t(
                          'Demo 支付失败：未收到款项，订单仍为待付款。你可以重试或联系服务机构。',
                          'Demo payment failed: no funds were received and the order remains unpaid. Retry or contact the service firm.'
                        )}
                      </div>
                    )}
                    <div className="journey-payment-actions">
                      <Button
                        variant="secondary"
                        className="cp-secondary"
                        onClick={() => onUpdate({ paymentStatus: 'FAILED_DEMO' })}
                      >
                        {t('演示支付失败', 'Simulate failure')}
                      </Button>
                      <Button
                        className="cp-primary"
                        onClick={() =>
                          onUpdate(
                            {
                              paymentStatus: 'PAID_DEMO',
                              applicationStatus: 'PAID_DEMO',
                              unreadMessages: 1
                            },
                            t('Demo 支付回执已生成', 'Demo payment receipt generated')
                          )
                        }
                      >
                        {t('生成 Demo 支付回执', 'Generate Demo receipt')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="journey-receipt">
                    <span>✓</span>
                    <h3>{t('已生成 Demo 支付回执', 'Demo payment receipt generated')}</h3>
                    <p>
                      {t(
                        '这不是生产支付成功或资金结算证明。',
                        'This is not proof of production payment or settlement.'
                      )}
                    </p>
                    <dl>
                      <div>
                        <dt>{t('回执号', 'Receipt')}</dt>
                        <dd>{paymentFixture.receiptNumber}</dd>
                      </div>
                      <div>
                        <dt>{t('支付对象', 'Payment object')}</dt>
                        <dd>{paymentFixture.id}</dd>
                      </div>
                      <div>
                        <dt>{t('订单', 'Order')}</dt>
                        <dd>{paymentFixture.orderId}</dd>
                      </div>
                      <div>
                        <dt>{t('金额', 'Amount')}</dt>
                        <dd>
                          {money(payable)} {paymentFixture.currency}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('来源', 'Source')}</dt>
                        <dd>
                          {quoteFixture.sourceSiteId} · {quoteFixture.sourceChannel}
                        </dd>
                      </div>
                    </dl>
                    <div className="journey-payment-actions">
                      <Button variant="secondary" className="cp-secondary" disabled>
                        {t(
                          '已收到 Demo 回执 · 不可重复付款',
                          'Demo receipt received · duplicate payment blocked'
                        )}
                      </Button>
                      <Button className="cp-primary" onClick={onProgress}>
                        {t('查看同一业务进度', 'View the same business')}
                      </Button>
                    </div>
                  </div>
                )}
              </JourneyStep>
            )}
          </main>

          <aside className="journey-summary">
            <span>{t('已填写内容', 'Application summary')}</span>
            <h2>{brandName || t('未填写商标名称', 'Mark name not entered')}</h2>
            <dl>
              <div>
                <dt>{t('办理身份', 'Applicant type')}</dt>
                <dd>{t('企业', 'Company')}</dd>
              </div>
              <div>
                <dt>{t('申请人原文', 'Applicant · original')}</dt>
                <dd>{applicant}</dd>
              </div>
              <div>
                <dt>{t('国家/地区', 'Country/region')}</dt>
                <dd>{country}</dd>
              </div>
              <div>
                <dt>{t('类别', 'Classes')}</dt>
                <dd>{classes.map((value) => `Class ${value}`).join(', ')}</dd>
              </div>
              <div>
                <dt>{t('业务编号', 'Business ID')}</dt>
                <dd>order-us-nova-042</dd>
              </div>
            </dl>
            <p>
              {t(
                '关闭后草稿步骤、优惠和付款 Demo 状态会保留在当前浏览器。',
                'Closing preserves the draft step, offer and Demo payment state in this browser.'
              )}
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}

function JourneyStep({
  eyebrow,
  title,
  intro,
  children
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="journey-step">
      <header>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      {children}
    </section>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <div className="journey-assistant">
      <span>MO</span>
      <p>{text}</p>
    </div>
  );
}

function JourneyActions({
  onBack,
  onNext,
  next,
  disabled = false
}: {
  onBack: () => void;
  onNext: () => void;
  next: string;
  disabled?: boolean;
}) {
  return (
    <div className="journey-actions">
      <Button variant="secondary" className="cp-secondary" onClick={onBack}>
        ←
      </Button>
      <Button className="cp-primary" onClick={onNext} disabled={disabled}>
        {next} →
      </Button>
    </div>
  );
}

function CouponResult({
  state,
  t,
  money
}: {
  state: PortalState;
  t: (zh: string, en: string) => string;
  money: (minor: number) => string;
}) {
  if (state.couponStatus === 'IDLE') return null;
  const messages = {
    VALID: t(
      `优惠已验证：减免 ${money(paymentFixture.discountMinor)}`,
      `Offer verified: ${money(paymentFixture.discountMinor)} off`
    ),
    EXPIRED: t(
      '此优惠券已过期，不能用于当前报价。',
      'This coupon has expired and cannot be used on this quote.'
    ),
    USED: t('此优惠券已经使用，不能重复使用。', 'This coupon has already been used.'),
    INAPPLICABLE: t(
      '此优惠券只适用于中国申请，不适用于当前美国业务。',
      'This coupon applies to China filings, not this US business.'
    ),
    NON_STACKABLE: t(
      '优惠码无效，或不能与当前活动叠加。',
      'The code is invalid or cannot be combined with the current offer.'
    )
  } as const;
  return (
    <div
      className={`journey-coupon-result ${state.couponStatus === 'VALID' ? 'is-valid' : 'is-invalid'}`}
      role="status"
    >
      {messages[state.couponStatus]}
    </div>
  );
}
