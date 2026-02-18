package services

import (
	"errors"

	"github.com/Butterski/homelab-builder/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BuildService struct {
	db *gorm.DB
}

func NewBuildService(db *gorm.DB) *BuildService {
	return &BuildService{db: db}
}

func (s *BuildService) Create(userID uuid.UUID, name, data, thumbnail string) (*models.Build, error) {
	build := &models.Build{
		UserID:    userID,
		Name:      name,
		Data:      data,
		Thumbnail: thumbnail,
	}
	result := s.db.Create(build)
	return build, result.Error
}

func (s *BuildService) Update(buildID uuid.UUID, userID uuid.UUID, name, data, thumbnail string) (*models.Build, error) {
	var build models.Build
	if err := s.db.First(&build, "id = ?", buildID).Error; err != nil {
		return nil, err
	}

	if build.UserID != userID {
		return nil, errors.New("unauthorized")
	}

	build.Name = name
	build.Data = data
	// Only update thumbnail if provided (empty string might mean keep existing? or clear? Let's assume keep if empty for now, or update if passed)
	// Actually, simple update:
	if thumbnail != "" {
		build.Thumbnail = thumbnail
	}

	if err := s.db.Save(&build).Error; err != nil {
		return nil, err
	}
	return &build, nil
}

func (s *BuildService) GetByID(buildID uuid.UUID) (*models.Build, error) {
	var build models.Build
	if err := s.db.Preload("User").First(&build, "id = ?", buildID).Error; err != nil {
		return nil, err
	}
	return &build, nil
}

func (s *BuildService) ListByUser(userID uuid.UUID) ([]models.Build, error) {
	var builds []models.Build
	// Select only metadata, not the huge Data blob for the list view
	if err := s.db.Select("id, user_id, name, thumbnail, created_at, updated_at").Where("user_id = ?", userID).Order("updated_at desc").Find(&builds).Error; err != nil {
		return nil, err
	}
	return builds, nil
}

func (s *BuildService) Delete(buildID uuid.UUID, userID uuid.UUID) error {
	result := s.db.Where("id = ? AND user_id = ?", buildID, userID).Delete(&models.Build{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("build not found or unauthorized")
	}
	return nil
}
