package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

const portID = "sim-port-1"

// One deterministic ten-year replay, not wall-clock or hardware telemetry.
const maxSequence = 315360000

type measurement struct {
	Sequence  int64  `json:"sequence"`
	VoltageMV int64  `json:"voltage_mv"`
	CurrentMA int64  `json:"current_ma"`
	PowerW    int64  `json:"active_power_w"`
	EnergyWh  int64  `json:"energy_wh"`
	Quality   string `json:"quality"`
	SampledAt string `json:"sampled_at"`
}

type port struct {
	ID              string      `json:"id"`
	Mode            string      `json:"mode"`
	State           string      `json:"state"`
	ActualOutput    string      `json:"actual_output"`
	Measurement     measurement `json:"measurement"`
	Faults          []struct{}  `json:"faults"`
	ActiveSessionID *string     `json:"active_session_id"`
	UpdatedAt       string      `json:"updated_at"`
}

// Increment user_version only inside this transaction when adding a migration.
const migrationV1 = `
CREATE TABLE ports (
 id TEXT PRIMARY KEY CHECK (id = 'sim-port-1'),
 mode TEXT NOT NULL CHECK (mode = 'simulator'),
 state TEXT NOT NULL CHECK (state = 'active'),
 actual_output TEXT NOT NULL CHECK (actual_output = 'closed')
);
CREATE TABLE readings (
 port_id TEXT NOT NULL REFERENCES ports(id),
 sequence INTEGER NOT NULL CHECK (sequence BETWEEN 0 AND 315360000),
 voltage_mv INTEGER NOT NULL CHECK (voltage_mv = 230000),
 current_ma INTEGER NOT NULL CHECK (current_ma = 1565),
 active_power_w INTEGER NOT NULL CHECK (active_power_w = 360),
 energy_milliwh INTEGER NOT NULL CHECK (energy_milliwh = sequence * 100),
 sampled_at TEXT NOT NULL,
 PRIMARY KEY (port_id, sequence)
);
INSERT INTO ports VALUES ('sim-port-1', 'simulator', 'active', 'closed');
INSERT INTO readings VALUES ('sim-port-1', 0, 230000, 1565, 360, 0, '2026-01-01T00:00:00Z');
PRAGMA user_version = 1;
`

func openStore(ctx context.Context, filename string) (*sql.DB, error) {
	// A filename, not an SQLite URI: callers cannot select in-memory/read-only modes.
	absolute, err := filepath.Abs(filename)
	if err != nil || filename == "" || filename == ":memory:" {
		return nil, errors.New("invalid database filename")
	}
	file, err := os.OpenFile(absolute, os.O_RDWR|os.O_CREATE, 0600)
	if err != nil {
		return nil, errors.New("database file unavailable")
	}
	if err = file.Close(); err != nil {
		return nil, err
	}
	dsn := (&url.URL{Scheme: "file", Path: absolute}).String() + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(1000)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, errors.New("database open failed")
	}
	db.SetMaxOpenConns(1)
	if err = initializeStore(ctx, db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func initializeStore(ctx context.Context, db *sql.DB) error {
	var check string
	if err := db.QueryRowContext(ctx, "PRAGMA quick_check").Scan(&check); err != nil || check != "ok" {
		return errors.New("database integrity check failed; preserve the file for recovery")
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return errors.New("database unavailable")
	}
	defer tx.Rollback()
	var version int
	if err = tx.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		return err
	}
	switch version {
	case 0:
		var count int
		if err = tx.QueryRowContext(ctx, "SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").Scan(&count); err != nil {
			return err
		}
		if count != 0 {
			return errors.New("refusing to initialize an unrelated database")
		}
		if _, err = tx.ExecContext(ctx, migrationV1); err != nil {
			return errors.New("database migration failed")
		}
	case 1:
	default:
		return fmt.Errorf("unsupported database schema version %d", version)
	}
	// Missing or altered preview data is an error, never a reason to reseed history.
	var valid int
	err = tx.QueryRowContext(ctx, `SELECT count(*) FROM ports p WHERE p.id = 'sim-port-1'
 AND p.mode = 'simulator' AND p.state = 'active' AND p.actual_output = 'closed'
 AND EXISTS (SELECT 1 FROM readings WHERE port_id = p.id AND sequence = 0)`).Scan(&valid)
	if err != nil || valid != 1 {
		return errors.New("invalid simulator database")
	}
	if err = tx.Commit(); err != nil {
		return errors.New("database migration commit failed")
	}
	return nil
}

func appendReading(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var previous int64
	if err = tx.QueryRowContext(ctx, "SELECT MAX(sequence) FROM readings WHERE port_id = ?", portID).Scan(&previous); err != nil {
		return err
	}
	if previous >= maxSequence {
		return errors.New("simulator replay exhausted")
	}
	sequence := previous + 1
	stamp := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).Add(time.Duration(sequence) * time.Second).Format(time.RFC3339)
	_, err = tx.ExecContext(ctx, `INSERT INTO readings
 (port_id, sequence, voltage_mv, current_ma, active_power_w, energy_milliwh, sampled_at)
 VALUES (?, ?, 230000, 1565, 360, ?, ?)`, portID, sequence, sequence*100, stamp)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func readPorts(ctx context.Context, db *sql.DB) ([]port, error) {
	rows, err := db.QueryContext(ctx, `SELECT p.id, p.mode, p.state, p.actual_output,
 r.sequence, r.voltage_mv, r.current_ma, r.active_power_w, r.energy_milliwh, r.sampled_at
 FROM ports p JOIN readings r ON p.id = r.port_id
 WHERE r.sequence = (SELECT MAX(sequence) FROM readings WHERE port_id = p.id)
 ORDER BY p.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ports := make([]port, 0, 1)
	for rows.Next() {
		var p port
		var milliWh int64
		m := &p.Measurement
		if err = rows.Scan(&p.ID, &p.Mode, &p.State, &p.ActualOutput, &m.Sequence, &m.VoltageMV, &m.CurrentMA, &m.PowerW, &milliWh, &m.SampledAt); err != nil {
			return nil, err
		}
		m.EnergyWh = milliWh / 1000 // Source precision stays in SQLite, not this projection.
		m.Quality = "estimated"
		p.Faults = []struct{}{}
		p.UpdatedAt = m.SampledAt
		ports = append(ports, p)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if len(ports) != 1 {
		return nil, errors.New("simulator port unavailable")
	}
	return ports, nil
}
