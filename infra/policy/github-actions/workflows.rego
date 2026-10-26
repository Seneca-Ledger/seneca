package main

deny[msg] {
  not input.permissions
  msg := "github-actions: workflow should define explicit top-level permissions"
}

deny[msg] {
  some job_name
  job := input.jobs[job_name]
  steps := job.steps
  is_array(steps)
  some i
  step := steps[i]
  checkout_step(step)
  not checkout_persist_credentials_disabled(step)
  msg := sprintf("github-actions: %q uses actions/checkout without persist-credentials: false", [job_name])
}

checkout_step(step) {
  uses := step.uses
  startswith(uses, "actions/checkout@")
}

checkout_persist_credentials_disabled(step) {
  with_cfg := step["with"]
  is_object(with_cfg)
  v := with_cfg["persist-credentials"]
  v == false
} else {
  with_cfg := step["with"]
  is_object(with_cfg)
  v := with_cfg["persist-credentials"]
  v == "false"
}
