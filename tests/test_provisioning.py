"""Compile and exercise the firmware's pure provisioning policy on the host."""

import os
import json
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class ProvisioningPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="smartpod-provisioning-test-")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.binary = Path(cls.temp.name) / "provisioning-probe"
        command = [os.environ.get("CXX", "c++"), "-std=c++11", "-Wall", "-Wextra",
                   "-Werror", "-pedantic", "-I", str(ROOT / "src"),
                   str(ROOT / "tests/provisioning_probe.cpp"), "-o", str(cls.binary)]
        subprocess.run(command, check=True, capture_output=True)

    def test_first_boot_rotates_secret_and_clears_users(self):
        self.run_scenario("first-boot")

    def test_legacy_public_image_is_forced_back_to_provisioning(self):
        self.run_scenario("legacy")

    def test_customized_legacy_installation_is_preserved(self):
        self.run_scenario("custom-upgrade")

    def test_failed_persistence_cannot_complete_provisioning(self):
        self.run_scenario("interrupted")

    def test_provisioning_is_one_time(self):
        self.run_scenario("one-time")

    def test_reset_returns_to_provisioning_and_rotates_secret(self):
        self.run_scenario("reset")

    def test_credentials_are_bounded(self):
        self.run_scenario("credentials")

    def test_filesystem_image_contains_no_shared_credentials(self):
        config = ROOT / "data" / "config"
        self.assertEqual(json.loads((config / "securitySettings.json").read_text()),
                         {"provisioned": False})
        self.assertEqual(json.loads((config / "apSettings.json").read_text())["password"], "")
        self.assertEqual(json.loads((config / "wifiSettings.json").read_text())["password"], "")
        ota = json.loads((config / "otaSettings.json").read_text())
        self.assertFalse(ota["enabled"])
        self.assertEqual(ota["password"], "")

    def test_ordinary_responses_redact_every_stored_secret(self):
        expected = {
            "SecuritySettingsService.cpp": ['root["jwt_secret"] = ""', 'user["password"] = ""'],
            "APSettingsService.cpp": ['root["password"] = ""'],
            "WiFiSettingsService.cpp": ['root["password"] = ""'],
            "OTASettingsService.cpp": ['root["password"] = ""'],
        }
        for filename, expressions in expected.items():
            source = (ROOT / "src" / filename).read_text()
            for expression in expressions:
                with self.subTest(filename=filename, expression=expression):
                    self.assertIn(expression, source)

    def run_scenario(self, scenario):
        subprocess.run([str(self.binary), scenario], check=True, timeout=5)


if __name__ == "__main__":
    unittest.main()
