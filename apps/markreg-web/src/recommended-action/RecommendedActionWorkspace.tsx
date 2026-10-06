import { Alert } from '@markorbit/ui';
import { LifecyclePanel } from '../LifecyclePanel.js';
import type { CustomerLifecycleClient } from '../api/lifecycle.js';
import './recommended-action.css';

export interface RecommendedActionMatterSummary {
  formalMatterId: string;
  title: string;
  jurisdiction: string;
  matterVersion: number;
  relationshipName: string;
}

export function RecommendedActionWorkspace({
  matter,
  client,
  readOnly = false,
  partial = false
}: {
  matter: RecommendedActionMatterSummary;
  client: CustomerLifecycleClient;
  readOnly?: boolean;
  partial?: boolean;
}) {
  return (
    <div className="ra-shell">
      <a className="ra-skip" href="#recommended-action-main">
        Skip to Matter guidance
      </a>
      <aside className="ra-sidebar" aria-label="Customer portal navigation">
        <a className="ra-brand" href="./customer-portal-preview.html">
          <span>M</span>
          <strong>MarkOrbit</strong>
        </a>
        <nav>
          <a href="./customer-portal-preview.html">Overview</a>
          <a className="is-current" href="#recommended-action-main" aria-current="page">
            Matters <b>1</b>
          </a>
          <a href="./customer-portal-preview.html">Documents</a>
          <a href="./customer-portal-preview.html">Messages</a>
        </nav>
        <div className="ra-relationship">
          <small>Customer relationship</small>
          <strong>{matter.relationshipName}</strong>
          <span>Authenticated · Active</span>
        </div>
      </aside>

      <div className="ra-workspace">
        <header className="ra-topbar">
          <div>
            <span className="ra-mobile-mark">M</span>
            <span className="ra-environment">CUSTOMER WORKSPACE · GOVERNED PREVIEW</span>
          </div>
          <button type="button" aria-label="Open customer account">
            LM
          </button>
        </header>

        <main id="recommended-action-main" className="ra-main">
          <nav className="ra-breadcrumbs" aria-label="Breadcrumb">
            <a href="./customer-portal-preview.html">Matters</a>
            <span aria-hidden="true">/</span>
            <span>{matter.title}</span>
          </nav>

          <header className="ra-matter-header">
            <div>
              <p>Trademark Matter</p>
              <h1>{matter.title}</h1>
              <span>
                {matter.jurisdiction} · Matter v{matter.matterVersion}
              </span>
            </div>
            <div className="ra-matter-state">
              <small>Internal Matter state</small>
              <strong>Needs attention</strong>
              <span>Not official-office status</span>
            </div>
          </header>

          <section className="ra-truth-strip" aria-label="Authority boundary">
            <span aria-hidden="true">i</span>
            <p>
              <strong>Guidance, not authorization.</strong> This workspace explains the current
              MarkReg lifecycle and records only your advisory preference. It cannot file, pay,
              contact an office or provider, or establish Official Truth.
            </p>
          </section>

          {partial && (
            <Alert tone="warning" title="Some secondary context is unavailable">
              The current governed recommendation remains visible. Historical context is partial; no
              missing event or deadline is inferred.
            </Alert>
          )}

          <section className="ra-attention" aria-labelledby="ra-attention-title">
            <div className="ra-section-heading">
              <div>
                <p>WHAT NEEDS YOUR ATTENTION</p>
                <h2 id="ra-attention-title">Lifecycle guidance</h2>
              </div>
              <span>Customer-safe projection</span>
            </div>
            <LifecyclePanel
              formalMatterId={matter.formalMatterId}
              client={client}
              disabled={readOnly}
              embedded
            />
          </section>

          <footer className="ra-footer">
            <span>Formal Matter {matter.formalMatterId}</span>
            <a href="./customer-portal-preview.html">Return to customer portal</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
