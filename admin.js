const adminTokenInput = document.getElementById('adminToken');
const jobDescriptionInput = document.getElementById('jobDescription');
const submitButton = document.getElementById('submitButton');
const resultOutput = document.getElementById('resultOutput');
const statusEl = document.getElementById('status');

const url = new URL(window.location.href);
const tokenFromQuery = url.searchParams.get('token');

if (tokenFromQuery) {
  adminTokenInput.value = tokenFromQuery;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function formatResult(row) {
  return JSON.stringify(row, null, 2);
}

submitButton.addEventListener('click', async () => {
  const token = adminTokenInput.value.trim();
  const description = jobDescriptionInput.value.trim();

  if (!token) {
    setStatus('Enter the admin token first.');
    return;
  }

  if (!description) {
    setStatus('Paste a job description first.');
    return;
  }

  submitButton.disabled = true;
  setStatus('Sending description to the parser...');

  try {
    const response = await fetch('/api/admin/add-description', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify({ description })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed.');
    }

    resultOutput.value = formatResult(payload.row);
    setStatus('Entry added to internship_spreadsheet.csv.');
    jobDescriptionInput.value = '';
  } catch (error) {
    setStatus(error.message);
  } finally {
    submitButton.disabled = false;
  }
});