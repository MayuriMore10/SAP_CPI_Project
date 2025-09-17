import os
import time
from typing import Dict, Optional

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS


def create_app() -> Flask:
	app = Flask(__name__, static_folder="static", template_folder="static")
	CORS(app)

	# Load variables from .env if present
	load_dotenv()

	# Configuration via environment variables
	app.config["CPI_TOKEN_URL"] = os.getenv("CPI_TOKEN_URL", "")
	app.config["CPI_CLIENT_ID"] = os.getenv("CPI_CLIENT_ID", "")
	app.config["CPI_CLIENT_SECRET"] = os.getenv("CPI_CLIENT_SECRET", "")
	app.config["CPI_BASE_API_URL"] = os.getenv("CPI_BASE_API_URL", "")  # e.g. https://<tmn-host>/api/v1

	# Endpoint paths (relative to CPI_BASE_API_URL). Adjust to your tenant APIs if needed.
	app.config["CPI_MESSAGE_STORE_PATH"] = os.getenv("CPI_MESSAGE_STORE_PATH", "/MessageStore")
	app.config["CPI_QUEUES_PATH"] = os.getenv("CPI_QUEUES_PATH", "/Queues")
	app.config["CPI_VARIABLES_PATH"] = os.getenv("CPI_VARIABLES_PATH", "/Variables")

	# In-memory token cache
	token_cache: Dict[str, Optional[str]] = {
		"access_token": None,
		"expires_at": None,
	}

	def _get_access_token() -> str:
		# Return cached token if valid
		now = int(time.time())
		expires_at = token_cache.get("expires_at") or 0
		if token_cache.get("access_token") and now < expires_at - 30:
			return token_cache["access_token"] or ""

		token_url = app.config["CPI_TOKEN_URL"].strip()
		client_id = app.config["CPI_CLIENT_ID"].strip()
		client_secret = app.config["CPI_CLIENT_SECRET"].strip()
		if not token_url or not client_id or not client_secret:
			raise RuntimeError("CPI OAuth credentials are not configured. Set CPI_TOKEN_URL, CPI_CLIENT_ID, CPI_CLIENT_SECRET.")

		response = requests.post(
			token_url,
			data={"grant_type": "client_credentials"},
			auth=(client_id, client_secret),
			headers={"Accept": "application/json"},
			timeout=30,
		)
		if response.status_code != 200:
			raise RuntimeError(f"Failed to get token: {response.status_code} {response.text}")
		payload = response.json()
		token_cache["access_token"] = payload.get("access_token")
		# expires_in is in seconds
		expires_in = int(payload.get("expires_in", 3600))
		token_cache["expires_at"] = int(time.time()) + expires_in
		return token_cache["access_token"] or ""

	def _proxy_get(path: str):
		base_url = app.config["CPI_BASE_API_URL"].rstrip("/")
		if not base_url:
			raise RuntimeError("CPI_BASE_API_URL is not configured.")
		url = f"{base_url}{path}"
		access_token = _get_access_token()
		headers = {
			"Authorization": f"Bearer {access_token}",
			"Accept": "application/json",
		}
		resp = requests.get(url, headers=headers, timeout=60)
		# Pass through JSON if possible, else text
		try:
			data = resp.json()
		except Exception:
			data = {"status": resp.status_code, "content": resp.text}
		return jsonify({"status": resp.status_code, "data": data})

	@app.route("/")
	def index():
		return send_from_directory(app.static_folder, "index.html")

	@app.route("/api/message-store", methods=["GET"])
	def message_store():
		try:
			path = app.config["CPI_MESSAGE_STORE_PATH"]
			return _proxy_get(path)
		except Exception as exc:  # noqa: BLE001
			return jsonify({"error": str(exc)}), 500

	@app.route("/api/queues", methods=["GET"])
	def queues():
		try:
			path = app.config["CPI_QUEUES_PATH"]
			return _proxy_get(path)
		except Exception as exc:  # noqa: BLE001
			return jsonify({"error": str(exc)}), 500

	@app.route("/api/variables", methods=["GET"])
	def variables():
		try:
			path = app.config["CPI_VARIABLES_PATH"]
			return _proxy_get(path)
		except Exception as exc:  # noqa: BLE001
			return jsonify({"error": str(exc)}), 500

	return app


if __name__ == "__main__":
	port = int(os.getenv("PORT", "5000"))
	create_app().run(host="0.0.0.0", port=port, debug=True)


