package services

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/Butterski/homelab-builder/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IPService proxies IP calculation requests to the hlbIPAM microservice
// and persists results back into the database.
type IPService struct {
	db      *gorm.DB
	client  *http.Client
	ipamURL string
}

func NewIPService(db *gorm.DB) *IPService {
	url := os.Getenv("IPAM_URL")
	if url == "" {
		url = "http://localhost:8081"
	}
	return &IPService{
		db:      db,
		client:  &http.Client{Timeout: 10 * time.Second},
		ipamURL: url,
	}
}

// ── hlbIPAM request/response DTOs ──────────────────────────────────────────

type ipamRouter struct {
	ID        string `json:"id"`
	GatewayIP string `json:"gateway_ip,omitempty"`
	Subnet    string `json:"subnet,omitempty"`
}

type ipamVM struct {
	ID         string `json:"id"`
	ExistingIP string `json:"existing_ip,omitempty"`
}

type ipamNode struct {
	ID          string   `json:"id"`
	Type        string   `json:"type"`
	Connections []string `json:"connections"`
	ExistingIP  string   `json:"existing_ip,omitempty"`
	VMs         []ipamVM `json:"vms,omitempty"`
}

type ipamRequest struct {
	Routers []ipamRouter `json:"routers"`
	Nodes   []ipamNode   `json:"nodes"`
}

type ipamVMResult struct {
	ID         string `json:"id"`
	AssignedIP string `json:"assigned_ip"`
}

type ipamNodeResult struct {
	ID         string         `json:"id"`
	Type       string         `json:"type"`
	AssignedIP string         `json:"assigned_ip"`
	VMs        []ipamVMResult `json:"vms,omitempty"`
}

type ipamRouterResult struct {
	ID        string `json:"id"`
	GatewayIP string `json:"gateway_ip"`
	Subnet    string `json:"subnet"`
}

type ipamResponse struct {
	Routers []ipamRouterResult `json:"routers"`
	Nodes   []ipamNodeResult   `json:"nodes"`
}

// ─── Non-network types that don't receive IPs ───────────────────────────────

var nonNetworkTypes = map[string]bool{
	"disk": true, "gpu": true, "hba": true, "pcie": true, "pdu": true, "ups": true,
}

// ─── Public API ─────────────────────────────────────────────────────────────

// CalculateNetwork loads the build's topology from the DB, sends it to
// hlbIPAM for allocation, and writes the assigned IPs back.
func (s *IPService) CalculateNetwork(buildID uuid.UUID) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Load nodes and edges
		var nodes []models.Node
		if err := tx.Preload("VirtualMachines").Where("build_id = ?", buildID).Find(&nodes).Error; err != nil {
			return err
		}
		if len(nodes) == 0 {
			return nil
		}

		var edges []models.Edge
		if err := tx.Where("build_id = ?", buildID).Find(&edges).Error; err != nil {
			return err
		}

		// 2. Build adjacency from edges (as connection lists per node)
		adj := make(map[string][]string, len(nodes))
		for _, e := range edges {
			src := e.SourceNodeID.String()
			tgt := e.TargetNodeID.String()
			adj[src] = append(adj[src], tgt)
			adj[tgt] = append(adj[tgt], src)
		}

		// 3. Build hlbIPAM request
		req := ipamRequest{
			Routers: make([]ipamRouter, 0),
			Nodes:   make([]ipamNode, 0, len(nodes)),
		}

		for _, n := range nodes {
			nid := n.ID.String()
			if n.Type == "router" {
				req.Routers = append(req.Routers, ipamRouter{
					ID:        nid,
					GatewayIP: n.IP,
				})
			}

			vms := make([]ipamVM, 0, len(n.VirtualMachines))
			for _, vm := range n.VirtualMachines {
				vms = append(vms, ipamVM{
					ID:         vm.ID.String(),
					ExistingIP: vm.IP,
				})
			}

			existingIP := ""
			if nonNetworkTypes[n.Type] {
				// Don't send existing IP for non-network types
			} else if n.Type == "router" {
				existingIP = n.IP // preserve router IPs as existing
			}

			req.Nodes = append(req.Nodes, ipamNode{
				ID:          nid,
				Type:        n.Type,
				Connections: adj[nid],
				ExistingIP:  existingIP,
				VMs:         vms,
			})
		}

		// 4. Call hlbIPAM
		result, err := s.callIPAM(req)
		if err != nil {
			return fmt.Errorf("hlbIPAM call failed: %w", err)
		}

		// 5. Build a lookup from hlbIPAM results
		ipByID := make(map[string]string, len(result.Nodes))
		vmIPByID := make(map[string]string)
		for _, nr := range result.Nodes {
			if nr.AssignedIP != "" {
				ipByID[nr.ID] = nr.AssignedIP
			}
			for _, vmr := range nr.VMs {
				if vmr.AssignedIP != "" {
					vmIPByID[vmr.ID] = vmr.AssignedIP
				}
			}
		}

		// Map router gateway IPs from hlbIPAM response
		routerIPByID := make(map[string]string, len(result.Routers))
		for _, rr := range result.Routers {
			if rr.GatewayIP != "" {
				routerIPByID[rr.ID] = rr.GatewayIP
			}
		}

		// 6. Persist assigned IPs
		for i := range nodes {
			nid := nodes[i].ID.String()
			if ip, ok := ipByID[nid]; ok {
				nodes[i].IP = ip
			}
			// Also update router gateway IPs from hlbIPAM
			if ip, ok := routerIPByID[nid]; ok {
				nodes[i].IP = ip
			}
			for j := range nodes[i].VirtualMachines {
				vmid := nodes[i].VirtualMachines[j].ID.String()
				if ip, ok := vmIPByID[vmid]; ok {
					nodes[i].VirtualMachines[j].IP = ip
				}
			}

			if err := tx.Save(&nodes[i]).Error; err != nil {
				return err
			}
			for j := range nodes[i].VirtualMachines {
				if err := tx.Save(&nodes[i].VirtualMachines[j]).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})
}

// callIPAM sends a topology to the hlbIPAM /allocate endpoint and returns the result.
func (s *IPService) callIPAM(req ipamRequest) (*ipamResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := s.ipamURL + "/api/v1/allocate"
	log.Printf("Calling hlbIPAM at %s (%d routers, %d nodes)", url, len(req.Routers), len(req.Nodes))

	resp, err := s.client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("POST %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return nil, fmt.Errorf("hlbIPAM returned %d: %s", resp.StatusCode, string(errBody))
	}

	var result ipamResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// FallbackCalculateNetwork is kept as a safety net — if hlbIPAM is unreachable,
// the system can fall back to this inline implementation.
// Currently unused; wire it in if you need offline resilience.
func (s *IPService) FallbackCalculateNetwork(buildID uuid.UUID) error {
	return errors.New("hlbIPAM service unavailable and no fallback configured")
}
