package services

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/Butterski/homelab-builder/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// IPService handles network calculations
type IPService struct {
	db *gorm.DB
}

func NewIPService(db *gorm.DB) *IPService {
	return &IPService{db: db}
}

// ─── Role zone config ────────────────────────────────────────────────────────

type ZoneConfig struct {
	Base  int
	Step  int
	Label string
}

// ROLE_ZONE defines the starting offset and block-size for each hardware type
// within a /24 subnet. The router's last octet (e.g. .1) is the gateway.
var ROLE_ZONE = map[string]ZoneConfig{
	"router":       {Base: 1, Step: 1, Label: "Router"},
	"switch":       {Base: 10, Step: 1, Label: "Switch"},
	"access_point": {Base: 20, Step: 1, Label: "AP"},
	"ups":          {Base: 80, Step: 1, Label: "UPS"},
	"pdu":          {Base: 85, Step: 1, Label: "PDU"},
	"disk":         {Base: 90, Step: 1, Label: "Disk"},
	"nas":          {Base: 100, Step: 10, Label: "NAS"},
	"server":       {Base: 150, Step: 10, Label: "Server"},
	"pc":           {Base: 160, Step: 10, Label: "PC"},
	"minipc":       {Base: 170, Step: 10, Label: "Mini PC"},
	"sbc":          {Base: 180, Step: 10, Label: "SBC"},
	"gpu":          {Base: 190, Step: 1, Label: "GPU"},
	"hba":          {Base: 195, Step: 1, Label: "HBA"},
	"pcie":         {Base: 198, Step: 1, Label: "PCIe"},
}

var FALLBACK_ZONE = ZoneConfig{Base: 200, Step: 1, Label: "Device"}

var NON_NETWORK_TYPES = map[string]bool{
	"disk": true, "gpu": true, "hba": true, "pcie": true, "pdu": true, "ups": true,
}

// ─── Public API ─────────────────────────────────────────────────────────────

