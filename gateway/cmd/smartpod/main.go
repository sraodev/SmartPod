// SmartPod's local read-only CLI. This command never controls outputs or payments.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

var version = "dev"

const usage = `Usage: smartpod [options] <command>

Commands:
  help             Show this help (no gateway required)
  version          Show the CLI version (no gateway required)
  status           Check the authenticated gateway read path
  ports [PORT_ID]  List ports, or show one port in detail

Options (before the command):
  --endpoint URL   API base URL (default http://127.0.0.1:8080/api)
  --timeout D      Request timeout, 1ms to 30s (default 5s)
  --json           Schema-versioned JSON for status, ports, or version
  --help, -h       Show help
  --version        Show the CLI version

Set SMARTPOD_GATEWAY_TOKEN in the environment for status/ports.
Only numeric loopback HTTP endpoints are allowed. No redirects or proxies.
Read-only preview: no output control or payments. Simulator readings and output
states are synthetic, not physical feedback or billable energy; replay timestamps
do not indicate wall-clock freshness.
`

// Pointers distinguish required zero/false values from missing or null fields.
type measurement struct {
	Sequence  *int64 `json:"sequence"`
	VoltageMV *int64 `json:"voltage_mv"`
	CurrentMA *int64 `json:"current_ma"`
	PowerW    *int64 `json:"active_power_w"`
	EnergyWh  *int64 `json:"energy_wh"`
	Quality   string `json:"quality"`
	SampledAt string `json:"sampled_at"`
}

type fault struct {
	Code       string `json:"code"`
	Severity   string `json:"severity"`
	Latched    *bool  `json:"latched"`
	OccurredAt string `json:"occurred_at"`
}

type port struct {
	ID              string      `json:"id"`
	Mode            string      `json:"mode"`
	State           string      `json:"state"`
	ActualOutput    string      `json:"actual_output"`
	Measurement     measurement `json:"measurement"`
	Faults          []fault     `json:"faults"`
	ActiveSessionID *string     `json:"active_session_id"`
	UpdatedAt       string      `json:"updated_at"`
}

func main() {
	os.Exit(run(os.Args[1:], os.Getenv("SMARTPOD_GATEWAY_TOKEN"), os.Stdout, os.Stderr))
}

