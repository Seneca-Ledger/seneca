# Policy-as-Code (OPA/Rego)

Этот каталог содержит политики OPA/Rego, которые исполняются в CI через `conftest`.

Локальный запуск (пример):

```bash
# Compose-файлы
docker run --rm -v "$PWD":/project -w /project openpolicyagent/conftest:v0.56.0 \
  test -p policy/docker-compose docker-compose.yml docker-compose.dev.yml

# GitHub Actions workflows
docker run --rm -v "$PWD":/project -w /project openpolicyagent/conftest:v0.56.0 \
  test -p policy/github-actions .github/workflows/*.yml
```

Обе проверки запускаются и в CI, и в CD.

