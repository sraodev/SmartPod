package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"
)

func validateListen(address string) error {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return errors.New("listen must be a numeric loopback IP and port")
	}
	ip, err := netip.ParseAddr(host)
	n, portErr := strconv.Atoi(port)
	if err != nil || !ip.IsLoopback() || ip.Zone() != "" || portErr != nil || n < 0 || n > 65535 {
		return errors.New("only numeric loopback listeners are supported; non-loopback exposure needs a security design")
	}
	return nil
}

func run(ctx context.Context, args []string, token string, output io.Writer) error {
	flags := flag.NewFlagSet("smartpod-gateway", flag.ContinueOnError)
	flags.SetOutput(output)
	address := flags.String("listen", "127.0.0.1:8080", "numeric loopback IP:port (no public listener)")
	filename := flags.String("db", "smartpod-gateway.db", "SQLite filename; parent directory must exist")
	if err := flags.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return errors.New("invalid gateway arguments")
	}
	if flags.NArg() != 0 {
		return errors.New("unexpected positional arguments")
	}
	if err := validateListen(*address); err != nil {
		return err
	}
	if len(token) < 32 || len(token) > 256 || strings.IndexFunc(token, func(r rune) bool { return r < 33 || r > 126 }) >= 0 {
		return errors.New("SMARTPOD_GATEWAY_TOKEN must contain 32-256 printable non-space ASCII characters; use a random token")
	}
	startupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	db, err := openStore(startupCtx, *filename)
	cancel()
	if err != nil {
		return err
	}
	defer db.Close()
	listener, err := net.Listen("tcp", *address)
	if err != nil {
		return errors.New("loopback listener unavailable")
	}
	defer listener.Close()
	server := &http.Server{
		Handler:           apiHandler(db, listener.Addr().String(), token),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 5 * time.Second,
		WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 8192,
	}
	logger := slog.New(slog.NewJSONHandler(output, nil))
	errorsCh := make(chan error, 2)
	go func() { errorsCh <- server.Serve(listener) }()
	workerCtx, stopWorker := context.WithCancel(ctx)
	workerDone := make(chan struct{})
	go func() {
		defer close(workerDone)
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-workerCtx.Done():
				return
			case <-ticker.C:
				writeCtx, done := context.WithTimeout(workerCtx, 3*time.Second)
				err := appendReading(writeCtx, db)
				done()
				if err != nil {
					if workerCtx.Err() != nil {
						return
					}
					errorsCh <- errors.New("simulator storage write failed; service stopped without discarding history")
					return
				}
			}
		}
	}()
	logger.Info("gateway listening", "address", listener.Addr().String(), "mode", "simulator")
	select {
	case <-ctx.Done():
	case err = <-errorsCh:
	}
	stopWorker()
	<-workerDone
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if shutdownErr := server.Shutdown(shutdownCtx); shutdownErr != nil {
		server.Close()
		if err == nil {
			err = errors.New("gateway shutdown timed out")
		}
	}
	logger.Info("gateway stopped")
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if err := run(ctx, os.Args[1:], os.Getenv("SMARTPOD_GATEWAY_TOKEN"), os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
