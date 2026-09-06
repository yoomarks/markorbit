from pathlib import Path

source = Path('.github/workflows/ci.yml').read_text()

generic = "      browser_generic: ${{ steps.scope.outputs.browser_generic }}\n"
if source.count(generic) != 1:
    raise SystemExit('browser_generic output marker missing or duplicated')
source = source.replace(
    generic,
    generic + "      browser_provider_web: ${{ steps.scope.outputs.browser_provider_web }}\n",
    1,
)

fallback = "      - name: Explicit browser fallback\n"
if source.count(fallback) != 1:
    raise SystemExit('Explicit browser fallback marker missing or duplicated')
provider_step = (
    "      - name: Provider Web browser\n"
    "        if: needs.detect.outputs.browser_provider_web == 'true'\n"
    "        run: pnpm exec playwright test --config playwright.provider.config.ts --reporter=line\n"
)
source = source.replace(fallback, provider_step + fallback, 1)

condition = (
    "          needs.detect.outputs.browser == 'true' &&\n"
    "          needs.detect.outputs.browser_professional_review != 'true' &&\n"
)
if source.count(condition) != 1:
    raise SystemExit('fallback condition marker missing or duplicated')
source = source.replace(
    condition,
    "          needs.detect.outputs.browser == 'true' &&\n"
    "          needs.detect.outputs.browser_provider_web != 'true' &&\n"
    "          needs.detect.outputs.browser_professional_review != 'true' &&\n",
    1,
)

Path('scripts/tmp-880-ci-rendered.yml.txt').write_text(source)
