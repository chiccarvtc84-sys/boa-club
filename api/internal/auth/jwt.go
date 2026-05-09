package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Erreurs publiques renvoyées par ce package.
var (
	ErrInvalidToken = errors.New("token invalide")
	ErrExpiredToken = errors.New("token expiré")
)

// AccessClaims sont les claims JWT pour l'access token.
// On garde un payload minimal : un access compromis ne doit pas exposer plus que
// l'ID utilisateur et son rôle.
type AccessClaims struct {
	UserID uuid.UUID `json:"uid"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

// Manager encapsule la signature/vérification des access tokens et la
// génération de refresh tokens opaques.
type Manager struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// NewManager construit un Manager. Le secret doit faire ≥ 32 bytes en prod.
func NewManager(secret string, accessTTL, refreshTTL time.Duration) *Manager {
	return &Manager{
		secret:     []byte(secret),
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
}

func (m *Manager) AccessTTL() time.Duration  { return m.accessTTL }
func (m *Manager) RefreshTTL() time.Duration { return m.refreshTTL }

// GenerateAccess signe un access token JWT (HS256) pour cet utilisateur.
// Renvoie le token, sa date d'expiration, et une éventuelle erreur.
func (m *Manager) GenerateAccess(userID uuid.UUID, role string) (string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(m.accessTTL)
	claims := AccessClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			Issuer:    "boa-club",
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("signature jwt : %w", err)
	}
	return signed, expiresAt, nil
}

// ParseAccess vérifie la signature, l'algorithme et l'expiration.
// Renvoie ErrExpiredToken si le token est expiré, ErrInvalidToken sinon.
func (m *Manager) ParseAccess(tokenStr string) (*AccessClaims, error) {
	claims := &AccessClaims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		// On bloque l'algorithme pour éviter l'attaque "alg=none" et le
		// confusion HMAC/RSA.
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("algorithme inattendu : %s", t.Method.Alg())
		}
		return m.secret, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, fmt.Errorf("%w : %v", ErrInvalidToken, err)
	}
	return claims, nil
}

// GenerateRefresh crée un refresh token opaque de 32 bytes random.
//
// On stocke le hash en BDD (pas le token brut), pour que le vol de la BDD ne
// suffise pas à ressusciter une session.
//
// Renvoie : le token brut (à donner au client), son hash (à stocker en BDD),
// et la date d'expiration.
func (m *Manager) GenerateRefresh() (token, hash string, expiresAt time.Time, err error) {
	bytes := make([]byte, 32)
	if _, err = rand.Read(bytes); err != nil {
		return "", "", time.Time{}, fmt.Errorf("generate random : %w", err)
	}
	token = base64.RawURLEncoding.EncodeToString(bytes)
	hash = HashRefresh(token)
	expiresAt = time.Now().Add(m.refreshTTL)
	return token, hash, expiresAt, nil
}

// HashRefresh hash un refresh token brut avec SHA-256.
//
// SHA-256 (et pas bcrypt) parce que le token a 256 bits d'entropie aléatoire :
// le bruteforce est impossible, et bcrypt ralentirait inutilement chaque
// vérification de refresh.
func HashRefresh(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
