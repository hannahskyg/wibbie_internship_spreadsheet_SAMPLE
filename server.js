const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const rootDir = __dirname;
const dataFile = path.join(rootDir, 'internship_spreadsheet.csv');
const seedFile = path.join(rootDir, '2025-2026 Rolling Internship Spreadsheet - Summer 2026.csv');
const port = Number(process.env.PORT || 3000);
const adminToken = process.env.ADMIN_TOKEN || '';
const llmApiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
const llmBaseUrl = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const llmModel = process.env.LLM_MODEL || 'gpt-4.1-mini';

const csvHeaders = [
  'company',
  'role',
  'industry',
  'location',
  'date posted',
  'pay',
  'application link',
  'work mode',
  'notes'
];

function escapeCsvValue(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function serializeRows(rows) {
  const lines = [csvHeaders.join(',')];
  for (const row of rows) {
    const values = csvHeaders.map((header) => escapeCsvValue(row[header] || ''));
    lines.push(values.join(','));
  }
  return `${lines.join('\n')}\n`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === ',') {
      row.push(value.trim());
      value = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }
      row.push(value.trim());
      value = '';
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeText(value) {
  return (value || '').toString().trim();
}

function normalizeDate(dateText) {
  if (!dateText) {
    return null;
  }

  const parsed = new Date(dateText);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const parts = dateText.split(/[\/.-]/).map((part) => part.trim());
  if (parts.length === 3) {
    const [first, second, third] = parts.map(Number);
    if ([first, second, third].every((n) => !Number.isNaN(n))) {
      let year;
      let month;
      let day;

      if (parts[0].length === 4 || first >= 1000) {
        year = first;
        month = second;
        day = third;
      } else if (parts[2].length === 4 || third >= 1000) {
        year = third;
        if (first > 12 && second <= 12) {
          day = first;
          month = second;
        } else if (second > 12 && first <= 12) {
          month = first;
          day = second;
        }
      }

      if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const fallback = new Date(year, month - 1, day);
        if (
          fallback.getFullYear() === year &&
          fallback.getMonth() === month - 1 &&
          fallback.getDate() === day
        ) {
          return fallback;
        }
      }
    }
  }

  return null;
}

function convertSeedRows(text) {
  const lines = parseCsv(text);
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].map((header) => header.trim().toLowerCase());

  return lines.slice(1).map((cells) => {
    const rowMap = {};
    headers.forEach((header, index) => {
      rowMap[header] = (cells[index] || '').trim();
    });

    const company = normalizeText(rowMap.company);
    const role = normalizeText(rowMap['job title'] || rowMap['role']);
    const industry = normalizeText(rowMap.industry);
    const location = normalizeText(rowMap.location);
    const datePosted = normalizeText(rowMap['application posted'] || rowMap.when || rowMap['date posted']);
    const pay = normalizeText(rowMap.salary);
    const applicationLink = normalizeText(rowMap['application link'] || rowMap.link || rowMap.url);
    const workMode = normalizeText(rowMap['work mode'] || rowMap.mode);
    const notes = [rowMap.notes, rowMap['work visa required'], rowMap['application deadline']]
      .map(normalizeText)
      .filter(Boolean)
      .join(' | ');

    return {
      company,
      role,
      industry,
      location,
      'date posted': normalizeDate(datePosted) ? datePosted : datePosted,
      pay,
      'application link': applicationLink,
      'work mode': workMode,
      notes
    };
  });
}

async function ensureDataFile() {
  try {
    const currentText = await fs.readFile(dataFile, 'utf8');
    const rows = parseCsv(currentText);
    const currentHeaders = rows[0] ? rows[0].map((header) => header.trim().toLowerCase()) : [];
    const alreadyNormalized = csvHeaders.every((header) => currentHeaders.includes(header));
    if (alreadyNormalized && rows.length > 1) {
      return;
    }
  } catch {
    // Seed below.
  }

  const seedText = await fs.readFile(seedFile, 'utf8');
  const rows = convertSeedRows(seedText);
  await fs.writeFile(dataFile, serializeRows(rows), 'utf8');
}

async function readDataRows() {
  const text = await fs.readFile(dataFile, 'utf8');
  const lines = parseCsv(text);
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((cells) => {
    const rowMap = {};
    headers.forEach((header, index) => {
      rowMap[header] = (cells[index] || '').trim();
    });
    return rowMap;
  });
}

