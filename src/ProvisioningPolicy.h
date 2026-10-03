#ifndef ProvisioningPolicy_h
#define ProvisioningPolicy_h

#include <stddef.h>

namespace smartpod_security {

struct BootDecision {
  bool provisioned;
  bool rotateSecret;
  bool clearUsers;
};

inline BootDecision decideBoot(bool markerPresent, bool markerValue,
                               bool legacyPublicSecret, bool hasSecret,
                               bool hasAdmin) {
  if (legacyPublicSecret || !hasSecret || (markerPresent && !markerValue)) {
    return {false, true, true};
  }
  return {hasAdmin, !hasAdmin, !hasAdmin};
}

inline bool validUsername(const char *value) {
  if (!value) return false;
  size_t length = 0;
  for (; value[length] != '\0'; ++length) {
    const char c = value[length];
    const bool allowed = (c >= 'a' && c <= 'z') ||
                         (c >= 'A' && c <= 'Z') ||
                         (c >= '0' && c <= '9') || c == '_' || c == '.';
    if (!allowed || length >= 24) return false;
  }
  return length > 0;
}

inline bool validPassword(const char *value) {
  if (!value) return false;
  size_t length = 0;
  while (value[length] != '\0' && length <= 64) ++length;
  return length >= 8 && length <= 64;
}

inline bool provisioningCommit(bool alreadyProvisioned, bool credentialsValid,
                               bool persistenceSucceeded) {
  return !alreadyProvisioned && credentialsValid && persistenceSucceeded;
}

inline BootDecision resetDecision() {
  return {false, true, true};
}

} // namespace smartpod_security

#endif
