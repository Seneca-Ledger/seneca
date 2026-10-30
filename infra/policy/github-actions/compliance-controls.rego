package main

required_ci_jobs := {
  "dependency-scan",
  "docker",
  "hadolint",
  "lint",
  "policy-as-code",
  "secrets-scan",
  "shellcheck",
  "tests",
  "trivy-config",
  "typecheck",
}

# Seneca is self-hosted: CD builds, signs and publishes images and stops there.
# There is no deployment environment to gate and nothing deployed to smoke-test.
required_cd_jobs := {
  "build-and-publish",
  "policy-as-code",
}

deny[msg] {
  input.name == "CI"
  job := required_ci_jobs[_]
  not input.jobs[job]
  msg := sprintf("compliance(CI): missing required job %q", [job])
}

deny[msg] {
  input.name == "CI"
  not has_pull_request_trigger(input)
  msg := "compliance(CI): workflow must run on pull_request"
}

deny[msg] {
  input.name == "CD"
  job := required_cd_jobs[_]
  not input.jobs[job]
  msg := sprintf("compliance(CD): missing required job %q", [job])
}

deny[msg] {
  input.name == "CD"
  build := input.jobs["build-and-publish"]
  perms := object.get(build, "permissions", {})
  object.get(perms, "id-token", "") != "write"
  msg := "compliance(CD): build-and-publish must request id-token: write (OIDC/Sigstore)"
}

deny[msg] {
  input.name == "CD"
  build := input.jobs["build-and-publish"]
  perms := object.get(build, "permissions", {})
  object.get(perms, "attestations", "") != "write"
  msg := "compliance(CD): build-and-publish must request attestations: write (SLSA attestations)"
}

deny[msg] {
  input.name == "CD"
  build := input.jobs["build-and-publish"]
  not job_uses(build, "step-security/harden-runner@")
  msg := "compliance(CD): build-and-publish must harden runner (step-security/harden-runner)"
}

deny[msg] {
  input.name == "CD"
  build := input.jobs["build-and-publish"]
  not publishes_provenance(build)
  msg := "compliance(CD): build-and-publish must publish SLSA provenance attestation"
}

deny[msg] {
  input.name == "CD"
  build := input.jobs["build-and-publish"]
  not publishes_sbom(build)
  msg := "compliance(CD): build-and-publish must publish SBOM attestation"
}

has_pull_request_trigger(wf) {
  triggers := wf["on"]
  is_object(triggers)
  triggers["pull_request"]
} else {
  triggers := wf[true]
  is_object(triggers)
  triggers["pull_request"]
} else {
  triggers := wf["on"]
  is_array(triggers)
  triggers[_] == "pull_request"
} else {
  triggers := wf[true]
  is_array(triggers)
  triggers[_] == "pull_request"
}

# actions/attest replaced attest-build-provenance and attest-sbom (now thin wrappers
# over it): with no sbom-path or predicate input it attests SLSA build provenance,
# with sbom-path it attests the SBOM.
publishes_provenance(job) {
  job_uses(job, "actions/attest-build-provenance@")
} else {
  some i
  step := job.steps[i]
  startswith(object.get(step, "uses", ""), "actions/attest@")
  inputs := object.get(step, "with", {})
  not inputs["sbom-path"]
  not inputs["predicate"]
  not inputs["predicate-path"]
  not inputs["predicate-type"]
}

publishes_sbom(job) {
  job_uses(job, "actions/attest-sbom@")
} else {
  some i
  step := job.steps[i]
  startswith(object.get(step, "uses", ""), "actions/attest@")
  object.get(step, "with", {})["sbom-path"]
}

job_uses(job, prefix) {
  steps := object.get(job, "steps", [])
  is_array(steps)
  some i
  step := steps[i]
  uses := object.get(step, "uses", "")
  startswith(uses, prefix)
}
