# Auth API

Base URL in local development:

```txt
http://localhost:3000/api
```

If the API is started with `PORT=3001`, replace `3000` with `3001`.

## Account Model

The first-stage account model uses mainland China phone numbers only.

- Login identifier: `phoneNumber`
- Password: stored as bcrypt hash
- Roles: `user`, `admin`, `super_admin`
- Status: `active`, `disabled`
- Email and phone country code are intentionally not part of the current account model.

## Token Model

Login and registration return:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "tokenType": "Bearer",
  "user": {
    "id": "...",
    "phoneNumber": "13800138000",
    "role": "user",
    "status": "active"
  }
}
```

Access tokens are used in protected API requests:

```txt
Authorization: Bearer <accessToken>
```

Refresh tokens are stored hashed in MySQL. Refreshing rotates the token: the old refresh token is revoked and a new pair is returned.

## Register

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "phoneNumber": "13800138000",
  "password": "password123",
  "displayName": "Demo User"
}
```

Rules:

- `phoneNumber` must match mainland China mobile format: `^1[3-9]\d{9}$`
- `password` must be at least 8 characters
- new users are created as `role = user` and `status = active`

## Login

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "phoneNumber": "13800138000",
  "password": "password123"
}
```

Disabled users cannot log in.

## Refresh

```http
POST /auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "<refreshToken>"
}
```

Returns a new access token and refresh token. The submitted refresh token is revoked after successful refresh.

## Logout

```http
POST /auth/logout
Content-Type: application/json
```

```json
{
  "refreshToken": "<refreshToken>"
}
```

Revokes the submitted refresh token and returns:

```json
{
  "ok": true
}
```

## Current User

```http
GET /auth/me
Authorization: Bearer <accessToken>
```

Response:

```json
{
  "id": "...",
  "phoneNumber": "13800138000",
  "role": "user",
  "status": "active"
}
```

## Change Password

```http
POST /auth/change-password
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "currentPassword": "password123",
  "newPassword": "new-password-123"
}
```

Rules:

- both passwords must be at least 8 characters
- `currentPassword` must match the current password
- after a successful password change, all refresh tokens for the user are revoked
- the user should log in again after changing password

## Admin Access

Web users and Admin users share the same `users` table.

Admin frontend login still uses `phoneNumber + password`, but access to Admin APIs requires `role = admin` or `role = super_admin`.

During local development, promote an account with:

```bash
docker exec mysql-novel mysql -uaigc -paigc_password aigc \
  -e "UPDATE users SET role='super_admin' WHERE phone_number='13900139000';"
```
