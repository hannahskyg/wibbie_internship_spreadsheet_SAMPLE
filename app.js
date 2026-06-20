const csvFileInput = document.getElementById('csvFile');
const searchInput = document.getElementById('searchInput');
const industryFilter = document.getElementById('industryFilter');
const dateSort = document.getElementById('dateSort');
const statusEl = document.getElementById('status');
const tableBody = document.querySelector('#resultsTable tbody');

let allRows = [];

function createCell(text) {
  const td = document.createElement('td');
  td.textContent = text || '—';
  return td;
}

function sanitizeApplicationUrl(value) {
  if (!value) {
    return '';
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
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

function getValue(row, availableHeaders, names) {
  const target = availableHeaders.find((header) => names.includes(header));
  if (!target) {
    return '';
  }
  return row[target] || '';
}

function normalizeDate(dateText) {
  if (!dateText) {
    return null;
  }
  const parsed = new Date(dateText);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const parts = dateText.split(/[\/\-.]/).map((part) => part.trim());
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
        } else {
          day = first;
          month = second;
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

function renderTable() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedIndustry = industryFilter.value;
  const sortDirection = dateSort.value;

  const filtered = allRows.filter((entry) => {
    const matchesIndustry = !selectedIndustry || entry.industry === selectedIndustry;
    const haystack = [entry.company, entry.role, entry.industry, entry.location].join(' ').toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);
    return matchesIndustry && matchesSearch;
  });

  filtered.sort((a, b) => {
    const aTime = a.postedDate ? a.postedDate.getTime() : -Infinity;
    const bTime = b.postedDate ? b.postedDate.getTime() : -Infinity;
    return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
  });

  tableBody.innerHTML = '';

  for (const row of filtered) {
    const tr = document.createElement('tr');
    tr.appendChild(createCell(row.company));
    tr.appendChild(createCell(row.role));
    tr.appendChild(createCell(row.industry));
    tr.appendChild(createCell(row.location));
    tr.appendChild(createCell(row.datePosted));

    const applyCell = document.createElement('td');
    if (row.applicationLink) {
      const link = document.createElement('a');
      link.href = row.applicationLink;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Apply';
      applyCell.appendChild(link);
    } else {
      applyCell.textContent = '—';
    }
    tr.appendChild(applyCell);

    tableBody.appendChild(tr);
  }

  statusEl.textContent = `${filtered.length} internship${filtered.length === 1 ? '' : 's'} shown.`;
}

function loadCsv(text) {
  const lines = parseCsv(text);
  if (lines.length < 2) {
    allRows = [];
    tableBody.innerHTML = '';
    statusEl.textContent = 'CSV has no internship rows.';
    industryFilter.innerHTML = '<option value="">All industries</option>';
    return;
  }

  const headers = lines[0].map((header) => header.trim().toLowerCase());

  allRows = lines.slice(1).map((cells) => {
    const rowMap = {};
    headers.forEach((header, index) => {
      rowMap[header] = (cells[index] || '').trim();
    });

    const datePosted = getValue(rowMap, headers, ['date posted', 'posted date', 'date']);

    return {
      company: getValue(rowMap, headers, ['company', 'company name']),
      role: getValue(rowMap, headers, ['role', 'position', 'title']),
      industry: getValue(rowMap, headers, ['industry', 'field']),
      location: getValue(rowMap, headers, ['location', 'city']),
      datePosted,
      postedDate: normalizeDate(datePosted),
      applicationLink: sanitizeApplicationUrl(getValue(rowMap, headers, ['application link', 'link', 'url', 'apply link']))
    };
  });

  const industries = [...new Set(allRows.map((row) => row.industry).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  industryFilter.innerHTML = '<option value="">All industries</option>';
  for (const industry of industries) {
    const option = document.createElement('option');
    option.value = industry;
    option.textContent = industry;
    industryFilter.appendChild(option);
  }

  renderTable();
}

csvFileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const text = await file.text();
  loadCsv(text);
});

searchInput.addEventListener('input', renderTable);
industryFilter.addEventListener('change', renderTable);
dateSort.addEventListener('change', renderTable);