func run(args []string, token string, stdout, stderr io.Writer) int {
	fail := func(code int, message string) int {
		fmt.Fprintln(stderr, "smartpod: "+message)
		return code
	}
	flags := flag.NewFlagSet("smartpod", flag.ContinueOnError)
	// flag errors include raw arguments, which might contain credentials.
	flags.SetOutput(io.Discard)
	endpoint := flags.String("endpoint", "http://127.0.0.1:8080/api", "")
	timeout := flags.Duration("timeout", 5*time.Second, "")
	asJSON := flags.Bool("json", false, "")
	help := flags.Bool("help", false, "")
	flags.BoolVar(help, "h", false, "")
	showVersion := flags.Bool("version", false, "")
	if err := flags.Parse(args); err != nil {
		return fail(2, "invalid options; run smartpod help (options precede the command)")
	}
	positional := flags.Args()
	command := "help"
	if len(positional) > 0 {
		command = positional[0]
	}
	if *help || *showVersion {
		if len(positional) != 0 || (*help && *showVersion) {
			return fail(2, "help/version options cannot be combined with commands")
		}
		if *showVersion {
			command = "version"
		}
	}
	if len(positional) > 1 && (command != "ports" || len(positional) != 2) {
		return fail(2, "unexpected command arguments; run smartpod help")
	}
	switch command {
	case "help":
		if *asJSON {
			return fail(2, "JSON output is available for status, ports, and version")
		}
		if _, err := io.WriteString(stdout, usage); err != nil {
			return fail(1, "cannot write output")
		}
		return 0
	case "version":
		if *asJSON {
			return writeResult(stdout, stderr, map[string]any{"schema_version": 1, "command": "version", "version": version})
		}
		if _, err := fmt.Fprintln(stdout, "smartpod "+version); err != nil {
			return fail(1, "cannot write output")
		}
		return 0
	case "status", "ports":
	default:
		return fail(2, "unknown command; run smartpod help")
	}
	u, err := url.Parse(*endpoint)
	if err != nil || !validEndpoint(u) {
		return fail(2, "endpoint must be http://<numeric-loopback>:<port>/api, without credentials, query, or fragment")
	}
	if *timeout < time.Millisecond || *timeout > 30*time.Second {
		return fail(2, "timeout must be between 1ms and 30s")
	}
	if len(token) < 32 || len(token) > 256 || strings.IndexFunc(token, func(r rune) bool { return r < 33 || r > 126 }) >= 0 {
		return fail(2, "SMARTPOD_GATEWAY_TOKEN must contain 32-256 printable non-space ASCII characters")
	}
	id := ""
	if len(positional) == 2 {
		id = positional[1]
		if !validID(id) {
			return fail(2, "port ID must be 1-128 ASCII letters, digits, hyphens, or underscores and cannot start with a hyphen")
		}
	}
	u.Path = "/api/v1/ports"
	if id != "" {
		u.Path += "/" + id
	}
	req, err := http.NewRequest(http.MethodGet, u.String(), nil)
	if err != nil {
		return fail(2, "invalid endpoint")
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	// Never forward the bearer token through an environment proxy or redirect.
	transport := &http.Transport{DisableKeepAlives: true}
	defer transport.CloseIdleConnections()
	client := &http.Client{Timeout: *timeout, Transport: transport, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, err := client.Do(req)
	if err != nil {
		return fail(3, "gateway unavailable or request timed out")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		// Do not print server error bodies, URLs, headers, or raw transport errors.
		return fail(3, fmt.Sprintf("gateway returned HTTP %d", response.StatusCode))
	}
	contentType, _, err := mime.ParseMediaType(response.Header.Get("Content-Type"))
	if err != nil || contentType != "application/json" {
		return fail(4, "malformed gateway response: expected application/json")
	}
	const maxBody = 1 << 20
	body, err := io.ReadAll(io.LimitReader(response.Body, maxBody+1))
	if err != nil {
		return fail(3, "gateway response interrupted or timed out")
	}
	if len(body) > maxBody {
		return fail(4, "malformed gateway response: exceeds 1 MiB")
	}
	var list struct {
		Ports []port `json:"ports"`
	}
	var detail port
	var target any = &list
	if id != "" {
		target = &detail
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil || decoder.Decode(new(any)) != io.EOF {
		return fail(4, "malformed gateway response: invalid JSON or fields")
	}
	if id != "" {
		list.Ports = []port{detail}
		if detail.ID != id {
			return fail(4, "malformed gateway response: port ID mismatch")
		}
	}
	if list.Ports == nil {
		return fail(4, "malformed gateway response: missing ports")
	}
	seen := make(map[string]bool)
	for _, p := range list.Ports {
		if !p.valid(token) || seen[p.ID] {
			return fail(4, "malformed gateway response: invalid port")
		}
		seen[p.ID] = true
	}
	if *asJSON {
		result := map[string]any{"schema_version": 1, "command": command}
		switch {
		case command == "status":
			result["reachable"], result["port_count"] = true, len(list.Ports)
		case id != "":
			result["command"], result["port"] = "port", detail
		default:
			result["ports"] = list.Ports
		}
		return writeResult(stdout, stderr, result)
	}
	var out bytes.Buffer
	if command == "status" {
		fmt.Fprintf(&out, "Gateway read API reachable; %d port(s).\n", len(list.Ports))
	} else if id != "" {
		encoded, _ := json.MarshalIndent(detail, "", "  ")
		fmt.Fprintf(&out, "%s\n", encoded)
	} else {
		fmt.Fprintln(&out, "PORT\tMODE\tSTATE\tOUTPUT\tPOWER_W\tENERGY_WH\tQUALITY")
		for _, p := range list.Ports {
			fmt.Fprintf(&out, "%q\t%s\t%s\t%s\t%d\t%d\t%s\n", p.ID, p.Mode, p.State, p.ActualOutput, *p.Measurement.PowerW, *p.Measurement.EnergyWh, p.Measurement.Quality)
		}
	}
	fmt.Fprintln(&out, "Read-only preview. Simulator readings/output are synthetic, not physical feedback or billable energy. Replay timestamps are not wall-clock freshness.")
	if _, err := stdout.Write(out.Bytes()); err != nil {
		return fail(1, "cannot write output")
	}
	return 0
}

func writeResult(stdout, stderr io.Writer, result any) int {
	if err := json.NewEncoder(stdout).Encode(result); err != nil {
		fmt.Fprintln(stderr, "smartpod: cannot write output")
		return 1
	}
	return 0
}

func validEndpoint(u *url.URL) bool {
	if u.Scheme != "http" || u.User != nil || u.Opaque != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || u.RawFragment != "" || u.RawPath != "" || (u.Path != "/api" && u.Path != "/api/") {
		return false
	}
	ip := net.ParseIP(u.Hostname())
	port, err := strconv.Atoi(u.Port())
	return ip != nil && ip.IsLoopback() && err == nil && port > 0 && port <= 65535
}

func validID(id string) bool {
	return len(id) >= 1 && len(id) <= 128 && id[0] != '-' && strings.IndexFunc(id, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_')
	}) == -1
}

func oneOf(value string, options ...string) bool {
	for _, option := range options {
		if value == option {
			return true
		}
	}
	return false
}

func timestamp(value string) bool {
	_, err := time.Parse(time.RFC3339Nano, value)
	return err == nil
}

func (p port) valid(token string) bool {
	m := p.Measurement
	for _, value := range []string{p.ID, p.UpdatedAt, m.SampledAt} {
		if strings.Contains(value, token) {
			return false
		}
	}
	if p.ID == "" || !oneOf(p.Mode, "simulator", "smart-power", "ac-evse") ||
		!oneOf(p.State, "unavailable", "available", "authorizing", "preparing", "energizing", "active", "stopping", "faulted") ||
		!oneOf(p.ActualOutput, "open", "closed", "unknown") || !timestamp(p.UpdatedAt) || p.Faults == nil ||
		!oneOf(m.Quality, "measured", "estimated", "stale", "invalid") || !timestamp(m.SampledAt) || m.PowerW == nil {
		return false
	}
	for _, value := range []*int64{m.Sequence, m.VoltageMV, m.CurrentMA, m.EnergyWh} {
		if value == nil || *value < 0 {
			return false
		}
	}
	if p.ActiveSessionID != nil && strings.Contains(*p.ActiveSessionID, token) {
		return false
	}
	for _, f := range p.Faults {
		if f.Code == "" || strings.Contains(f.Code, token) || strings.Contains(f.OccurredAt, token) || !oneOf(f.Severity, "warning", "stop", "lockout") || f.Latched == nil || !timestamp(f.OccurredAt) {
			return false
		}
	}
	return true
}
