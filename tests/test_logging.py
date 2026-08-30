"""Compile the real C++ logger and validate its emitted records on the host."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class LoggingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="smartpod-log-test-")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.binary = Path(cls.temp.name) / "logger-probe"
        cls.command = [os.environ.get("CXX", "c++"), "-std=c++11", "-Wall", "-Wextra",
                       "-Werror", "-pedantic", "-I", str(ROOT / "tests/fakes"),
                       "-I", str(ROOT / "src"), str(ROOT / "tests/logger_probe.cpp")]
        subprocess.run(cls.command + ["-o", str(cls.binary)], check=True, capture_output=True)

    def probe(self, scenario):
        return subprocess.run([str(self.binary), scenario], check=True,
                              text=True, capture_output=True, timeout=5).stdout

    def test_json_schema_and_numeric_code(self):
        record = json.loads(self.probe("json"))
        self.assertEqual(record, {"uptime_ms": 42, "level": "warn", "service": "smartpod",
                                  "component": "wifi", "message": "disconnected",
                                  "truncated": False, "code": 201})

    def test_human_readable_text_and_progress(self):
        self.assertEqual(self.probe("text"), "[42] info smartpod/ota: progress progress_percent=50\n")

    def test_all_level_thresholds_including_off(self):
        records = [json.loads(line) for line in self.probe("levels").splitlines()]
        self.assertEqual(len(records), 10)
        levels = ["debug", "info", "warn", "error", "off"]
        for minimum, name in enumerate(levels):
            actual = [record["level"] for record in records if record["component"] == name]
            self.assertEqual(actual, levels[minimum:4])

    def test_filtered_records_do_not_call_clock_or_sink(self):
        self.assertEqual(self.probe("filtered"), "")

    def test_instances_do_not_change_each_others_configuration(self):
        self.assertEqual(json.loads(self.probe("independent"))["message"], "visible")

    def test_json_escaping_and_log_injection(self):
        output = self.probe("escaping")
        self.assertEqual(output.count("\n"), 1)
        self.assertNotIn("\x1b", output)
        record = json.loads(output)
        self.assertEqual(record["component"], 'http?"')
        self.assertEqual(record["message"], 'quotes " slashes \\ controls????[31m percent %s')

    def test_text_removes_terminal_controls_and_line_breaks(self):
        output = self.probe("text-controls")
        self.assertEqual(output, "[42] info smartpod/wifi?: line???[2J\n")

    def test_maximum_escaped_record_still_fits_and_parses(self):
        output = self.probe("maximum")
        self.assertLess(len(output.encode()), 512)
        record = json.loads(output)
        self.assertEqual(record["component"], '"' * 32)
        self.assertEqual(record["message"], "\\" * 128)
        self.assertEqual(record["code"], 4294967295)
        self.assertFalse(record["truncated"])

    def test_long_input_has_explicit_truncation_flag(self):
        record = json.loads(self.probe("truncation"))
        self.assertEqual(record["component"], "c" * 32)
        self.assertEqual(record["message"], "m" * 128)
        self.assertTrue(record["truncated"])

    def test_null_inputs_clock_and_sink(self):
        record = json.loads(self.probe("nulls"))
        self.assertEqual(record["component"], "")
        self.assertEqual(record["message"], "")
        self.assertEqual(record["uptime_ms"], 0)

    def test_uptime_is_not_misrepresented_as_wall_time(self):
        records = [json.loads(line) for line in self.probe("wrap").splitlines()]
        self.assertEqual([record["uptime_ms"] for record in records], [4294967295, 0])
        self.assertTrue(all("timestamp" not in record for record in records))

    def test_firmware_adapter_suppresses_pre_serial_output(self):
        record = json.loads(self.probe("startup"))
        self.assertEqual(record["message"], "after serial setup")

    def test_invalid_build_configuration_fails_compilation(self):
        for flag in ("-DSMARTPOD_LOG_LEVEL=9", "-DSMARTPOD_LOG_TEXT=2"):
            with self.subTest(flag=flag):
                result = subprocess.run(self.command + [flag, "-o", str(Path(self.temp.name) / "invalid")],
                                        capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("static assertion failed", result.stderr)

    def test_text_build_configuration(self):
        binary = Path(self.temp.name) / "text-probe"
        subprocess.run(self.command + ["-DSMARTPOD_LOG_TEXT=1", "-o", str(binary)],
                       check=True, capture_output=True)
        result = subprocess.run([str(binary), "startup"], check=True, capture_output=True, text=True)
        self.assertEqual(result.stdout, "[42] info smartpod/system: after serial setup\n")

    def test_firmware_call_sites_use_constant_messages_without_raw_serial_logs(self):
        # Keep request/user values out of diagnostics; typed numeric fields are allowed.
        import re
        for path in (ROOT / "src").iterdir():
            if path.suffix not in (".cpp", ".h"):
                continue
            text = path.read_text()
            self.assertNotRegex(text, r"Serial\.(?:print|printf|println|flush)\s*\(", str(path))
            for args in re.findall(r"smartpod_logging::logger\(\)\.write\((.*?)\);", text, re.S):
                self.assertRegex(args, r'^smartpod_logging::LogLevel::\w+,\s*"[^"\n]*",\s*"[^"\n]*"(?:\s*,|\s*$)', str(path))


if __name__ == "__main__":
    unittest.main()
