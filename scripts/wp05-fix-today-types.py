from pathlib import Path

path = Path('apps/lite-web/src/features/today/TodayWorkspace.tsx')
text = path.read_text()
old = """      <ErrorState
        title={permission ? 'Today access denied' : 'Lite Today unavailable'}
        description={error.message}
        onRetry={permission ? undefined : () => void reload()}
      />"""
new = """      <ErrorState
        title={permission ? 'Today access denied' : 'Lite Today unavailable'}
        description={error.message}
        {...(!permission ? { onRetry: () => void reload() } : {})}
      />"""
if old not in text:
    raise SystemExit('ErrorState exact-optional anchor missing')
text = text.replace(old, new, 1)
old_tone = "tone={error.status === 409 || error.status === 422 ? 'warning' : 'danger'}"
if old_tone not in text:
    raise SystemExit('Alert tone anchor missing')
path.write_text(text.replace(old_tone, 'tone="warning"', 1))
Path('.github/workflows/wp05-fix-today-types.yml').unlink()
Path('scripts/wp05-fix-today-types.py').unlink()
