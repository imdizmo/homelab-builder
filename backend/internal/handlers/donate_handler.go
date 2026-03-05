package handlers

import (
	"net/http"

	"github.com/Butterski/homelab-builder/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type DonateHandler struct {
	db *gorm.DB
}

func NewDonateHandler(db *gorm.DB) *DonateHandler {
	return &DonateHandler{db: db}
}

// GetProgress fetches the current funding progress toward the goal.
// It initializes the row if it doesn't exist yet.
func (h *DonateHandler) GetProgress(c *gin.Context) {
	var progress models.DonationProgress

	// Try to fetch the only row, sorted by earliest ID (just in case)
	if err := h.db.Order("id asc").First(&progress).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Initialize row
			progress = models.DonationProgress{
				Current: 0,
				Target:  250,
			}
			if createErr := h.db.Create(&progress).Error; createErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize donation progress"})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch donation progress"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": progress})
}

// UpdateProgress allows an admin to update the current funding amount.
func (h *DonateHandler) UpdateProgress(c *gin.Context) {
	var input struct {
		Current int `json:"current" binding:"required,min=0"`
		Target  int `json:"target"` // Optional update to target
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input, requires 'current' integer"})
		return
	}

	var progress models.DonationProgress
	if err := h.db.Order("id asc").First(&progress).Error; err != nil {
		// Should have been initialized by a GET, but handle it anyway
		if err == gorm.ErrRecordNotFound {
			progress = models.DonationProgress{
				Current: input.Current,
				Target:  250,
			}
			if input.Target > 0 {
				progress.Target = input.Target
			}
			h.db.Create(&progress)
			c.JSON(http.StatusOK, gin.H{"data": progress})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch donation progress"})
		return
	}

	// Update existing record
	progress.Current = input.Current
	if input.Target > 0 {
		progress.Target = input.Target
	}

	if err := h.db.Save(&progress).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update progress"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": progress})
}
