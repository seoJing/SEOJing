# Career Radar operations

## Required deployment configuration

Protect both `/ops/career*` and `/api/ops/career*` with the same Cloudflare Access application. The proxy verifies the signed Access assertion and fails closed unless these runtime values exist:

- `SEOJING_OPS_ACCESS_ISSUER`: the Access issuer, such as `https://<team>.cloudflareaccess.com`
- `SEOJING_OPS_ACCESS_AUD`: the Access application audience
- `SEOJING_OPS_ACCESS_EMAIL`: the permitted operator email
- `SEOJING_BACKEND_API_ORIGIN`: the Career API origin
- `SEOJING_BACKEND_ADMIN_API_TOKEN`: the backend admin bearer token; store it as a secret

`workers_dev` is disabled so the Ops proxy is not exposed on an alternate hostname outside the custom-domain Access policy.

## Publish flow

1. Load or create the full admin document (`{ aggregate, metadata? }`) in `/ops/career`.
2. Save and review the draft, including explicit sources and the actual-status observation.
3. Publish through the separate publish action.
4. Generate the checked-in frontend snapshot with `SEOJING_BACKEND_API_ORIGIN=https://api.seojing.com pnpm career:snapshot -- <slug>`.
5. Review the snapshot diff, run the frontend gates, and deploy the frontend.

Public Career pages only use validated checked-in snapshots. A backend publish alone does not change public frontend content.
