package main

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func testStore(t *testing.T) (*sql.DB, string) {
	t.Helper()
	filename := filepath.Join(t.TempDir(), "gateway.db")
	db, err := openStore(context.Background(), filename)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db, filename
}

func TestPersistenceAndUnitBoundaries(t *testing.T) {
	ctx := context.Background()
	db, filename := testStore(t)
	for sequence := int64(0); sequence <= 11; sequence++ {
		if sequence > 0 {
			if err := appendReading(ctx, db); err != nil {
				t.Fatal(err)
			}
		}
		ports, err := readPorts(ctx, db)
		if err != nil {
			t.Fatal(err)
		}
		p := ports[0]
		if p.ID != portID || p.Mode != "simulator" || p.State != "active" || p.ActualOutput != "closed" || p.ActiveSessionID != nil || len(p.Faults) != 0 {
			t.Fatalf("unexpected metadata: %+v", p)
		}
		m := p.Measurement
		if m.Sequence != sequence || m.EnergyWh != sequence/10 || m.Quality != "estimated" || m.PowerW != 360 {
			t.Fatalf("unexpected measurement: %+v", m)
		}
	}
	before, _ := readPorts(ctx, db)
	db.Close()
	db, err := openStore(ctx, filename)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	after, err := readPorts(ctx, db)
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatalf("restart changed persisted state: %v %+v", err, after)
	}
	if err = appendReading(ctx, db); err != nil {
		t.Fatal(err)
	}
	rows, err := db.Query("SELECT sequence, energy_milliwh FROM readings ORDER BY sequence")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var count int64
	for rows.Next() {
		var sequence, energy int64
		if err = rows.Scan(&sequence, &energy); err != nil {
			t.Fatal(err)
		}
		if sequence != count || energy != count*100 {
			t.Fatalf("lost sequence/remainder: %d %d", sequence, energy)
		}
		count++
	}
	if err = rows.Err(); err != nil || count != 13 {
		t.Fatalf("readings: %d, %v", count, err)
	}
}

func TestDeterministicReplay(t *testing.T) {
	a, _ := testStore(t)
	b, _ := testStore(t)
	ctx := context.Background()
	for range 15 {
		if err := appendReading(ctx, a); err != nil {
			t.Fatal(err)
		}
		if err := appendReading(ctx, b); err != nil {
			t.Fatal(err)
		}
	}
	first, err := readPorts(ctx, a)
	if err != nil {
		t.Fatal(err)
	}
	second, err := readPorts(ctx, b)
	if err != nil || !reflect.DeepEqual(first, second) {
		t.Fatalf("replay differs: %v", err)
	}
	if first[0].Measurement.SampledAt != "2026-01-01T00:00:15Z" {
		t.Fatal("unexpected synthetic time")
	}
}

func TestRejectsCorruptAndUnavailableStorage(t *testing.T) {
	ctx := context.Background()
	t.Run("corrupt file preserved", func(t *testing.T) {
		filename := filepath.Join(t.TempDir(), "corrupt.db")
		original := []byte("not a SQLite database")
		if err := os.WriteFile(filename, original, 0600); err != nil {
			t.Fatal(err)
		}
		if db, err := openStore(ctx, filename); err == nil {
			db.Close()
			t.Fatal("accepted corruption")
		}
		current, err := os.ReadFile(filename)
		if err != nil || string(current) != string(original) {
			t.Fatal("corrupt file replaced")
		}
	})
	for name, filename := range map[string]string{
		"directory": t.TempDir(), "missing parent": filepath.Join(t.TempDir(), "missing", "gateway.db"), "memory": ":memory:",
	} {
		t.Run(name, func(t *testing.T) {
			if db, err := openStore(ctx, filename); err == nil {
				db.Close()
				t.Fatal("accepted unavailable storage")
			}
		})
	}
	t.Run("closed store", func(t *testing.T) {
		db, _ := testStore(t)
		db.Close()
		if _, err := readPorts(ctx, db); err == nil {
			t.Fatal("silently read from closed storage")
		}
		if err := appendReading(ctx, db); err == nil {
			t.Fatal("silently wrote to closed storage")
		}
	})
}

func TestMigrationsRejectUnknownOrDamagedSchemas(t *testing.T) {
	for name, statement := range map[string]string{
		"future version":                "PRAGMA user_version = 2",
		"unversioned existing database": "PRAGMA user_version = 0",
		"missing readings":              "DELETE FROM readings",
	} {
		t.Run(name, func(t *testing.T) {
			db, filename := testStore(t)
			if _, err := db.Exec(statement); err != nil {
				t.Fatal(err)
			}
			db.Close()
			if reopened, err := openStore(context.Background(), filename); err == nil {
				reopened.Close()
				t.Fatal("reseeded invalid schema")
			}
		})
	}
}

func TestLockedWritePreservesSequence(t *testing.T) {
	db, filename := testStore(t)
	other, err := sql.Open("sqlite", filename)
	if err != nil {
		t.Fatal(err)
	}
	defer other.Close()
	if _, err = other.Exec("BEGIN EXCLUSIVE"); err != nil {
		t.Fatal(err)
	}
	if err = appendReading(context.Background(), db); err == nil {
		t.Fatal("write succeeded through exclusive lock")
	}
	if _, err = other.Exec("ROLLBACK"); err != nil {
		t.Fatal(err)
	}
	ports, err := readPorts(context.Background(), db)
	if err != nil || ports[0].Measurement.Sequence != 0 {
		t.Fatalf("failed write changed sequence: %v", err)
	}
	if err = appendReading(context.Background(), db); err != nil {
		t.Fatal(err)
	}
}
