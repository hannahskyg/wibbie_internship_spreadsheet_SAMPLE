const searchInput = document.getElementById('searchInput');
const industryFilter = document.getElementById('industryFilter');
const locationFilter = document.getElementById('locationFilter');
const dateAfterFilter = document.getElementById('dateAfterFilter');
const dateBeforeFilter = document.getElementById('dateBeforeFilter');
const dateSort = document.getElementById('dateSort');
const statusEl = document.getElementById('status');
const tableBody = document.querySelector('#resultsTable tbody');

const dataUrl = 'internship_spreadsheet.csv';

let allRows = [];

function createCell(text) {
  const td = document.createElement('td');
  td.textContent = text || '—';
  return td;
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

function parseToDateValue(dateText) {
  const parsed = normalizeDate(dateText);
  if (!parsed) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rowSearchText(row) {
  return [row.company, row.role, row.industry, row.location, row.pay, row.notes, row.workMode]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getValue(rowMap, availableHeaders, possibleHeaderNames) {
  const target = availableHeaders.find((header) => possibleHeaderNames.includes(header));
  if (!target) {
    return '';
  }
  return rowMap[target] || '';
}

function normalizeRow(rowMap, availableHeaders) {
  const company = normalizeText(getValue(rowMap, availableHeaders, ['company']));
  const role = normalizeText(getValue(rowMap, availableHeaders, ['role']));
  const industry = normalizeText(getValue(rowMap, availableHeaders, ['industry']));
  const location = normalizeText(getValue(rowMap, availableHeaders, ['location']));
  const datePosted = normalizeText(getValue(rowMap, availableHeaders, ['date posted']));
  const pay = normalizeText(getValue(rowMap, availableHeaders, ['pay']));
  const applicationLink = normalizeText(
    getValue(rowMap, availableHeaders, ['application link', 'apply', 'link', 'url'])
  );
  const notes = normalizeText(getValue(rowMap, availableHeaders, ['notes']));
  const workMode = normalizeText(getValue(rowMap, availableHeaders, ['work mode', 'mode']));
  const postedDate = normalizeDate(datePosted);

  return {
    company,
    role,
    industry,
    location,
    datePosted,
    postedValue: parseToDateValue(datePosted),
    postedTime: postedDate ? postedDate.getTime() : null,
    pay,
    applicationLink,
    notes,
    workMode,
    searchText: rowSearchText({ company, role, industry, location, pay, notes, workMode })
  };
}

function refreshSelect(selectElement, values, allLabel) {
  const currentValue = selectElement.value;
  selectElement.innerHTML = `<option value="">${allLabel}</option>`;

  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  }

  if (values.includes(currentValue)) {
    selectElement.value = currentValue;
  }
}

function renderTable() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedIndustry = industryFilter.value;
  const selectedLocation = locationFilter.value;
  const afterValue = dateAfterFilter.value ? new Date(`${dateAfterFilter.value}T00:00:00`) : null;
  const beforeValue = dateBeforeFilter.value ? new Date(`${dateBeforeFilter.value}T23:59:59.999`) : null;
  const sortDirection = dateSort.value;

  const filtered = allRows.filter((row) => {
    const matchesSearch = !searchTerm || row.searchText.includes(searchTerm);
    const matchesIndustry = !selectedIndustry || row.industry === selectedIndustry;
    const matchesLocation = !selectedLocation || row.location === selectedLocation;
    const matchesAfter = !afterValue || (row.postedTime !== null && row.postedTime >= afterValue.getTime());
    const matchesBefore = !beforeValue || (row.postedTime !== null && row.postedTime <= beforeValue.getTime());
    return matchesSearch && matchesIndustry && matchesLocation && matchesAfter && matchesBefore;
  });

  filtered.sort((a, b) => {
    const aTime = a.postedTime;
    const bTime = b.postedTime;
    if (aTime === null && bTime === null) {
      return 0;
    }
    if (aTime === null) {
      return 1;
    }
    if (bTime === null) {
      return -1;
    }
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
    tr.appendChild(createCell(row.pay));

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
    statusEl.textContent = 'internship_spreadsheet.csv has no internship rows yet.';
    refreshSelect(industryFilter, [], 'All industries');
    refreshSelect(locationFilter, [], 'All locations');
    return;
  }

  const headers = lines[0].map((header) => header.trim().toLowerCase());

  allRows = lines.slice(1).map((cells) => {
    const rowMap = {};
    headers.forEach((header, index) => {
      rowMap[header] = (cells[index] || '').trim();
    });
    return normalizeRow(rowMap, headers);
  });

  const industries = [...new Set(allRows.map((row) => row.industry).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  const locations = [...new Set(allRows.map((row) => row.location).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  refreshSelect(industryFilter, industries, 'All industries');
  refreshSelect(locationFilter, locations, 'All locations');
  renderTable();
}

async function loadSpreadsheet() {
  try {
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load ${dataUrl}`);
    }

    const text = await response.text();
    loadCsv(text);
  } catch {
    statusEl.textContent = 'Run the local server to load internship_spreadsheet.csv.';
  }
}

searchInput.addEventListener('input', renderTable);
industryFilter.addEventListener('change', renderTable);
locationFilter.addEventListener('change', renderTable);
dateAfterFilter.addEventListener('change', renderTable);
dateBeforeFilter.addEventListener('change', renderTable);
dateSort.addEventListener('change', renderTable);

loadSpreadsheet();