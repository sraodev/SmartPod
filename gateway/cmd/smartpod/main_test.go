package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const testToken = "test-only-token-not-for-real-use-123456789"
const fixture = `{"id":"sim-port-1","mode":"simulator","state":"active","actual_output":"closed","measurement":{"sequence":0,"voltage_mv":230000,"current_ma":1565,"active_power_w":360,"energy_wh":0,"quality":"estimated","sampled_at":"2026-01-01T00:00:00Z"},"faults":[],"active_session_id":null,"updated_at":"2026-01-01T00:00:00Z"}`

func invoke(t *testing.T, args []string, token string, wantCode int) (string, string) {
	t.Helper()
	var out, diagnostics bytes.Buffer
	if code := run(args, token, &out, &diagnostics); code != wantCode {
		t.Fatalf("exit %d, want %d; stderr: %s", code, wantCode, diagnostics.String())
	}
	if token != "" && (strings.Contains(out.String(), token) || strings.Contains(diagnostics.String(), token)) {
		t.Fatal("credential leaked")
	}
	if wantCode != 0 && (out.Len() != 0 || diagnostics.Len() == 0) {
		t.Fatal("errors must use stderr only")
	}
	if wantCode == 0 && diagnostics.Len() != 0 {
		t.Fatalf("successful command emitted diagnostics: %s", diagnostics.String())
	}
	return out.String(), diagnostics.String()
}

