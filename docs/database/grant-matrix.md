# Database grant matrix

| Surface                        | `anon`                      | `authenticated`                         | `service_role`                       |
| ------------------------------ | --------------------------- | --------------------------------------- | ------------------------------------ |
| `public` schema `CREATE`       | Denied                      | Denied                                  | Denied                               |
| `private` schema usage         | Denied                      | Denied                                  | Denied                               |
| Application-table direct DML   | Denied                      | Denied                                  | Denied                               |
| Safe business/content `SELECT` | Denied                      | Active AAL2 admin-session RLS only      | Denied                               |
| Appointment/customer `SELECT`  | Denied                      | Bounded safe projection RPC only        | Denied                               |
| Public projection RPCs         | Execute                     | Execute                                 | Execute                              |
| Admin mutation RPCs            | Denied                      | Execute; function enforces admin + AAL2 | Denied                               |
| Public-write RPCs              | Denied                      | Denied                                  | Reviewed booking/manage/contact only |
| Private helpers                | Denied                      | Denied                                  | No direct API execution              |
| `gallery-staging`              | No direct policy            | No direct policy                        | Signed/finalize server flow          |
| `gallery-public`               | Public object delivery only | Public object delivery only             | Finalize/cleanup server flow         |

Important:

- Function execution is not authorization by itself. Every admin RPC calls
  `private.assert_admin_aal2()`, which also requires a registered, active
  database-backed admin session.
- The service-role client belongs in one server-only module and must use
  reviewed RPCs, not arbitrary table writes.
- `public.appointments` contains credential hashes. Do not grant it broad
  `SELECT`, including to the admin browser path.
- RLS remains enabled even on tables that currently have no public policy.
