# SPIKE-MEDIA-CAPACITY-001 — Media capacity and cost model

- **Result:** `WATCH`
- **Measured production capacity:** unavailable
- **Product/billing impact:** none
- **Authority:** bounded benchmark synthesis only; not an invoice, capacity commitment, provider approval, procurement authorization, or SLA.

## Outcome

The available Voice and Avatar evidence does not support a numeric capacity or cost decision. Voice stopped before model loading, and Avatar stopped at safe preflight. Consequently there is no measured real-time factor, latency, peak VRAM, concurrency, 720p/1080p throughput or quality result to normalize.

The model deliberately returns `null` for every derived capacity and cost field. A 16GB GPU nameplate and a model parameter count are not substitutes for completed inference. No cloud price, electricity price, utilization rate or operations allocation was authorized as an input, so estimated GPU cost per output minute is also `null`.

Recommendation: `WATCH`. Do not procure capacity or expose a production media SLA. Complete the source benchmarks first, then recalculate with measured inputs.

## Traceable source evidence

| Source           | Exact repository commit                    | Evidence blob                              | State                     |
| ---------------- | ------------------------------------------ | ------------------------------------------ | ------------------------- |
| SPIKE-VOICE-001  | `1fcb10260021324f2a7646b3a78e31db15349945` | `47a985e4327838b047737e05cd4a55489a4e4c1b` | blocked before model load |
| SPIKE-AVATAR-001 | `5cf1d98ebf264b77404ba400b38b3b84bd49133d` | `4825c476d90e6207306bfe9e97e37f9313fd3832` | blocked at safe preflight |

The machine-readable model is [SPIKE-MEDIA-CAPACITY-001-MODEL.json](./SPIKE-MEDIA-CAPACITY-001-MODEL.json). Its source paths and Git blob IDs allow reviewers to verify that conclusions came from the merged evidence rather than mutable local files.

## Normalized calculations

For a successful future run:

```text
RTF = wall-clock seconds / generated-media seconds
output minutes per GPU hour = 60 / RTF
GPU cost per output minute = GPU hourly cost × RTF / 60
pipeline latency = voice wall time + avatar wall time + measured orchestration overhead
pipeline capacity = minimum(measured voice capacity, measured avatar capacity)
```

Concurrency must use completed simultaneous jobs. It must not be inferred by dividing GPU memory by single-job peak memory because allocator behavior, kernels, batching, thermal limits and model residency are non-linear.

## Current comparison

| Dimension     | Voice                                | Avatar                                                | Combined decision      |
| ------------- | ------------------------------------ | ----------------------------------------------------- | ---------------------- |
| execution     | failed before model load             | stopped at safe preflight                             | no pipeline run        |
| latency / RTF | not measured                         | not measured                                          | not calculable         |
| VRAM          | not measured                         | not measured                                          | not calculable         |
| concurrency   | not measured                         | not measured                                          | not calculable         |
| quality       | not measured                         | not measured                                          | no acceptance evidence |
| license       | Apache-2.0 observed; review required | code/model claims plus transitive and likeness review | unresolved             |
| cost/minute   | not calculable                       | not calculable                                        | not calculable         |

Upstream performance statements are not copied into the capacity model because they were produced on different hardware and are not MarkOrbit observations.

## Minimum evidence before recalculation

1. Exact code, model, driver, runtime and dependency versions.
2. Rights-cleared, hashed CN/EN audio and synthetic or consent-bound avatar fixtures.
3. Cold and warm runs with wall-clock and output duration.
4. Peak GPU memory sampled during inference.
5. Sequential plus one/two-job concurrency runs.
6. 720p and 1080p avatar outputs; long-form and reusable-clip seam tests.
7. Failure/retry/recovery and queue-wait observations.
8. Named quality-review rubric and evidence references.
9. Approved infrastructure price, currency, billing period and utilization assumption.
10. Separate security, license, likeness/voice rights and commercial review.

Only after these inputs exist may the formulas produce numbers. Estimates must retain ranges and their source assumptions; measured and estimated values must remain distinct.

## Architecture boundary

Any later candidate remains an Implementation Profile/adapter behind the existing Voice and Avatar Capability contracts. Media capacity evidence does not modify the Provider Registry, authorize an implementation, mutate billing, create an Execution release, or turn generated artifacts into verified identity or official truth.

## Non-goals preserved

No GPU procurement, production autoscaling, external billing, provider selection, runtime deployment, public endpoint, SLA, Lite navigation or product-contract mutation was introduced.
