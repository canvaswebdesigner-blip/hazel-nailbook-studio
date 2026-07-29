# Admin bootstrap

This is a production-owner action, not a development seed.

## Preconditions

- Confirm the exact production Supabase project.
- Confirm Hazel's real administrator email directly with the owner.
- Verify production SMTP and recovery delivery.
- Have a tested database backup.
- Confirm that the application-side server-only login, MFA enrollment, AAL2
  checks, session limits, and recovery flow are deployed.

## Procedure

1. Create or invite the Auth user through the trusted Supabase administration
   surface. Public signup remains disabled.
2. Copy the generated Auth user UUID. Do not infer or invent it.
3. In a controlled SQL session, insert the matching profile and role:

```sql
begin;

insert into public.profiles (id, full_name)
values ('VERIFIED_AUTH_USER_UUID', 'Hazel Ağaoğlu');

insert into public.user_roles (user_id, role)
values ('VERIFIED_AUTH_USER_UUID', 'admin');

commit;
```

4. Sign in through the application and enroll TOTP MFA.
5. Confirm the session reaches AAL2 and that an AAL1 session cannot access a
   protected admin loader or mutation.
6. Store MFA recovery ownership and emergency access procedure outside the
   repository.
7. Record the bootstrap as an operational event without logging passwords,
   recovery codes, TOTP secrets, or session tokens.

Do not create a public registration page and do not seed an admin user into
local, preview, or production migrations.
