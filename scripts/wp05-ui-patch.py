from pathlib import Path

app = Path('apps/lite-web/src/App.tsx')
text = app.read_text()

def once(old: str, new: str, name: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'{name} anchor not found')
    text = text.replace(old, new, 1)

once(
    "import { MatterWorkspace } from './features/matters/MatterWorkspace.js';\n",
    "import { MatterWorkspace } from './features/matters/MatterWorkspace.js';\nimport { TodayWorkspace } from './features/today/TodayWorkspace.js';\n",
    'Today import',
)
once(
    "            surface === 'matters'\n              ? `Workspace · ${activeWorkspaceId || 'not selected'}`\n              : 'Northstar IP · Fixture workspace'\n",
    "            surface === 'matters' || surface === 'today'\n              ? `Workspace · ${activeWorkspaceId || 'not selected'}`\n              : 'Northstar IP · Fixture workspace'\n",
    'topbar context',
)
once(
    "          actions={<Badge>{surface === 'matters' ? 'Authenticated' : 'Not live data'}</Badge>}\n",
    "          actions={\n            <Badge>\n              {surface === 'matters' || surface === 'today' ? 'Authenticated' : 'Not live data'}\n            </Badge>\n          }\n",
    'topbar badge',
)
once(
    "        {surface !== 'matters' && <FixtureBanner />}\n",
    "        {surface !== 'matters' && surface !== 'today' && <FixtureBanner />}\n",
    'fixture banner',
)
old_today = """        ) : surface === 'today' ? (
          <>
            <PageHeader
              title="Today"
              description="A calm view of the work that needs professional attention."
            />
            <div className="mo-grid">
              <Card>
                <h2>Pending attention</h2>
                <DataList
                  items={[
                    { label: 'Client intake review', value: '4', status: 'Due today' },
                    { label: 'Draft publish packages', value: '2', status: 'Awaiting approval' }
                  ]}
                />
              </Card>
              <Card>
                <h2>Opportunities</h2>
                <DataList items={[{ label: 'Evidence observations', value: '3' }]} />
              </Card>
              <Card>
                <h2>Work</h2>
                <DataList items={[{ label: 'Customers needing review', value: '1' }]} />
              </Card>
            </div>
          </>
"""
new_today = """        ) : surface === 'today' ? (
          activeWorkspaceId ? (
            <TodayWorkspace workspaceId={activeWorkspaceId} />
          ) : (
            <ErrorState
              title="Select a Workspace"
              description="A valid Workspace context is required to load durable Today Recommendations."
            />
          )
"""
once(old_today, new_today, 'Today fixture block')
app.write_text(text)

today = Path('apps/lite-web/src/features/today/TodayWorkspace.tsx')
today_text = today.read_text()
anchor = "import { createTodayClient, TodayHttpError, type TodayClient } from '../../api/product-loop.js';\n"
if anchor not in today_text:
    raise SystemExit('TodayWorkspace import anchor not found')
today.write_text(today_text.replace(anchor, anchor + "import './today.css';\n", 1))

Path('.github/workflows/wp05-ui-one-shot.yml').unlink()
Path('scripts/wp05-ui-patch.py').unlink()
