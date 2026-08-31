package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const testToken = "test-only-token-with-at-least-32-characters"

func TestReadOnlyHTTP(t *testing.T) {
	db, _ := testStore(t)
	address := "127.0.0.1:8080"
	handler := apiHandler(db, address, testToken)
	for _, tc := range []struct {
		name, method, path, token, host, origin string
		status                                  int
	}{
		{"list", "GET", "/api/v1/ports", testToken, address, "", 200},
		{"detail", "GET", "/api/v1/ports/sim-port-1", testToken, address, "", 200},
		{"unknown port", "GET", "/api/v1/ports/missing", testToken, address, "", 404},
		{"no token", "GET", "/api/v1/ports", "", address, "", 401},
		{"bad token", "GET", "/api/v1/ports", "wrong", address, "", 401},
		{"post forbidden", "POST", "/api/v1/ports", testToken, address, "", 405},
		{"delete forbidden", "DELETE", "/api/v1/ports/sim-port-1", testToken, address, "", 405},
		{"no sessions", "POST", "/api/v1/sessions", testToken, address, "", 404},
		{"no health shortcut", "GET", "/health", testToken, address, "", 404},
		{"rebound host", "GET", "/api/v1/ports", testToken, "attacker.example", "", 403},
		{"browser origin", "GET", "/api/v1/ports", testToken, address, "https://attacker.example", 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(tc.method, "http://"+address+tc.path, nil)
			r.Host = tc.host
			r.Header.Set("Authorization", "Bearer "+tc.token)
			r.Header.Set("Origin", tc.origin)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Code != tc.status {
				t.Fatalf("status %d: %s", w.Code, w.Body.String())
			}
			if !json.Valid(w.Body.Bytes()) || w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("Access-Control-Allow-Origin") != "" {
				t.Fatal("invalid JSON/cache/CORS policy")
			}
			if strings.Contains(w.Body.String(), testToken) {
				t.Fatal("secret in response")
			}
			if tc.status != 200 {
				if w.Header().Get("Content-Type") != "application/problem+json" {
					t.Fatal("missing problem media type")
				}
				var body struct {
					Status int `json:"status"`
				}
				json.Unmarshal(w.Body.Bytes(), &body)
				if body.Status != w.Code {
					t.Fatal("problem status mismatch")
				}
			}
		})
	}
	db.Close()
	r := httptest.NewRequest("GET", "http://"+address+"/api/v1/ports", nil)
	r.Header.Set("Authorization", "Bearer "+testToken)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 503 || strings.Contains(w.Body.String(), "database") {
		t.Fatalf("storage error leaked or hidden: %s", w.Body.String())
	}
}

func TestListenerBoundary(t *testing.T) {
	for _, address := range []string{"127.0.0.1:8080", "127.0.0.1:0", "[::1]:8080"} {
		if err := validateListen(address); err != nil {
			t.Fatalf("%s: %v", address, err)
		}
	}
	for _, address := range []string{"0.0.0.0:8080", ":8080", "[::]:8080", "192.168.1.1:8080", "localhost:8080", "example.com:8080", "127.0.0.1:-1", "127.0.0.1:65536", "127.0.0.1:http", "[::1%en0]:8080"} {
		if err := validateListen(address); err == nil {
			t.Fatalf("accepted %s", address)
		}
	}
}

func TestInvalidConfigurationHasNoStorageSideEffects(t *testing.T) {
	for _, tc := range []struct {
		args  []string
		token string
	}{
		{[]string{"-listen", "0.0.0.0:8080"}, testToken},
		{nil, ""}, {nil, "short"}, {nil, testToken + "\n"},
	} {
		filename := filepath.Join(t.TempDir(), "not-created.db")
		args := append([]string{"-db", filename}, tc.args...)
		if err := run(context.Background(), args, tc.token, io.Discard); err == nil {
			t.Fatal("accepted invalid config")
		}
		if _, err := os.Stat(filename); !os.IsNotExist(err) {
			t.Fatal("storage touched before validation")
		}
	}
	var help bytes.Buffer
	if err := run(context.Background(), []string{"-help"}, "", &help); err != nil || !strings.Contains(help.String(), "loopback") {
		t.Fatal("help requires credentials")
	}
}

func TestRuntimeWriteFailureStopsService(t *testing.T) {
	db, filename := testStore(t)
	if _, err := db.Exec(`CREATE TRIGGER fail_write BEFORE INSERT ON readings
 BEGIN SELECT RAISE(FAIL, 'private-storage-detail'); END;`); err != nil {
		t.Fatal(err)
	}
	db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var logs bytes.Buffer
	err := run(ctx, []string{"-listen", "127.0.0.1:0", "-db", filename}, testToken, &logs)
	if err == nil || !strings.Contains(err.Error(), "storage write failed") {
		t.Fatalf("service hid write failure: %v", err)
	}
	if strings.Contains(logs.String(), testToken) || strings.Contains(logs.String(), "private-storage-detail") {
		t.Fatal("sensitive storage detail logged")
	}
}
