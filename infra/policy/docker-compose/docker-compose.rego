package main

deny[msg] {
  some name
  svc := input.services[name]
  svc.privileged == true
  msg := sprintf("docker-compose: service %q must not run privileged", [name])
}

deny[msg] {
  some name
  svc := input.services[name]
  svc.network_mode == "host"
  msg := sprintf("docker-compose: service %q must not use host network_mode", [name])
}

deny[msg] {
  some name
  svc := input.services[name]
  svc.pid == "host"
  msg := sprintf("docker-compose: service %q must not use host PID namespace", [name])
}

deny[msg] {
  some name
  svc := input.services[name]
  vols := svc.volumes
  is_array(vols)
  some i
  v := vols[i]
  contains(v, "/var/run/docker.sock")
  not docker_socket_allowed(name, svc)
  msg := sprintf("docker-compose: service %q must not mount docker socket (%s)", [name, v])
}

# The in-app updater (`make upgrade` from Settings) has to drive Docker. It is
# the one exception, and only while it stays opt-in behind its own profile.
docker_socket_allowed(name, svc) {
  name == "updater"
  some i
  svc.profiles[i] == "updater"
}

deny[msg] {
  some name
  svc := input.services[name]
  caps := svc.cap_add
  is_array(caps)
  some i
  upper(caps[i]) == "SYS_ADMIN"
  msg := sprintf("docker-compose: service %q must not add SYS_ADMIN capability", [name])
}

deny[msg] {
  some name
  svc := input.services[name]
  opts := svc.security_opt
  is_array(opts)
  some i
  lower(opts[i]) == "seccomp:unconfined"
  msg := sprintf("docker-compose: service %q must not disable seccomp (seccomp:unconfined)", [name])
}

deny[msg] {
  some name
  svc := input.services[name]
  image := svc.image
  image != ""
  not contains(image, "@sha256:")
  endswith(image, ":latest")
  msg := sprintf("docker-compose: service %q uses :latest tag (%s)", [name, image])
}

deny[msg] {
  some name
  svc := input.services[name]
  image := svc.image
  image != ""
  not contains(image, "@sha256:")
  not contains(image, ":")
  msg := sprintf("docker-compose: service %q uses image without explicit tag (%s)", [name, image])
}

warn[msg] {
  some name
  svc := input.services[name]
  env := svc.environment
  is_object(env)
  some key
  value := env[key]
  is_sensitive_key(key)
  value != ""
  not is_dynamic_value(value)
  msg := sprintf("docker-compose: service %q sets %s as a literal; prefer env var / secret manager", [name, key])
}

warn[msg] {
  some name
  svc := input.services[name]
  env := svc.environment
  is_array(env)
  some i
  item := env[i]
  contains(item, "=")
  parts := split(item, "=")
  key := parts[0]
  value := concat("=", array.slice(parts, 1, count(parts)))
  is_sensitive_key(key)
  value != ""
  not is_dynamic_value(value)
  msg := sprintf("docker-compose: service %q sets %s as a literal; prefer env var / secret manager", [name, key])
}

is_sensitive_key(key) {
  k := lower(key)
  contains(k, "password")
} else {
  k := lower(key)
  contains(k, "secret")
} else {
  k := lower(key)
  endswith(k, "token")
} else {
  k := lower(key)
  endswith(k, "key")
}

is_dynamic_value(value) {
  contains(value, "${")
} else {
  contains(value, "$(")
}
