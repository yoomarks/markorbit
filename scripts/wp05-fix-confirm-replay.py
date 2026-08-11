from pathlib import Path

path = Path('services/lite/src/prepared-action.ts')
text = path.read_text()
old = """    const confirmed = await this.store.confirm(command);
    if (confirmed.handoffState === 'HANDOFF_COMPLETED') return confirmed;
    const plan = await this.store.planFor(command.workspaceId, command.preparedAction.id);"""
new = """    const confirmed = await this.store.confirm(command);
    const current = await this.store.findJourney(
      command.workspaceId,
      command.preparedAction.id
    );
    if (current?.handoffState === 'HANDOFF_COMPLETED') return current;
    const journey = current ?? confirmed;
    const plan = await this.store.planFor(command.workspaceId, command.preparedAction.id);"""
if old not in text:
    raise SystemExit('confirmAndHandoff replay anchor missing')
text = text.replace(old, new, 1)
old = """    const confirmation = confirmed.confirmation;
    if (!confirmation)"""
new = """    const confirmation = journey.confirmation;
    if (!confirmation)"""
if old not in text:
    raise SystemExit('confirmation source anchor missing')
text = text.replace(old, new, 1)
old = """        confirmed.preparedAction,
        plan,
        confirmation,
        `prepared-action-handoff:${confirmed.preparedAction.preparedActionId}`"""
new = """        journey.preparedAction,
        plan,
        confirmation,
        `prepared-action-handoff:${journey.preparedAction.preparedActionId}`"""
if old not in text:
    raise SystemExit('handoff source anchor missing')
path.write_text(text.replace(old, new, 1))
Path('.github/workflows/wp05-fix-confirm-replay.yml').unlink()
Path('scripts/wp05-fix-confirm-replay.py').unlink()
