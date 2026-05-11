# Admin User Management

Admin user management is available in the Admin frontend under the `Users` menu.

## Permissions

Admin and Web accounts share the same `users` table.

- `admin` can view users and enable or disable non-restricted users.
- `super_admin` can view users, enable or disable users, and update roles.
- A user cannot disable their own account.
- A `super_admin` cannot remove their own `super_admin` role.
- Disabling a user revokes that user's active refresh tokens.

## API

All endpoints require an access token for a user with `admin` or `super_admin` role.

```http
GET /api/admin/users
Authorization: Bearer <accessToken>
```

```http
PATCH /api/admin/users/:userId/status
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "status": "disabled"
}
```

```http
PATCH /api/admin/users/:userId/role
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Only `super_admin` can call the role endpoint.

```json
{
  "role": "admin"
}
```

## Local Verification

1. Log in to Admin with a `super_admin` account.
2. Open `Users` from the left menu.
3. Confirm the user list loads.
4. Change a normal user's status to `disabled`, then back to `active`.
5. Change a normal user's role between `user` and `admin`.
6. Confirm self-disable is blocked.
7. Confirm self-demotion from `super_admin` is blocked.