function normalizeParsedRow(entry) {
  const company = normalizeText(entry.company ?? entry.company_name ?? entry.employer);
  const role = normalizeText(entry.role ?? entry.title ?? entry.position);
  const industry = normalizeText(entry.industry ?? entry.field);
  const location = normalizeText(entry.location ?? entry.city);
  const datePosted = normalizeText(entry.date_posted ?? entry.datePosted ?? entry.date);
  const pay = normalizeText(entry.pay ?? entry.salary ?? entry.compensation);
  const applicationLink = normalizeText(entry.application_link ?? entry.applicationLink ?? entry.link ?? entry.url);
  const workMode = normalizeText(entry.work_mode ?? entry.workMode ?? entry.mode);
  const notes = normalizeText(entry.notes ?? entry.note);

  return {
    company,
    role,
    industry,
    location,
    'date posted': datePosted,
    pay,
    'application link': applicationLink,
    'work mode': workMode,
    notes
  };
}

function normalizeLlmContent(content) {
  const trimmed = normalizeText(content);
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fenced ? fenced[1] : trimmed;
  return JSON.parse(jsonText);
}

function buildExtractionPrompt(description) {
  return [
    'You are a strict information extraction engine.',
    '',
    'Read the job description and return exactly one JSON object with these keys:',
    '{',
    '  "company": string | null,',
    '  "role": string | null,',
    '  "industry": string | null,',
    '  "location": string | null,',
    '  "date_posted": string | null,',
    '  "pay": string | null,',
    '  "application_link": string | null,',
    '  "notes": string | null',
    '}',
    '',
    'Rules:',
    '- Output valid JSON only.',
    '- Do not add markdown or commentary.',
    '- Use null for missing or ambiguous fields.',
    '- Do not invent company names, locations, links, or pay.',
    '- Normalize dates to YYYY-MM-DD when possible.',
    '- Keep the role concise and practical.',
    '- Infer industry only when clearly supported.',
    '- Include any important extra requirements in notes.',
    '',
    'Job description:',
    description
  ].join('\n');
}

async function callLlm(description) {
  if (!llmApiKey) {
    throw new Error('LLM_API_KEY or OPENAI_API_KEY is not configured.');
  }

  const response = await fetch(`${llmBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${llmApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: llmModel,
      messages: [
        { role: 'system', content: 'You extract structured internship data from job descriptions.' },
        { role: 'user', content: buildExtractionPrompt(description) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM response did not include content.');
  }

  return normalizeLlmContent(content);
}

async function appendRow(row) {
  const line = csvHeaders.map((header) => escapeCsvValue(row[header] || '')).join(',');
  await fs.appendFile(dataFile, `${line}\n`, 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, contentType, body) {
  res.writeHead(statusCode, {
    'Content-Type': `${contentType}; charset=utf-8`
  });
  res.end(body);
}

async function handleRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && requestUrl.pathname === '/') {
    const html = await fs.readFile(path.join(rootDir, 'index.html'), 'utf8');
    return sendText(res, 200, 'text/html', html);
  }

  if (req.method === 'GET' && requestUrl.pathname === '/admin') {
    const html = await fs.readFile(path.join(rootDir, 'admin.html'), 'utf8');
    return sendText(res, 200, 'text/html', html);
  }

  if (req.method === 'GET' && requestUrl.pathname === '/app.js') {
    const script = await fs.readFile(path.join(rootDir, 'app.js'), 'utf8');
    return sendText(res, 200, 'application/javascript', script);
  }

  if (req.method === 'GET' && requestUrl.pathname === '/admin.js') {
    const script = await fs.readFile(path.join(rootDir, 'admin.js'), 'utf8');
    return sendText(res, 200, 'application/javascript', script);
  }

  if (req.method === 'GET' && requestUrl.pathname === '/styles.css') {
    const css = await fs.readFile(path.join(rootDir, 'styles.css'), 'utf8');
    return sendText(res, 200, 'text/css', css);
  }

  if (req.method === 'GET' && requestUrl.pathname === '/internship_spreadsheet.csv') {
    const csv = await fs.readFile(dataFile, 'utf8');
    return sendText(res, 200, 'text/csv', csv);
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/admin/add-description') {
    if (!adminToken) {
      return sendJson(res, 500, { error: 'ADMIN_TOKEN is not configured.' });
    }

    const providedToken = req.headers['x-admin-token'];
    if (providedToken !== adminToken) {
      return sendJson(res, 403, { error: 'Forbidden.' });
    }

    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(body || '{}');
    } catch {
      return sendJson(res, 400, { error: 'Request body must be valid JSON.' });
    }

    const description = normalizeText(parsedBody.description);
    if (!description) {
      return sendJson(res, 400, { error: 'description is required.' });
    }

    try {
      const extracted = await callLlm(description);
      const row = normalizeParsedRow(extracted);
      await appendRow(row);
      return sendJson(res, 200, { ok: true, row });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  return sendJson(res, 404, { error: 'Not found.' });
}

async function main() {
  await ensureDataFile();
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
    });
  });

  server.listen(port, () => {
    console.log(`Internship spreadsheet server running at http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});