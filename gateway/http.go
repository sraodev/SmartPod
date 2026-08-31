package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"net/http"
)

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func problem(w http.ResponseWriter, status int) {
	w.Header().Set("Content-Type", "application/problem+json")
	writeJSON(w, status, map[string]any{"type": "about:blank", "title": http.StatusText(status), "status": status})
}

func apiHandler(db *sql.DB, address, token string) http.Handler {
	expected := sha256.Sum256([]byte("Bearer " + token))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		// No browser integration yet. Reject rebinding hosts and all browser origins.
		if r.Host != address || r.Header.Get("Origin") != "" || r.Header.Get("Sec-Fetch-Site") == "cross-site" {
			problem(w, http.StatusForbidden)
			return
		}
		actual := sha256.Sum256([]byte(r.Header.Get("Authorization")))
		if subtle.ConstantTimeCompare(expected[:], actual[:]) != 1 {
			w.Header().Set("WWW-Authenticate", "Bearer")
			problem(w, http.StatusUnauthorized)
			return
		}
		if r.URL.Path != "/api/v1/ports" && r.URL.Path != "/api/v1/ports/"+portID {
			problem(w, http.StatusNotFound)
			return
		}
		if r.Method != http.MethodGet {
			w.Header().Set("Allow", "GET")
			problem(w, http.StatusMethodNotAllowed)
			return
		}
		ports, err := readPorts(r.Context(), db)
		if err != nil {
			problem(w, http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/api/v1/ports" {
			writeJSON(w, http.StatusOK, map[string]any{"ports": ports})
		} else {
			writeJSON(w, http.StatusOK, ports[0])
		}
	})
}
