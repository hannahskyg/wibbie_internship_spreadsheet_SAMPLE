# wibbie_internship_spreadsheet_SAMPLE

A simple website that makes internship spreadsheet CSVs easier to browse and act on quickly.

## Features
- Upload an internship CSV file from your computer
- Filter internships by **industry**
- Search by company/role/location text
- Sort by **date posted** (newest or oldest)
- Click an **Apply** link to open the application page

## Expected CSV Columns
The app can read common column names, including:
- Company (`company`, `company name`)
- Role (`role`, `position`, `title`)
- Industry (`industry`, `field`)
- Location (`location`, `city`)
- Date posted (`date posted`, `posted date`, `date`)
- Application link (`application link`, `link`, `url`, `apply link`)

## Run Locally
Because this is a static site, open `index.html` directly in your browser, or serve the folder with a simple HTTP server:

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`.
