# wibbie_internship_spreadsheet_SAMPLE

A simple website that shows a read-only internship spreadsheet and keeps the private add-entry flow behind a server endpoint.

## Features
- View `internship_spreadsheet.csv` in a clean table
- Filter by **industry**, **location**, and **date posted**
- Search by company, role, pay, notes, and other visible fields
- Sort by **date posted** (newest or oldest)
- Keep LLM-based job-description parsing behind a protected server route

## Holder CSV
The app uses [internship_spreadsheet.csv](internship_spreadsheet.csv) as the canonical spreadsheet file. The server will seed it from the sample data file on first run if it only contains the header row.

## Private LLM Add Flow
The browser UI is read-only. To add a new row from a job description, send a request to the protected server endpoint:

`POST /api/admin/add-description`

Required headers and environment variables:
- `x-admin-token` must match `ADMIN_TOKEN`
- `LLM_API_KEY` or `OPENAI_API_KEY` for the model request
- `LLM_MODEL` for the model name
- `LLM_BASE_URL` if you are using an OpenAI-compatible provider other than the default

There is also a dedicated admin page at [/admin](/admin) that lets you paste a job description, submit it to the protected endpoint, and view the parsed row before it is written to the CSV.

The server extracts this schema from the job description before appending it to the CSV:

- `company`
- `role`
- `industry`
- `location`
- `date_posted`
- `pay`
- `application_link`
- `notes`

## Run Locally
Start the local server so the browser can load the CSV and the server can keep the file in sync:

```bash
node server.js
```

Then open `http://localhost:3000`.

## Sample Data
The initial CSV is seeded from [2025-2026 Rolling Internship Spreadsheet - Summer 2026.csv](2025-2026%20Rolling%20Internship%20Spreadsheet%20-%20Summer%202026.csv).

