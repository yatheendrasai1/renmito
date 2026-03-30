# Renmito — TimeLogger

A MEAN-stack time logging application (MongoDB replaced with local JSON file storage). Log your daily activities on a Gantt-style 24-hour timeline.

---

## Project Structure

```
renmito/
├── backend/          Node.js + Express REST API
│   ├── src/
│   │   ├── app.js
│   │   └── routes/logs.js
│   ├── data/         Auto-created. One JSON file per day (YYYY-MM-DD.json)
│   └── package.json
├── frontend/         Angular 17 standalone app
│   ├── src/
│   │   ├── main.ts
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── app/
│   │       ├── app.component.ts
│   │       ├── models/log.model.ts
│   │       ├── constants/activity-types.ts
│   │       ├── services/log.service.ts
│   │       └── components/
│   │           ├── calendar/calendar.component.ts
│   │           ├── timeline/timeline.component.ts
│   │           └── log-form/log-form.component.ts
│   ├── angular.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   └── package.json
└── README.md
```

---

## Prerequisites

- **Node.js** v18+ and **npm** v9+
- **Angular CLI** v17+: `npm install -g @angular/cli@17`

---

## Setup & Running

### 1. Backend

```bash
cd backend
npm install
npm run dev      # uses nodemon for auto-reload
# OR
npm start        # plain node
```

The backend starts at **http://localhost:3000**.

Log files are saved to `backend/data/YYYY-MM-DD.json` (the `data/` directory is created automatically).

### 2. Frontend

```bash
cd frontend
npm install
ng serve         # starts dev server at http://localhost:4200
```

Open **http://localhost:4200** in your browser.

---

## REST API

| Method | Endpoint                     | Description                    |
|--------|------------------------------|--------------------------------|
| GET    | `/api/logs/:date`            | Get all logs for a date        |
| POST   | `/api/logs/:date`            | Create a new log entry         |
| PUT    | `/api/logs/:date/:id`        | Update a log entry             |
| DELETE | `/api/logs/:date/:id`        | Delete a log entry             |

Date format: `YYYY-MM-DD` (e.g. `2026-03-28`)

### Log Entry Shape

```json
{
  "id": "uuid-v4",
  "date": "2026-03-28",
  "startTime": "09:00",
  "endTime": "10:30",
  "type": "work",
  "label": "Team standup",
  "color": "#4A90E2"
}
```

### Activity Types

| Type       | Label        | Color     |
|------------|-------------|-----------|
| `work`     | Office Work  | `#4A90E2` |
| `lunch`    | Lunch        | `#F5A623` |
| `sleep`    | Sleep        | `#7B68EE` |
| `wake`     | Wake Up      | `#50E3C2` |
| `transit`  | Transit      | `#BD10E0` |
| `exercise` | Exercise     | `#7ED321` |
| `break`    | Break        | `#F8E71C` |
| `personal` | Personal     | `#D0021B` |
| `other`    | Other        | `#9B9B9B` |

---

## Usage

1. **Select a date** using the calendar on the left sidebar.
2. **Drag** on the 24-hour timeline to select a time range (snaps to 15-minute intervals).
3. A selection info bar appears below the timeline — click **+ Create Log**.
4. Choose an activity type, enter a description, and click **Save Log**.
5. The log appears as a colored bar on the timeline.
6. **Click any bar** to edit or delete that log entry.

---

## Data Storage

Each day's logs are stored as a plain JSON array in:

```
backend/data/YYYY-MM-DD.json
```

Example (`2026-03-28.json`):

```json
[
  {
    "id": "abc123",
    "date": "2026-03-28",
    "startTime": "09:00",
    "endTime": "10:30",
    "type": "work",
    "label": "Team standup",
    "color": "#4A90E2"
  }
]
```
