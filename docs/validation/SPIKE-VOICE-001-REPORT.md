# SPIKE-VOICE-001 — Self-hosted TTS feasibility

- **Result:** `WATCH`
- **Execution state:** blocked before model load
- **Product impact:** none
- **Authority:** experimental evidence only; not provider approval, production readiness, quality truth, or consent authority.

## Outcome

The candidate remains plausible for a future governed Voice Capability Implementation Profile, but this Windows path is not adoptable from the present evidence. The isolated official-package setup completed, then failed while importing PyTorch (`OSError`, `WinError 4551`, `torch/lib/c10.dll`). No model weights were downloaded and no audio was generated. Latency, real-time factor, VRAM use, concurrency and listening quality are therefore recorded as `NOT_MEASURED`, not estimated.

Recommendation: `WATCH`. Re-run only in an isolated, supported CUDA environment after pinning a mutually compatible PyTorch/torchaudio pair. Do not add the candidate to the repository or an approved Implementation Profile until the full benchmark and governance review pass.

## Pinned candidate and sources

- Official implementation: `QwenLM/Qwen3-TTS`, commit `022e286b98fbec7e1e916cb940cdf532cd9f488e`.
- Candidate model: `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`, revision `85e237c12c027371202489a0ec509ded67b5e4b5`.
- Official code and model metadata report Apache-2.0 licensing. Commercial legal review remains required before adoption; an open-source license is not voice/personality rights or consent.
- Official documentation describes Chinese/English support, streaming and 0.6B/1.7B variants: [Qwen3-TTS repository](https://github.com/QwenLM/Qwen3-TTS) and [0.6B model card](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice).

## Environment and procedure

The run used the existing machine only: Windows, Python 3.12.14, RTX 5060 Ti 16GB (`16311 MiB`), NVIDIA driver `591.86`, and 32GB system RAM. An isolated temporary virtual environment outside the repository was created; no lockfile or product dependency changed.

Installed resolution:

| Package        | Version  |
| -------------- | -------- |
| `qwen-tts`     | `0.1.1`  |
| `transformers` | `4.57.3` |
| `torch`        | `2.14.0` |
| `torchaudio`   | `2.11.0` |

Reproduction sequence:

```powershell
$python = 'C:\Users\marko\AppData\Roaming\uv\python\cpython-3.12.14-windows-x86_64-none\python.exe'
$environment = 'C:\Users\marko\AppData\Local\Temp\mo-qwen3-tts-spike-env'
& $python -m venv $environment
& "$environment\Scripts\python.exe" -m pip install --upgrade pip
& "$environment\Scripts\python.exe" -m pip install qwen-tts
& "$environment\Scripts\python.exe" -c "import torch, qwen_tts, transformers"
```

Observed terminal boundary:

```text
OSError: [WinError 4551] ... Error loading ... torch\lib\c10.dll or one of its dependencies.
```

## Frozen evaluation inputs

- Chinese: `欢迎使用 Mark Orbit。本段仅用于本地语音合成基准，不构成商业事实或专业意见。`
- English: `Welcome to Mark Orbit. This local synthesis sample is benchmark evidence, not commercial truth or professional advice.`
- Chunking: one Chinese and one English short segment, as recorded in the JSON evidence.
- Voice clone: not attempted because no explicitly consented reference recording was placed in scope.

## Measurement matrix

| Dimension                       | Result          | Reason                                                               |
| ------------------------------- | --------------- | -------------------------------------------------------------------- |
| cold/warm latency               | not measured    | runtime import failed                                                |
| real-time factor                | not measured    | no audio generated                                                   |
| peak VRAM                       | not measured    | CUDA/model load not reached                                          |
| CN/EN listening quality         | not measured    | no audio generated                                                   |
| chunk boundary quality          | not measured    | no audio generated                                                   |
| concurrency                     | not measured    | single invocation unavailable                                        |
| clone consistency               | not measured    | consented reference audio absent                                     |
| software/model acquisition cost | no fee observed | Apache-2.0 artifacts; excludes hardware, operations and legal review |

No market price, provider cost, quality score or production capacity is inferred from missing evidence.

## Adoption gate for a later rerun

A future `ADOPT` recommendation requires: successful isolated installation; exact model/runtime revisions; cold and warm CN/EN runs; audio duration and wall-clock RTF; peak VRAM; sequential and concurrency tests; documented chunking; human listening rubric with named reviewers; consented clone input if cloning is evaluated; dependency/license/security review; and mapping only to the existing `voice.synthesize@1.0.0` contract through an Implementation Profile/adapter.

## Non-goals preserved

No GPU purchase, production Voice Cloud, provider credential, Voice/Avatar UI, Lite navigation, clone enablement, product contract change, model dependency, or deployment configuration was introduced.
