#include <ProvisioningPolicy.h>

#include <cassert>
#include <string>

using smartpod_security::BootDecision;

static void expectDecision(BootDecision decision, bool provisioned,
                           bool rotateSecret, bool clearUsers) {
  assert(decision.provisioned == provisioned);
  assert(decision.rotateSecret == rotateSecret);
  assert(decision.clearUsers == clearUsers);
}

int main(int argc, char **argv) {
  assert(argc == 2);
  const std::string scenario(argv[1]);

  if (scenario == "first-boot") {
    expectDecision(smartpod_security::decideBoot(true, false, false, false, false),
                   false, true, true);
  } else if (scenario == "legacy") {
    expectDecision(smartpod_security::decideBoot(false, false, true, true, true),
                   false, true, true);
  } else if (scenario == "custom-upgrade") {
    expectDecision(smartpod_security::decideBoot(false, false, false, true, true),
                   true, false, false);
  } else if (scenario == "interrupted") {
    assert(!smartpod_security::provisioningCommit(false, true, false));
  } else if (scenario == "one-time") {
    assert(smartpod_security::provisioningCommit(false, true, true));
    assert(!smartpod_security::provisioningCommit(true, true, true));
  } else if (scenario == "reset") {
    expectDecision(smartpod_security::resetDecision(), false, true, true);
  } else if (scenario == "credentials") {
    assert(smartpod_security::validUsername("admin_1"));
    assert(!smartpod_security::validUsername(""));
    assert(!smartpod_security::validUsername("bad user"));
    assert(smartpod_security::validPassword("eight888"));
    assert(!smartpod_security::validPassword("short"));
  } else {
    return 2;
  }
  return 0;
}
