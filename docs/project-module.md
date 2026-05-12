# Project Module

Projects are the first business boundary above users. Generation tasks can be attached to a project so later modules such as assets, MinIO storage, provider billing, and task history have a stable parent entity.

## Data Model

```txt
projects
  id
  user_id
  name
  description
  status
  created_at
  updated_at
```

Rules:

- `user_id + name` is unique.
- `status` is `active` or `archived`.
- `tasks.project_id` is nullable for historical tasks and early smoke tests.
- Deleting a project is not supported at this stage.

## API

All endpoints require an authenticated user.

```http
POST /api/projects
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Default Project",
  "description": "Optional description"
}
```

```http
GET /api/projects
Authorization: Bearer <accessToken>
```

```http
GET /api/projects/:projectId
Authorization: Bearer <accessToken>
```

Access rules:

- `user` can only see their own projects.
- `admin` and `super_admin` can see all projects.
- Task creation can only bind an active project owned by the current user.

## Generation Task Binding

`POST /api/generation/tasks` accepts optional `projectId`:

```json
{
  "projectId": "project_id",
  "type": "text_to_image",
  "model": "mock-image-v1",
  "prompt": "a clean product photo of a ceramic cup",
  "ratio": "1:1"
}
```

If `projectId` is omitted, the task remains unassigned.

## Frontend

Web now supports:

- project list loading after login
- project creation
- active project selection
- passing `projectId` during task creation

Admin now supports:

- `Projects` menu
- all-project list
- owner phone display
- task count display
