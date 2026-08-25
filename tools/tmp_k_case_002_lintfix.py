from pathlib import Path

p = Path('services/markreg/tests/knowledge-case-promotion.test.ts')
s = p.read_text()
s = s.replace(
    "  async accept(candidate: KnowledgeCaseCandidateV1, _principal: WorkspacePrincipal) {\n    this.candidates.push(structuredClone(candidate));\n    if (this.fail) throw new Error('connection reset after request dispatch');\n    return receipt(candidate);\n  }",
    "  accept(candidate: KnowledgeCaseCandidateV1, principal: WorkspacePrincipal) {\n    void principal;\n    this.candidates.push(structuredClone(candidate));\n    if (this.fail)\n      return Promise.reject(new Error('connection reset after request dispatch'));\n    return Promise.resolve(receipt(candidate));\n  }",
)
s = s.replace(
    "    const seen: Array<{ url: string; init?: RequestInit }> = [];",
    "    const seen: Array<{ url: string; init: RequestInit | undefined }> = [];",
)
s = s.replace(
    "    const fakeFetch: typeof fetch = async (input, init) => {\n      seen.push({ url: String(input), init });",
    "    const fakeFetch: typeof fetch = (input, init) => {\n      const url =\n        typeof input === 'string'\n          ? input\n          : input instanceof URL\n            ? input.href\n            : input.url;\n      seen.push({ url, init });",
)
s = s.replace(
    "        return new Response(JSON.stringify(receipt(candidate)), {\n          status: 202,\n          headers: { 'content-type': 'application/json' }\n        });",
    "        return Promise.resolve(\n          new Response(JSON.stringify(receipt(candidate)), {\n            status: 202,\n            headers: { 'content-type': 'application/json' }\n          })\n        );",
)
s = s.replace(
    "      return new Response(\n        JSON.stringify({\n          candidateId: candidate.candidateId,\n          collection: { collectionRef: 'case-evidence:test' }\n        }),\n        { status: 200, headers: { 'content-type': 'application/json' } }\n      );",
    "      return Promise.resolve(\n        new Response(\n          JSON.stringify({\n            candidateId: candidate.candidateId,\n            collection: { collectionRef: 'case-evidence:test' }\n          }),\n          { status: 200, headers: { 'content-type': 'application/json' } }\n        )\n      );",
)
p.write_text(s)
