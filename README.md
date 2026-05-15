# Smart Life Manager

A beginner-friendly full-stack web app for managing expenses, todos, reminders, lending, notifications, charts, and simple smart insights.

## Tech Stack

- Frontend: HTML, CSS, JavaScript, Chart.js
- Backend: Java, Spring Boot
- Database: MySQL
- Deployment helper: Docker Compose

## Project Structure

```text
frontend/
  login.html
  dashboard.html
  expense.html
  todo.html
  notifications.html
  css/style.css
  js/script.js

backend/
  src/main/java/com/smartlife/manager/
    controller/
    service/
    repository/
    model/
    config/
  src/main/resources/application.properties
  pom.xml

docker-compose.yml
```

## Run With Docker

```bash
docker compose up --build
```

Backend API: `http://127.0.0.1:8081`

Local MySQL defaults:

- Username: `root`
- Password: `123456789`

Frontend files can be opened directly in the browser, or served with any static server from the `frontend` folder.

## Build Order

1. Login system
2. Basic expense manager
3. Premium todo
4. Recurring expense
5. Reminders
6. Lending
7. Charts
8. Smart insights
9. Notifications
10. Deployment
