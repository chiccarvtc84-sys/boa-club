// Commande migrate : applique / annule les migrations SQL via golang-migrate.
//
// Usage :
//
//	go run ./cmd/migrate up           # applique toutes les migrations en attente
//	go run ./cmd/migrate down         # rollback d'UNE étape
//	go run ./cmd/migrate force <ver>  # force la version courante (utile si dirty)
//	go run ./cmd/migrate version      # affiche la version actuelle
package main

import (
	"errors"
	"fmt"
	"os"
	"strconv"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
)

const migrationsPath = "file://migrations"

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "✗ %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	_ = godotenv.Load()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return errors.New("DATABASE_URL manquant (vérifie ton .env à la racine api/)")
	}

	if len(os.Args) < 2 {
		return errors.New("usage : migrate up|down|force <version>|version")
	}
	cmd := os.Args[1]

	m, err := migrate.New(migrationsPath, dsn)
	if err != nil {
		return fmt.Errorf("init migrate : %w", err)
	}
	defer func() {
		_, _ = m.Close()
	}()

	switch cmd {
	case "up":
		if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			return fmt.Errorf("up : %w", err)
		}
		printVersion(m, "migrations à jour")

	case "down":
		// Une étape à la fois, c'est plus sûr qu'un down complet.
		if err := m.Steps(-1); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			return fmt.Errorf("down : %w", err)
		}
		printVersion(m, "rollback effectué")

	case "force":
		if len(os.Args) < 3 {
			return errors.New("usage : migrate force <version>")
		}
		v, err := strconv.Atoi(os.Args[2])
		if err != nil {
			return fmt.Errorf("version invalide : %w", err)
		}
		if err := m.Force(v); err != nil {
			return fmt.Errorf("force : %w", err)
		}
		fmt.Printf("✓ version forcée à %d\n", v)

	case "version":
		printVersion(m, "version actuelle")

	default:
		return fmt.Errorf("commande inconnue : %s (up|down|force|version)", cmd)
	}
	return nil
}

func printVersion(m *migrate.Migrate, label string) {
	v, dirty, err := m.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		fmt.Printf("✓ %s (aucune migration appliquée)\n", label)
		return
	}
	if err != nil {
		fmt.Printf("✓ %s (version inconnue : %v)\n", label, err)
		return
	}
	fmt.Printf("✓ %s (version=%d, dirty=%v)\n", label, v, dirty)
}
