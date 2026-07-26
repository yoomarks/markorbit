import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react';

type Common = { className?: string };
const cx = (...names: Array<string | undefined | false>) => names.filter(Boolean).join(' ');

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};
export function Button({ className, variant = 'primary', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      className={cx('mo-button', `mo-button--${variant}`, className)}
      type={type}
      {...props}
    />
  );
}
export function IconButton({ label, className, ...props }: ButtonProps & { label: string }) {
  return <Button aria-label={label} className={cx('mo-icon-button', className)} {...props} />;
}

type FieldProps = Common & { label: string; error?: string; hint?: string };
function useFieldIds(error?: string, hint?: string) {
  const id = useId();
  return {
    id,
    describedBy:
      [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  };
}
export function TextInput({
  label,
  error,
  hint,
  className,
  id: givenId,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const ids = useFieldIds(error, hint);
  const id = givenId ?? ids.id;
  return (
    <div className={cx('mo-field', className)}>
      <label htmlFor={id}>{label}</label>
      <input
        className="mo-control"
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={ids.describedBy}
        {...props}
      />
      {hint && (
        <span className="mo-help" id={`${ids.id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="mo-error" id={`${ids.id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
export function TextArea({
  label,
  error,
  hint,
  className,
  id: givenId,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ids = useFieldIds(error, hint);
  const id = givenId ?? ids.id;
  return (
    <div className={cx('mo-field', className)}>
      <label htmlFor={id}>{label}</label>
      <textarea
        className="mo-control"
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={ids.describedBy}
        {...props}
      />
      {hint && (
        <span className="mo-help" id={`${ids.id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="mo-error" id={`${ids.id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
export function Select({
  label,
  error,
  hint,
  className,
  id: givenId,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const ids = useFieldIds(error, hint);
  const id = givenId ?? ids.id;
  return (
    <div className={cx('mo-field', className)}>
      <label htmlFor={id}>{label}</label>
      <select
        className="mo-control"
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={ids.describedBy}
        {...props}
      >
        {children}
      </select>
      {hint && (
        <span className="mo-help" id={`${ids.id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="mo-error" id={`${ids.id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
export function Checkbox({
  label,
  className,
  ...props
}: Common & { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={cx('mo-choice', className)}>
      <input id={id} type="checkbox" {...props} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
export type RadioOption = { value: string; label: string; description?: string };
export function RadioGroup({
  legend,
  name,
  options,
  value,
  onChange,
  className
}: Common & {
  legend: string;
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset className={cx('mo-choice-group', className)}>
      <legend className="mo-legend">{legend}</legend>
      {options.map((option) => (
        <label className="mo-choice" key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange?.(option.value)}
          />
          <span>
            {option.label}
            {option.description && (
              <small className="mo-help" style={{ display: 'block' }}>
                {option.description}
              </small>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function Badge({ children, className }: Common & { children: ReactNode }) {
  return <span className={cx('mo-badge', className)}>{children}</span>;
}
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
const statusSymbol: Record<StatusTone, string> = {
  success: '✓',
  warning: '!',
  danger: '×',
  info: 'i',
  neutral: '•'
};
export function StatusBadge({
  tone,
  children,
  className
}: Common & { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={cx('mo-badge', tone !== 'neutral' && `mo-badge--${tone}`, className)}>
      <span aria-hidden="true">{statusSymbol[tone]}</span>
      {children}
    </span>
  );
}
export function Alert({
  tone = 'info',
  title,
  children,
  className
}: Common & { tone?: Exclude<StatusTone, 'neutral'>; title: string; children?: ReactNode }) {
  return (
    <div
      className={cx('mo-alert', `mo-alert--${tone}`, className)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cx('mo-card', className)} {...props} />;
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
export function SectionHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mo-section-header">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </header>
  );
}
function State({
  icon,
  title,
  description,
  action,
  role
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <div className="mo-state" role={role}>
      <div aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function EmptyState(props: { title: string; description: string; action?: ReactNode }) {
  return <State icon="◇" {...props} />;
}
export function ErrorState(props: { title: string; description: string; action?: ReactNode }) {
  return <State icon="!" role="alert" {...props} />;
}
export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="mo-state" role="status" aria-live="polite">
      <span className="mo-visually-hidden">{label}</span>
      <div className="mo-stack" aria-hidden="true">
        <Skeleton />
        <Skeleton width="70%" />
        <Skeleton width="85%" />
      </div>
    </div>
  );
}
export function Skeleton({ width = '100%', className }: Common & { width?: string }) {
  return <span className={cx('mo-skeleton', className)} style={{ width }} aria-hidden="true" />;
}
export type TabItem = { id: string; label: string; content: ReactNode };
export function Tabs({ items, initialId }: { items: TabItem[]; initialId?: string }) {
  const [active, setActive] = useState(initialId ?? items[0]?.id);
  const selected = items.find((item) => item.id === active);
  return (
    <div>
      <div className="mo-tabs" role="tablist">
        {items.map((item) => (
          <button
            className="mo-tab"
            role="tab"
            aria-selected={item.id === active}
            aria-controls={`${item.id}-panel`}
            id={`${item.id}-tab`}
            key={item.id}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {selected && (
        <div role="tabpanel" id={`${selected.id}-panel`} aria-labelledby={`${selected.id}-tab`}>
          {selected.content}
        </div>
      )}
    </div>
  );
}
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mo-stepper" aria-label="Progress">
      {steps.map((step, index) => (
        <li
          className={cx(
            'mo-step',
            index === current && 'mo-step--current',
            index < current && 'mo-step--complete'
          )}
          aria-current={index === current ? 'step' : undefined}
          key={step}
        >
          {step}
        </li>
      ))}
    </ol>
  );
}
export function DataList({
  items,
  empty = 'No items'
}: {
  items: Array<{ label: string; value: ReactNode }>;
  empty?: string;
}) {
  if (!items.length)
    return <EmptyState title={empty} description="There is no information to show yet." />;
  return (
    <div className="mo-datalist">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
export function KeyValueList({
  items
}: {
  items: Array<{ term: string; description: ReactNode }>;
}) {
  return (
    <dl className="mo-kv">
      {items.map((item) => (
        <div key={item.term}>
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
export function AssumptionList({ items }: { items: string[] }) {
  return (
    <div>
      <h4 className="mo-list-title">Assumptions</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
export function LimitationNotice({ items }: { items: string[] }) {
  return (
    <div className="mo-limitation">
      <h4 className="mo-list-title">Limitations</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
export function FixtureBanner() {
  return (
    <div className="mo-fixture" role="alert">
      <span aria-hidden="true">⚠ </span>Demonstration only — not legal advice or an official filing
      recommendation.
    </div>
  );
}
export type RecommendationCardProps = Common & {
  optionCode: string;
  title: string;
  summary: string;
  rationale: string;
  assumptions: string[];
  limitations: string[];
  selected?: boolean;
  recommended?: boolean;
  fixtureOnly?: boolean;
  onSelect?: () => void;
};
export function RecommendationCard({
  optionCode,
  title,
  summary,
  rationale,
  assumptions,
  limitations,
  selected,
  recommended,
  fixtureOnly,
  className,
  onSelect
}: RecommendationCardProps) {
  return (
    <Card
      className={cx('mo-recommendation', selected && 'mo-recommendation--selected', className)}
      aria-label={`${optionCode}: ${title}`}
    >
      {fixtureOnly && <Badge className="mo-badge--warning">Fixture only</Badge>}
      <div className="mo-cluster">
        <Badge>Option {optionCode}</Badge>
        {recommended && <StatusBadge tone="success">Recommended</StatusBadge>}
      </div>
      <div>
        <h3>{title}</h3>
        <p>{summary}</p>
      </div>
      <div>
        <h4 className="mo-list-title">Why this option</h4>
        <p>{rationale}</p>
      </div>
      <AssumptionList items={assumptions} />
      <LimitationNotice items={limitations} />
      {onSelect && (
        <Button aria-pressed={selected} onClick={onSelect}>
          {selected ? 'Selected' : `Choose option ${optionCode}`}
        </Button>
      )}
    </Card>
  );
}
