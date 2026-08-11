from pathlib import Path

path = Path('apps/lite-web/src/features/today/TodayWorkspace.tsx')
text = path.read_text()
text = text.replace('  StatusBadge\n', '')
text = text.replace('  StatusBadge,\n', '')
old = '<StatusBadge status={recommendation.status} />'
if old not in text:
    raise SystemExit('recommendation StatusBadge anchor missing')
text = text.replace(old, '<Badge>{recommendation.status}</Badge>', 1)
old = '<StatusBadge status={journey.handoffState} />'
if old not in text:
    raise SystemExit('handoff StatusBadge anchor missing')
text = text.replace(old, '<Badge>{actionStatus(journey)}</Badge>', 1)
old = '''                <PreparedActionPanel
                  recommendation={item.recommendation}
                  journey={journey}
                  busy={busy}
                  onPrepare={() => void prepare()}
                  onConfirm={() => void confirm()}
                />'''
new = '''                <PreparedActionPanel
                  recommendation={item.recommendation}
                  {...(journey ? { journey } : {})}
                  busy={busy}
                  onPrepare={() => void prepare()}
                  onConfirm={() => void confirm()}
                />'''
if old not in text:
    raise SystemExit('PreparedActionPanel exact-optional anchor missing')
path.write_text(text.replace(old, new, 1))

for cleanup in [
    Path('wp05-static-debug.txt'),
    Path('.github/workflows/wp05-static-diagnostic.yml'),
    Path('scripts/wp05-final-static-fix.py'),
]:
    if cleanup.exists():
        cleanup.unlink()
