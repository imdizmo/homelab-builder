package core

import (
	"fmt"

	"github.com/Butterski/hlbipam/internal/models"
	"github.com/Butterski/hlbipam/internal/utils"
)

// Validate checks an existing (partially or fully assigned) topology for
// correctness without modifying any IPs.
func Validate(req models.AllocateRequest) models.ValidateResponse {
	resp := models.ValidateResponse{
		Valid:    true,
		Errors:   make([]models.Issue, 0),
		Warnings: make([]models.Issue, 0),
	}

	zones := mergeZones(req.CustomZones)
	totalNodes := len(req.Nodes)

	type nodeEntry struct {
		dto *models.NodeDTO
		idx int
	}
	nodeIndex := make(map[string]nodeEntry, totalNodes)
	for i := range req.Nodes {
		nodeIndex[req.Nodes[i].ID] = nodeEntry{dto: &req.Nodes[i], idx: i}
	}

	adj := make(map[string][]string, totalNodes)
	for i := range req.Nodes {
		n := &req.Nodes[i]
		for _, connID := range n.Connections {
			adj[n.ID] = append(adj[n.ID], connID)
			adj[connID] = append(adj[connID], n.ID)
		}
	}

	routerSubnet := make(map[string]int, len(req.Routers))
	for i := range req.Routers {
		r := &req.Routers[i]
		if r.GatewayIP == "" {
			r.GatewayIP = fmt.Sprintf("192.168.%d.1", i+1)
		}
		routerSubnet[r.ID] = i
	}

	// Global duplicate tracker: ip → ownerNodeID
	globalIPs := make(map[string]string, totalNodes*2)

	for i := range req.Routers {
		r := &req.Routers[i]
		if r.GatewayIP != "" {
			if owner, exists := globalIPs[r.GatewayIP]; exists {
				addError(&resp, r.ID, fmt.Sprintf("gateway IP %s conflicts with %s", r.GatewayIP, owner))
			} else {
				globalIPs[r.GatewayIP] = r.ID
			}
		}
	}

	visited := make(map[string]bool, totalNodes+len(req.Routers))

	for ri := range req.Routers {
		r := &req.Routers[ri]
		if visited[r.ID] {
			continue
		}
		visited[r.ID] = true

		prefix := utils.SubnetPrefix(r.GatewayIP)
		dhcpStart, dhcpEnd := 0, 0
		if r.DHCPEnabled {
			dhcpStart = DefaultDHCPStart
			dhcpEnd = DefaultDHCPEnd
		}

		queue := make([]string, 0, totalNodes)
		queue = append(queue, r.ID)

		for len(queue) > 0 {
			cur := queue[0]
			queue = queue[1:]

			for _, neighborID := range adj[cur] {
				if visited[neighborID] {
					continue
				}
				visited[neighborID] = true
				queue = append(queue, neighborID)

				if _, isRouter := routerSubnet[neighborID]; isRouter {
					continue
				}

				entry, ok := nodeIndex[neighborID]
				if !ok {
					continue
				}
				n := entry.dto

				if NonNetworkTypes[n.Type] {
					continue
				}

				ip := n.ExistingIP
				if ip == "" {
					continue
				}

				if !utils.IsValidIPv4(ip) {
					addError(&resp, n.ID, fmt.Sprintf("invalid IPv4 address: %s", ip))
					continue
				}

				if utils.SubnetPrefix(ip) != prefix {
					addError(&resp, n.ID, fmt.Sprintf("IP %s is outside subnet %s.0/24 (reachable from router %s)", ip, prefix, r.ID))
				}

				zone := GetZone(n.Type, zones)
				octet := utils.ParseLastOctet(ip)
				if octet >= 0 && (octet < zone.BaseOffset || octet >= zone.BaseOffset+zone.Step*10) {
					resp.Warnings = append(resp.Warnings, models.Issue{
						NodeID:  n.ID,
						Message: fmt.Sprintf("IP %s (octet .%d) is outside recommended zone for %s (expected .%d+)", ip, octet, n.Type, zone.BaseOffset),
					})
				}

				if dhcpStart > 0 && octet >= dhcpStart && octet <= dhcpEnd {
					addError(&resp, n.ID, fmt.Sprintf("IP %s falls within DHCP range .%d–.%d; use a static address outside this range", ip, dhcpStart, dhcpEnd))
				}

				if owner, exists := globalIPs[ip]; exists {
					addError(&resp, n.ID, fmt.Sprintf("IP %s conflicts with %s", ip, owner))
				} else {
					globalIPs[ip] = n.ID
				}

				for j := range n.VMs {
					vm := &n.VMs[j]
					vmIP := vm.ExistingIP
					if vmIP == "" {
						continue
					}
					if !utils.IsValidIPv4(vmIP) {
						addError(&resp, vm.ID, fmt.Sprintf("invalid IPv4 address: %s", vmIP))
						continue
					}
					if utils.SubnetPrefix(vmIP) != prefix {
						addError(&resp, vm.ID, fmt.Sprintf("VM IP %s is outside subnet %s.0/24", vmIP, prefix))
					}
					if dhcpStart > 0 {
						vmOctet := utils.ParseLastOctet(vmIP)
						if vmOctet >= dhcpStart && vmOctet <= dhcpEnd {
							addError(&resp, vm.ID, fmt.Sprintf("VM IP %s falls within DHCP range .%d–.%d", vmIP, dhcpStart, dhcpEnd))
						}
					}
					if owner, exists := globalIPs[vmIP]; exists {
						addError(&resp, vm.ID, fmt.Sprintf("VM IP %s conflicts with %s", vmIP, owner))
					} else {
						globalIPs[vmIP] = vm.ID
					}
				}
			}
		}
	}

	return resp
}

func addError(resp *models.ValidateResponse, nodeID, message string) {
	resp.Valid = false
	resp.Errors = append(resp.Errors, models.Issue{NodeID: nodeID, Message: message})
}
