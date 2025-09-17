function setOutput(obj) {
	const el = document.getElementById('output');
	try {
		el.textContent = JSON.stringify(obj, null, 2);
	} catch (e) {
		el.textContent = String(obj);
	}
}

function setLoading(msg) {
	document.getElementById('output').textContent = msg || 'Loading...';
}

async function callApi(path) {
	setLoading('Loading...');
	try {
		const response = await fetch(path);
		const data = await response.json();
		setOutput(data);
	} catch (err) {
		setOutput({ error: String(err) });
	}
}

document.getElementById('btnMessageStore').addEventListener('click', () => {
	callApi('/api/message-store');
});
document.getElementById('btnQueues').addEventListener('click', () => {
	callApi('/api/queues');
});
document.getElementById('btnVariables').addEventListener('click', () => {
	callApi('/api/variables');
});
document.getElementById('btnClear').addEventListener('click', () => {
	setOutput('');
});


