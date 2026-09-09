# SPIKE-AVATAR-001 — Talking-avatar feasibility

- **Result:** `WATCH`
- **Execution state:** blocked at safe preflight
- **Product impact:** none
- **Authority:** experimental evidence only; not identity verification, likeness consent, provider approval, or production readiness.

## Outcome

The primary MuseTalk-class candidate remains technically plausible for a future governed Avatar Capability Implementation Profile, but it is not adoptable from current evidence. The present machine has sufficient nominal GPU memory for an isolated attempt, but the pinned official path requires prerequisites and inputs that are not currently satisfied:

1. the official setup recommends Python 3.10 and PyTorch/CUDA versions that are not installed in the isolated environment;
2. FFmpeg is not available;
3. no explicitly consented avatar likeness and matching rights-cleared speech fixture were placed in scope.

The official repository's internet-sourced test data was not used because its own license notice limits that data to non-commercial research. No weights were downloaded and no MP4 was generated. Lip sync, identity consistency, 720p/1080p throughput, VRAM, long-form stability and clip-boundary quality are therefore recorded as `NOT_MEASURED`, not estimated.

Recommendation: `WATCH`. Re-run only after a rights/consent binding exists for purpose-built fixtures and a reproducible isolated runtime is ready. Any later implementation must remain behind the existing Avatar Capability and Implementation Profile boundaries.

## Pinned candidates and sources

Primary candidate:

- Official implementation: `TMElyralab/MuseTalk`, commit `0a89dec45a0192b824e3cf4daf96c239440c5ed8`.
- Candidate line: MuseTalk 1.5.
- The official project reports MIT code licensing and commercial model use, while requiring separate compliance for transitive models and limiting its internet-collected test data to non-commercial research: [MuseTalk README and license notes](https://github.com/TMElyralab/MuseTalk#disclaimerlicense).
- The official documentation also identifies known identity-detail and jitter limitations; these are upstream claims, not MarkOrbit benchmark conclusions.

Optional comparison:

- `antgroup/echomimic`, commit `c32b3a557003f84ead1483a2d2386035685d984d`.
- Apache-2.0 repository license observed: [EchoMimic license](https://github.com/antgroup/echomimic/blob/main/LICENSE).
- Not executed because it would not resolve the missing rights-cleared fixture or isolated runtime prerequisites.

License labels do not grant likeness, voice, trademark, privacy or publicity rights. A transitive dependency and model-weight review remains mandatory before adoption.

## Environment and safe preflight

| Item                          | Observed                           |
| ----------------------------- | ---------------------------------- |
| OS                            | Windows                            |
| GPU                           | NVIDIA GeForce RTX 5060 Ti         |
| GPU memory                    | 16311 MiB                          |
| NVIDIA driver                 | 591.86                             |
| system RAM                    | 32GB                               |
| available Python              | 3.12.14, 3.13.15, 3.14             |
| candidate recommendation      | Python 3.10, CUDA 11.7-class setup |
| FFmpeg                        | unavailable                        |
| rights-cleared avatar fixture | unavailable                        |
| rights-cleared speech fixture | unavailable                        |

Reproducible preflight:

```powershell
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
py -0p
Get-Command ffmpeg
rg --files | Where-Object { $_ -match '\.(mp3|wav|mp4|mov|png|jpg|jpeg)$' }
git ls-remote https://github.com/TMElyralab/MuseTalk.git refs/heads/main
git ls-remote https://github.com/antgroup/echomimic.git refs/heads/main
```

The media inventory returned no repository fixtures. `Get-Command ffmpeg` failed. No external likeness or audio was substituted.

## Frozen future benchmark matrix

A later rerun must use a synthetic or explicitly consented, purpose-bound avatar and speech pair whose rights binding is stored outside this report. It must freeze the source hashes without embedding biometric media in the repository.

| Dimension            | Required measurement                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| lip sync             | named human rubric plus a pinned automated metric, with limitations        |
| identity consistency | first/middle/last-frame review and artifact notes                          |
| 720p and 1080p       | wall time, output duration, effective FPS and RTF                          |
| VRAM                 | cold-load and peak inference MiB                                           |
| long form            | at least one bounded multi-segment run with drift observations             |
| clip boundaries      | seam review across separately generated reusable clips                     |
| concurrency          | one and two concurrent jobs, without extrapolation                         |
| cost                 | measured machine time and operations assumptions; no invented market price |

The output must be registered only as experimental ClipArtifact evidence with exact implementation, rights and provenance references. Generated output is not an AvatarProfile, identity proof, consent proof or execution authority.

## Adoption gate

`ADOPT` requires successful isolated execution; pinned code/model/dependency revisions; safe input hashes; rights and responsibility review; MP4 hashes and metadata; full measurement matrix; transitive license/security review; failure and recovery behavior; and an adapter mapped to the existing `avatar.renderSpeech@1.0.0` contract. Realtime streaming, production hosting and UI remain separate deferred decisions.

## Non-goals preserved

No Production Avatar Cloud, realtime avatar, model dependency, provider credential, UI/navigation, identity inference, consent creation, external publication, GPU purchase or product-contract change was introduced.
