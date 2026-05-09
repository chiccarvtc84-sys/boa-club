.PHONY: help db-up db-down db-reset migrate migrate-create run dev test build clean

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# === Base de données ===

db-up: ## Démarre Postgres + Redis en Docker
	docker compose up -d
	@echo "✓ Postgres sur localhost:5432, Redis sur localhost:6379"

db-down: ## Arrête les services Docker
	docker compose down

db-reset: ## Reset complet de la BDD (⚠ supprime toutes les données)
	docker compose down -v
	docker compose up -d
	@echo "Attente du démarrage de Postgres..."
	@sleep 3
	@$(MAKE) migrate

db-shell: ## Ouvre un shell psql
	docker exec -it boa-club-postgres psql -U boa -d boa_club

# === Migrations ===

migrate: ## Applique toutes les migrations SQL
	@cd api && go run ./cmd/migrate up

migrate-down: ## Annule la dernière migration
	@cd api && go run ./cmd/migrate down

migrate-create: ## Crée une nouvelle migration. Usage: make migrate-create NAME=add_user_table
	@if [ -z "$(NAME)" ]; then echo "Erreur: NAME manquant. Usage: make migrate-create NAME=ma_migration"; exit 1; fi
	@TIMESTAMP=$$(date +%Y%m%d%H%M%S); \
	touch api/migrations/$${TIMESTAMP}_$(NAME).up.sql; \
	touch api/migrations/$${TIMESTAMP}_$(NAME).down.sql; \
	echo "Créé: api/migrations/$${TIMESTAMP}_$(NAME).up.sql"

# === Serveur ===

run: ## Lance le serveur Go (mode dev simple)
	cd api && go run ./cmd/server

dev: ## Lance le serveur avec hot-reload (nécessite air: go install github.com/air-verse/air@latest)
	cd api && air

build: ## Compile le binaire de production
	cd api && CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/server ./cmd/server
	@echo "✓ Binaire créé: api/bin/server"

# === Tests & qualité ===

test: ## Lance les tests
	cd api && go test ./... -v -cover

test-short: ## Lance uniquement les tests rapides
	cd api && go test ./... -short

lint: ## Lint le code Go (nécessite golangci-lint)
	cd api && golangci-lint run

fmt: ## Formate le code Go
	cd api && go fmt ./...

# === Nettoyage ===

clean: ## Supprime les binaires et caches
	rm -rf api/bin
	cd api && go clean -cache
