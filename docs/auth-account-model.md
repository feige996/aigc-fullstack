# Auth Account Model

The current account model is phone-first and designed for China-focused usage.

## User Model

```txt
users
  id
  phone_number
  password_hash
  display_name
  role
  status
  created_at
  updated_at
```

`phone_number` is unique. Email is intentionally not part of the first-stage account model.

## Roles

```txt
user          Web user. Cannot access Admin.
admin         Admin user. Can access Admin task operations.
super_admin   Full admin. Reserved for owner-level operations.
```

## Status

```txt
active     User can log in and use existing tokens.
disabled   User cannot log in. Existing JWTs are rejected by the API.
```

## Development Super Admin

Registration creates `role = user`. During development, promote a phone number manually:

```bash
docker exec mysql-novel mysql -uaigc -paigc_password aigc \
  -e "UPDATE users SET role='super_admin' WHERE phone_number='13900139000';"
```

Use the promoted phone number to log in to Admin.

## Current Login Methods

Implemented:

```txt
phone + password
```

Planned later:

```txt
phone + SMS code
password reset
admin audit logs
fine-grained RBAC permissions
```
