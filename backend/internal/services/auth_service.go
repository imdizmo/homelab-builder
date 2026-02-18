package services

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/Butterski/homelab-builder/backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthService struct {
	db        *gorm.DB
	jwtSecret []byte
}

func NewAuthService(db *gorm.DB) *AuthService {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "homelab-builder-dev-secret-change-in-production"
	}
	return &AuthService{
		db:        db,
		jwtSecret: []byte(secret),
	}
}

type TokenClaims struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	jwt.RegisteredClaims
}

type GoogleLoginInput struct {
	GoogleID  string `json:"google_id" binding:"required"`
	Email     string `json:"email" binding:"required"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func (s *AuthService) GoogleLogin(input GoogleLoginInput) (*AuthResponse, error) {
	// For MVP, we trust the input from frontend (in a real app, verify ID token!)
	// If we wanted to verify: payload, err := idtoken.Validate(ctx, input.Credential, clientID)

	return s.loginOrRegister(input.Email, input.Name, input.GoogleID, input.AvatarURL)
}

// DevLogin bypasses Google Auth for local development
func (s *AuthService) DevLogin(email string) (*AuthResponse, error) {
	if email == "" {
		return nil, errors.New("email required")
	}

	// Mock a Google ID based on email
	mockGoogleID := "dev-" + email
	name := "Dev User (" + email + ")"
	avatarURL := "https://api.dicebear.com/7.x/avataaars/svg?seed=" + email

	return s.loginOrRegister(email, name, mockGoogleID, avatarURL)
}

func (s *AuthService) loginOrRegister(email, name, googleID, avatarURL string) (*AuthResponse, error) {
	var user models.User
	result := s.db.Where("google_id = ?", googleID).First(&user)

	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			// Create new user
			user = models.User{
				GoogleID:  googleID,
				Email:     email,
				Name:      name,
				AvatarURL: avatarURL,
			}
			if err := s.db.Create(&user).Error; err != nil {
				return nil, fmt.Errorf("failed to create user: %w", err)
			}
		} else {
			return nil, fmt.Errorf("database error: %w", result.Error)
		}
	} else {
		// Update existing user
		updates := map[string]interface{}{
			"email":      email,
			"name":       name,
			"avatar_url": avatarURL,
		}
		s.db.Model(&user).Updates(updates)
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		Token: token,
		User:  user,
	}, nil
}

func (s *AuthService) GetCurrentUser(userID uuid.UUID) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *AuthService) generateToken(user models.User) (string, error) {
	claims := TokenClaims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "homelab-builder",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *AuthService) ValidateToken(tokenString string) (*TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &TokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*TokenClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}