func TestCommands(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.Method != "GET" || r.Header.Get("Authorization") != "Bearer "+testToken || r.Header.Get("Accept") != "application/json" || r.URL.RawQuery != "" {
			t.Error("unexpected request method, headers, or query")
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		switch r.URL.Path {
		case "/api/v1/ports":
			io.WriteString(w, `{"ports":[`+fixture+`]}`)
		case "/api/v1/ports/sim-port-1":
			io.WriteString(w, fixture)
		default:
			t.Error("unexpected path")
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	for _, command := range [][]string{{"status"}, {"ports"}, {"ports", "sim-port-1"}} {
		t.Run(strings.Join(command, "-"), func(t *testing.T) {
			args := append([]string{"--endpoint", server.URL + "/api/", "--json"}, command...)
			out, _ := invoke(t, args, testToken, 0)
			var result map[string]json.RawMessage
			if err := json.Unmarshal([]byte(out), &result); err != nil {
				t.Fatal(err)
			}
			if string(result["schema_version"]) != "1" {
				t.Fatal("missing output schema version")
			}
			switch {
			case command[0] == "status":
				if len(result) != 4 || string(result["command"]) != `"status"` || string(result["reachable"]) != "true" || string(result["port_count"]) != "1" {
					t.Fatal("unstable status output")
				}
			case len(command) == 2:
				if len(result) != 3 || string(result["command"]) != `"port"` || !bytes.Equal(result["port"], []byte(fixture)) {
					t.Fatal("unstable detail output")
				}
			default:
				if len(result) != 3 || string(result["command"]) != `"ports"` || string(result["ports"]) != "["+fixture+"]" {
					t.Fatal("unstable list output")
				}
			}
			args = append([]string{"--endpoint", server.URL + "/api"}, command...)
			out, _ = invoke(t, args, testToken, 0)
			if !strings.Contains(out, "not physical feedback or billable energy") || !strings.Contains(out, "not wall-clock freshness") {
				t.Fatal("missing simulator disclosure")
			}
		})
	}
	if requests.Load() != 6 {
		t.Fatal("each command must make exactly one GET")
	}
}

func TestHelpVersionAndInput(t *testing.T) {
	for _, args := range [][]string{nil, {"help"}, {"--help"}, {"-h"}, {"version"}, {"--version"}, {"--json", "version"}, {"--json", "--version"}} {
		out, _ := invoke(t, args, "", 0)
		if len(out) == 0 {
			t.Fatal("missing offline help/version")
		}
		if len(args) > 0 && args[0] == "--json" && out != "{\"command\":\"version\",\"schema_version\":1,\"version\":\"dev\"}\n" {
			t.Fatal("unstable version JSON")
		}
	}
	for _, args := range [][]string{
		{"start"}, {"stop"}, {"--unknown=" + testToken}, {"--timeout", testToken, "status"},
		{"status", "extra"}, {"help", "extra"}, {"ports", "one", "two"}, {"ports", "--json"},
		{"--help", "ports"}, {"--help", "--version"}, {"--json", "help"}, {"--version", "extra"},
		{"--timeout", "0", "status"}, {"--timeout", "31s", "status"}, {"--timeout", "1us", "status"},
		{"ports", "../status"}, {"ports", ""}, {"ports", "id?token=" + testToken}, {"ports", strings.Repeat("a", 129)},
	} {
		invoke(t, args, testToken, 2)
	}
	for _, endpoint := range []string{"http://localhost:8080/api", "http://192.168.1.1:8080/api", "https://127.0.0.1:8080/api", "http://127.0.0.1/api", "http://127.0.0.1:0/api", "http://127.0.0.1:65536/api", "http://" + testToken + "@127.0.0.1:8080/api", "http://127.0.0.1:8080/api?token=" + testToken, "http://127.0.0.1:8080/api?", "http://127.0.0.1:8080/api#" + testToken, "http://127.0.0.1:8080/%61pi", "http://127.0.0.1:8080/other", "%" + testToken} {
		invoke(t, []string{"--endpoint", endpoint, "status"}, testToken, 2)
	}
	for _, token := range []string{"", "short", strings.Repeat("a", 257), testToken + "\n", testToken + " ", testToken + "é"} {
		invoke(t, []string{"status"}, token, 2)
	}
}

func TestGatewayFailures(t *testing.T) {
	for _, status := range []int{301, 401, 403, 404, 405, 500, 503} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(status)
				io.WriteString(w, "Bearer "+testToken)
			}))
			defer server.Close()
			invoke(t, []string{"--endpoint", server.URL + "/api", "--json", "status"}, testToken, 3)
		})
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-r.Context().Done():
		case <-time.After(time.Second):
		}
	}))
	invoke(t, []string{"--endpoint", server.URL + "/api", "--timeout", "20ms", "status"}, testToken, 3)
	server.Close()
	invoke(t, []string{"--endpoint", server.URL + "/api", "status"}, testToken, 3)
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"ports":[`)
		w.(http.Flusher).Flush()
		select {
		case <-r.Context().Done():
		case <-time.After(time.Second):
		}
	}))
	defer server.Close()
	invoke(t, []string{"--endpoint", server.URL + "/api", "--timeout", "20ms", "ports"}, testToken, 3)
}

func TestNoRedirectOrProxy(t *testing.T) {
	var forwarded atomic.Int32
	sink := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { forwarded.Add(1) }))
	defer sink.Close()
	t.Setenv("HTTP_PROXY", sink.URL)
	t.Setenv("ALL_PROXY", sink.URL)
	t.Setenv("NO_PROXY", "")
	var sourceRequests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sourceRequests.Add(1)
		http.Redirect(w, r, sink.URL+"/api/v1/ports", http.StatusTemporaryRedirect)
	}))
	defer server.Close()
	invoke(t, []string{"--endpoint", server.URL + "/api", "status"}, testToken, 3)
	if sourceRequests.Load() != 1 || forwarded.Load() != 0 {
		t.Fatal("request used a proxy or followed a redirect")
	}
}

func TestMalformedResponses(t *testing.T) {
	for name, body := range map[string]string{
		"invalid JSON": `{"ports":`, "null": `null`, "missing list": `{}`, "null list": `{"ports":null}`,
		"missing port fields": `{"ports":[{}]}`, "null port": `{"ports":[null]}`,
		"trailing JSON": `{"ports":[]} {}`, "trailing junk": `{"ports":[]} secret`,
		"unknown field":     `{"ports":[],"token":"` + testToken + `"}`,
		"duplicate port ID": `{"ports":[` + fixture + `,` + fixture + `]}`,
		"oversize":          strings.Repeat(" ", (1<<20)+1),
	} {
		t.Run(name, func(t *testing.T) { checkBody(t, body, "application/json", []string{"status"}, 4) })
	}
	for name, replacement := range map[string][2]string{
		"missing numeric": {`"energy_wh":0,`, ""}, "null numeric": {`"energy_wh":0`, `"energy_wh":null`},
		"negative energy": {`"energy_wh":0`, `"energy_wh":-1`}, "fractional numeric": {`"energy_wh":0`, `"energy_wh":0.1`},
		"overflow": {`"energy_wh":0`, `"energy_wh":9223372036854775808`}, "null power": {`"active_power_w":360`, `"active_power_w":null`},
		"unknown state": {`"active"`, `"unknown"`}, "unknown quality": {`"estimated"`, `"billable"`},
		"bad timestamp": {`2026-01-01T00:00:00Z`, "not-a-date"}, "null faults": {`"faults":[]`, `"faults":null`},
		"fault missing fields": {`"faults":[]`, `"faults":[{}]`},
		"echoed secret":        {`"sim-port-1"`, `"` + testToken + `"`},
		"escaped secret":       {`"sim-port-1"`, `"\u0074` + testToken[1:] + `"`},
		"session secret":       {`"active_session_id":null`, `"active_session_id":"` + testToken + `"`},
	} {
		t.Run(name, func(t *testing.T) {
			body := `{"ports":[` + strings.ReplaceAll(fixture, replacement[0], replacement[1]) + `]}`
			checkBody(t, body, "application/json", []string{"ports"}, 4)
		})
	}
	checkBody(t, fixture, "application/json", []string{"ports", "different-port"}, 4)
	checkBody(t, `{"ports":[]}`, "text/html", []string{"status"}, 4)
	checkBody(t, `{"ports":[]}`, "application/json", []string{"ports"}, 0)
	withFault := strings.Replace(fixture, `"faults":[]`, `"faults":[{"code":"over_current","severity":"stop","latched":false,"occurred_at":"2026-01-01T00:00:00Z"}]`, 1)
	checkBody(t, withFault, "application/json", []string{"ports", "sim-port-1"}, 0)
	// Signed power is valid in the contract; zero/missing are not interchangeable.
	checkBody(t, strings.Replace(fixture, `"active_power_w":360`, `"active_power_w":-1`, 1), "application/json", []string{"ports", "sim-port-1"}, 0)
}

func checkBody(t *testing.T, body, contentType string, command []string, code int) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", contentType)
		io.WriteString(w, body)
	}))
	defer server.Close()
	args := append([]string{"--endpoint", server.URL + "/api", "--json"}, command...)
	invoke(t, args, testToken, code)
}

type brokenWriter struct{}

func (brokenWriter) Write([]byte) (int, error) { return 0, errors.New("unwritable") }

func TestOutputFailure(t *testing.T) {
	for _, args := range [][]string{{"help"}, {"version"}, {"--json", "version"}} {
		var stderr bytes.Buffer
		if run(args, "", brokenWriter{}, &stderr) != 1 || stderr.Len() == 0 {
			t.Fatal("output failure must be reported")
		}
	}
}

func TestIPv6Loopback(t *testing.T) {
	for _, endpoint := range []string{"http://127.0.0.1:8080/api", "http://[::1]:8080/api"} {
		u, err := url.Parse(endpoint)
		if err != nil || !validEndpoint(u) {
			t.Fatal("numeric loopback endpoint rejected")
		}
	}
}
