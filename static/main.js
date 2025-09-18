function setOutput(text) {
	const el = document.getElementById('output');
	el.textContent = String(text == null ? '' : text);
}

function setLoading(msg) {
	document.getElementById('output').textContent = msg || 'Loading...';
}

async function callApi(path) {
	setLoading('Loading...');
	try {
		const response = await fetch(path);
		const data = await response.json();
		setOutput(formatReadable(trimData(data)));
	} catch (err) {
		setOutput(`Error: ${String(err)}`);
	}
}

// Login handlers
document.getElementById('btnLogin').addEventListener('click', async () => {
	const tokenUrl = document.getElementById('tokenUrl').value.trim();
	const clientId = document.getElementById('clientId').value.trim();
	const clientSecret = document.getElementById('clientSecret').value.trim();
	const status = document.getElementById('loginStatus');
	status.textContent = 'Logging in...';
	try {
		const res = await fetch('/api/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tokenUrl, clientId, clientSecret })
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || 'Login failed');
		status.textContent = 'Login successful';
		document.getElementById('actionsCard').style.display = '';
	} catch (e) {
		status.textContent = String(e.message || e);
	}
});

document.getElementById('btnLogout').addEventListener('click', async () => {
	await fetch('/api/logout', { method: 'POST' });
	document.getElementById('actionsCard').style.display = 'none';
	document.getElementById('loginStatus').textContent = 'Logged out';
});

// Resource handlers
document.getElementById('btnDataStores').addEventListener('click', () => {
	callApi('/api/datastores');
});
document.getElementById('btnVariables').addEventListener('click', () => {
	callApi('/api/variables/all');
});
document.getElementById('btnQueuesJms').addEventListener('click', () => {
	callApi("/api/queues/jms");
});
document.getElementById('btnClear').addEventListener('click', () => {
	setOutput('');
});

function trimData(resp) {
	// Show only important fields when possible
	if (!resp || !resp.data) return resp;
	const data = resp.data;
	// OData V2 style list
	if (data.d && Array.isArray(data.d.results)) {
		return {
			status: resp.status,
			count: data.d.results.length,
			items: data.d.results.slice(0, 50).map(pickImportantFields)
		};
	}
	// Single entity
	if (data.d) {
		return { status: resp.status, item: pickImportantFields(data.d) };
	}
	return resp; // fallback
}

function pickImportantFields(obj) {
	if (obj == null || typeof obj !== 'object') return obj;
	const keys = ['Name','DataStoreName','IntegrationFlow','VariableName','QueueName','State','Status','CreatedAt','LastModifiedAt','LastUpdatedAt','ID'];
	const out = {};
	for (const k of keys) if (k in obj) out[k] = obj[k];
	return Object.keys(out).length ? out : obj;
}

function formatReadable(obj) {
	if (!obj) return '';
	if (obj.error) return `Error: ${obj.error}`;
	// List response
	if (typeof obj.count === 'number' && Array.isArray(obj.items)) {
		const lines = [];
		lines.push(`Status: ${obj.status ?? ''}`.trim());
		lines.push(`Count: ${obj.count}`);
		for (let i = 0; i < obj.items.length; i++) {
			lines.push(`${i + 1}. ${formatKeyValues(obj.items[i])}`);
		}
		return lines.join('\n');
	}
	// Single entity
	if (obj.item && typeof obj.item === 'object') {
		const lines = [];
		lines.push(`Status: ${obj.status ?? ''}`.trim());
		lines.push(formatKeyValues(obj.item));
		return lines.join('\n');
	}
	// Generic fallback: flatten a bit
	if (obj.status && obj.data && typeof obj.data === 'object') {
		if (obj.data.message) return `Status: ${obj.status}\n${obj.data.message}`;
		return `Status: ${obj.status}`;
	}
	return String(obj);
}

function formatKeyValues(rec) {
	if (rec == null) return '';
	if (typeof rec !== 'object') return String(rec);
	const parts = [];
	for (const [k, v] of Object.entries(rec)) {
		parts.push(`${k}: ${formatScalar(v)}`);
	}
	return parts.join(' | ');
}

function formatScalar(v) {
	if (v == null) return '';
	if (typeof v === 'object') return '[object]';
	return String(v);
}


