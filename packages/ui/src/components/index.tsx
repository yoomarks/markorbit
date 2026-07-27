import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react';
const cx = (...v: (string | undefined | false)[]) => v.filter(Boolean).join(' ');
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}
export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return <button className={cx('mo-button', `mo-button--${variant}`, className)} {...props} />;
}
export function IconButton({ label, className, ...props }: ButtonProps & { label: string }) {
  return <button aria-label={label} className={cx('mo-icon-button', className)} {...props} />;
}
type FieldBase = { label: string; error?: string | undefined; hint?: string | undefined };
export function TextInput({
  label,
  error,
  hint,
  id: givenId,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & FieldBase) {
  const auto = useId(),
    id = givenId ?? auto,
    desc = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cx('mo-field', className)}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={desc} {...props} />
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small className="mo-error" id={`${id}-error`}>
          Error: {error}
        </small>
      )}
    </div>
  );
}
export function TextArea({
  label,
  error,
  id: givenId,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldBase) {
  const auto = useId(),
    id = givenId ?? auto;
  return (
    <div className={cx('mo-field', className)}>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <small className="mo-error" id={`${id}-error`}>
          Error: {error}
        </small>
      )}
    </div>
  );
}
export function Select({
  label,
  error,
  children,
  id: givenId,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & FieldBase) {
  const auto = useId(),
    id = givenId ?? auto;
  return (
    <div className={cx('mo-field', className)}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      >
        {children}
      </select>
      {error && (
        <small className="mo-error" id={`${id}-error`}>
          Error: {error}
        </small>
      )}
    </div>
  );
}
export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="mo-check">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
export function RadioGroup({
  legend,
  name,
  options
}: {
  legend: string;
  name: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <fieldset className="mo-radio">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value}>
          <input type="radio" name={name} value={o.value} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('mo-badge', className)}>{children}</span>;
}
export function StatusBadge({
  status
}: {
  status: 'success' | 'warning' | 'danger' | 'info' | 'pending';
}) {
  const label = {
    success: '✓ Success',
    warning: '⚠ Warning',
    danger: '✕ Error',
    info: 'ⓘ Information',
    pending: '◷ Pending'
  }[status];
  return <span className={cx('mo-status', `mo-status--${status}`)}>{label}</span>;
}
export function Alert({
  tone = 'info',
  title,
  children
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx('mo-alert', `mo-alert--${tone}`)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('mo-card', className)}>{children}</section>;
}
export function PageHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mo-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </header>
  );
}
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mo-section-header">
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </header>
  );
}
export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mo-state">
      <span aria-hidden>○</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mo-state" role="alert">
      <span aria-hidden>!</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}
export function Skeleton({ label = 'Loading content' }: { label?: string }) {
  return (
    <span className="mo-skeleton" role="status">
      <span className="mo-sr-only">{label}</span>
    </span>
  );
}
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="mo-state" aria-live="polite">
      <Skeleton label={label} />
      <p>{label}…</p>
    </div>
  );
}
export function Tabs({
  tabs
}: {
  tabs: readonly { id: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div>
      <div role="tablist">
        {tabs.map((t) => (
          <button
            role="tab"
            aria-selected={active === t.id}
            key={t.id}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map(
        (t) =>
          active === t.id && (
            <div role="tabpanel" key={t.id}>
              {t.content}
            </div>
          )
      )}
    </div>
  );
}
export function Stepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className="mo-stepper" aria-label="Progress">
      {steps.map((s, i) => (
        <li aria-current={i === current ? 'step' : undefined} key={s}>
          <span>{i < current ? '✓' : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}
export function DataList({
  items
}: {
  items: readonly { label: string; value: ReactNode; status?: string }[];
}) {
  return (
    <ul className="mo-data-list">
      {items.map((i) => (
        <li key={i.label}>
          <span>{i.label}</span>
          <strong>{i.value}</strong>
          {i.status && <small>{i.status}</small>}
        </li>
      ))}
    </ul>
  );
}
export function KeyValueList({ items }: { items: readonly { key: string; value: ReactNode }[] }) {
  return (
    <dl className="mo-key-value">
      {items.map((i) => (
        <div key={i.key}>
          <dt>{i.key}</dt>
          <dd>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function AssumptionList({ items }: { items: readonly string[] }) {
  return (
    <div>
      <h4>Assumptions</h4>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
export function LimitationNotice({ items }: { items: readonly string[] }) {
  return (
    <Alert tone="warning" title="Limitations">
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </Alert>
  );
}
export function FixtureBanner() {
  return (
    <div className="mo-fixture" role="alert">
      <strong>Demonstration only — not legal advice or an official filing recommendation.</strong>
    </div>
  );
}
export interface RecommendationCardProps {
  optionCode: string;
  title: string;
  summary: string;
  rationale: string;
  assumptions: readonly string[];
  limitations: readonly string[];
  selected?: boolean;
  recommended?: boolean;
  fixtureOnly?: boolean;
  onSelect?: () => void;
}
export function RecommendationCard(p: RecommendationCardProps) {
  return (
    <Card className={cx('mo-recommendation', p.selected && 'is-selected')}>
      <div className="mo-recommendation__top">
        <Badge>{p.optionCode}</Badge>
        {p.recommended && <Badge className="mo-badge--brand">Recommended</Badge>}
        {p.fixtureOnly && <Badge className="mo-badge--warning">Fixture only</Badge>}
      </div>
      <h3>{p.title}</h3>
      <p>{p.summary}</p>
      <h4>Why this option</h4>
      <p>{p.rationale}</p>
      <AssumptionList items={p.assumptions} />
      <LimitationNotice items={p.limitations} />
      {p.onSelect && (
        <Button aria-pressed={p.selected} onClick={p.onSelect}>
          {p.selected ? 'Selected' : 'Choose this option'}
        </Button>
      )}
    </Card>
  );
}
export function TopBar({ context, actions }: { context: string; actions?: ReactNode }) {
  return (
    <header className="mo-topbar">
      <strong>{context}</strong>
      {actions}
    </header>
  );
}
export function SideNavigation({
  label = 'Primary',
  items
}: {
  label?: string;
  items: readonly { label: string; href: string; active?: boolean }[];
}) {
  return (
    <nav className="mo-side-nav" aria-label={label}>
      <ul>
        {items.map((i) => (
          <li key={i.label}>
            <a href={i.href} aria-current={i.active ? 'page' : undefined}>
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
export function AppShell({
  brand,
  navigation,
  topBar,
  children,
  internalOnly = false
}: {
  brand: string;
  navigation: ReactNode;
  topBar?: ReactNode;
  children: ReactNode;
  internalOnly?: boolean;
}) {
  return (
    <div className="mo-shell">
      <aside>
        <a className="mo-brand" href="#main">
          {brand}
        </a>
        {internalOnly && <Badge className="mo-badge--warning">Internal only</Badge>}
        {navigation}
      </aside>
      <div className="mo-shell__body">
        {topBar}
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
