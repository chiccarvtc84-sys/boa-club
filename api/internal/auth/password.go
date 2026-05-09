// Package auth regroupe les primitives de sécurité : bcrypt et JWT.
package auth

import "golang.org/x/crypto/bcrypt"

// HashPassword hash un mot de passe en clair avec bcrypt au coût indiqué.
// Le coût recommandé est 12 (cf. CLAUDE.md).
func HashPassword(plain string, cost int) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(plain), cost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// ComparePassword retourne nil si le mot de passe correspond au hash,
// une erreur sinon (notamment bcrypt.ErrMismatchedHashAndPassword).
func ComparePassword(hash, plain string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain))
}