// CalculateNetwork performs a graph-aware IP assignment:
//   - Builds an undirected graph from stored edges
//   - BFS from each router to discover which nodes belong to its subnet
//   - Assigns IPs from that router's subnet (/24 prefix) to those nodes
//   - Nodes not reachable from any router are left unassigned
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

		// 2. Index nodes by ID for fast lookup
		nodeByID := make(map[uuid.UUID]int) // value = index into nodes slice
		for i := range nodes {
			nodeByID[nodes[i].ID] = i
		}

		// 3. Build undirected adjacency list
		adj := make(map[uuid.UUID][]uuid.UUID)
		for _, e := range edges {
			adj[e.SourceNodeID] = append(adj[e.SourceNodeID], e.TargetNodeID)
			adj[e.TargetNodeID] = append(adj[e.TargetNodeID], e.SourceNodeID)
		}

		// 4. Collect routers; ensure each has a gateway IP
		var routers []int // indices into nodes slice
		for i := range nodes {
			if nodes[i].Type == "router" {
				if nodes[i].IP == "" {
					nodes[i].IP = "192.168.1.1"
				}
				routers = append(routers, i)
			}
		}
		if len(routers) == 0 {
			return errors.New("no router found to establish gateway")
		}

		// 5. Reset IPs for all non-router, networkable nodes
		for i := range nodes {
			if nodes[i].Type == "router" {
				continue
			}
			if !NON_NETWORK_TYPES[nodes[i].Type] {
				nodes[i].IP = ""
			}
			for j := range nodes[i].VirtualMachines {
				nodes[i].VirtualMachines[j].IP = ""
			}
		}

		// 6. BFS from each router — assign IPs from that router's subnet
		//    Each router's subnet is derived from its own gateway IP.
		//    Two routers with different IPs produce two independent address spaces.
		//    Routers in the SAME /24 subnet share a usedOffsets map so devices
		//    connected to different routers but in the same block don't collide.
		type subnetKey = string
		sharedOffsets := make(map[subnetKey]map[int]bool)

		visited := make(map[uuid.UUID]bool)
		for _, ri := range routers {
			router := &nodes[ri]
			visited[router.ID] = true
			gateway := router.IP
			prefix := subnetPrefix(gateway)

			// Initialize or extend the shared offset map for this subnet
			if sharedOffsets[prefix] == nil {
				sharedOffsets[prefix] = map[int]bool{parseLastOctet(gateway): true}
			} else {
				sharedOffsets[prefix][parseLastOctet(gateway)] = true
			}
			usedOffsets := sharedOffsets[prefix]

			// Track used last-octets within this router's /24 subnet

			// BFS
			queue := []uuid.UUID{router.ID}
			for len(queue) > 0 {
				cur := queue[0]
				queue = queue[1:]

				for _, neighborID := range adj[cur] {
					if visited[neighborID] {
						continue
					}
					visited[neighborID] = true
					idx, ok := nodeByID[neighborID]
					if !ok {
						continue
					}
					n := &nodes[idx]
					queue = append(queue, neighborID)

					if NON_NETWORK_TYPES[n.Type] || n.Type == "router" {
						continue
					}

					// Assign node IP from this router's subnet
					ip := assignIPInSubnet(n.Type, gateway, usedOffsets)
					if ip != "" {
						n.IP = ip
						zone := getZone(n.Type)
						base := parseLastOctet(ip)
						// Reserve only the host's own offset first so that VMs can
						// claim the remaining slots within the block before it is sealed.
						usedOffsets[base] = true

						// Assign VM IPs within the host's block while slots remain open
						for j := range n.VirtualMachines {
							vmIP := assignVMIPInSubnet(n, usedOffsets)
							if vmIP != "" {
								n.VirtualMachines[j].IP = vmIP
								usedOffsets[parseLastOctet(vmIP)] = true
							}
						}

						// Seal the full block so future nodes don't land in this range
						for k := 1; k < zone.Step; k++ {
							usedOffsets[base+k] = true
						}
					}
				}
			}
		}

		// 7. Persist all nodes and their VMs
		for i := range nodes {
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

// ─── Helpers ────────────────────────────────────────────────────────────────

func getZone(hwType string) ZoneConfig {
	if z, ok := ROLE_ZONE[hwType]; ok {
		return z
	}
	return FALLBACK_ZONE
}

// subnetPrefix returns the first three octets of an IP, e.g. "192.168.1"
func subnetPrefix(ip string) string {
	parts := strings.Split(ip, ".")
	if len(parts) >= 3 {
		return strings.Join(parts[0:3], ".")
	}
	return "192.168.1"
}

// assignIPInSubnet finds the next free offset for hwType within the given
// gateway's /24 subnet, skipping offsets already in usedOffsets.
func assignIPInSubnet(hwType string, gateway string, usedOffsets map[int]bool) string {
	if NON_NETWORK_TYPES[hwType] {
		return ""
	}
	prefix := subnetPrefix(gateway)
	zone := getZone(hwType)

	for offset := zone.Base; offset < 250; offset++ {
		blockFree := true
		for k := 0; k < zone.Step; k++ {
			if usedOffsets[offset+k] {
				blockFree = false
				break
			}
		}
		if blockFree {
			return fmt.Sprintf("%s.%d", prefix, offset)
		}
	}
	return ""
}

// assignVMIPInSubnet assigns the next free IP after the host node's block
// within the same subnet, for a VM/container.
func assignVMIPInSubnet(host *models.Node, usedOffsets map[int]bool) string {
	if host.IP == "" {
		return ""
	}
	prefix := subnetPrefix(host.IP)
	hostOctet := parseLastOctet(host.IP)
	if hostOctet == -1 {
		return ""
	}
	zone := getZone(host.Type)
	// VMs live immediately after the host's reserved block
	for i := 1; i < zone.Step; i++ {
		candidate := hostOctet + i
		if !usedOffsets[candidate] {
			return fmt.Sprintf("%s.%d", prefix, candidate)
		}
	}
	return ""
}

func parseLastOctet(ip string) int {
	parts := strings.Split(ip, ".")
	if len(parts) != 4 {
		return -1
	}
	val, err := strconv.Atoi(parts[3])
	if err != nil {
		return -1
	}
	return val
}
