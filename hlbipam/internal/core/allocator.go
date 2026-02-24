package core

import (
	"fmt"

	"github.com/Butterski/hlbipam/internal/models"
	"github.com/Butterski/hlbipam/internal/utils"
)

// Allocate performs topology-aware IP assignment across one or more subnets.
//
// Algorithm overview:
//  1. Index all nodes by ID for O(1) lookup.
//  2. Build an undirected adjacency list from node connections.
//  3. For each router, create a SubnetAllocator and pre-reserve any existing IPs.
//  4. BFS from each router to discover reachable nodes in that subnet.
//  5. Assign IPs to unaddressed nodes using role-zone offsets.
//  6. Assign VM IPs within the host's allocated block.
//
// The entire operation is allocation-light: the adjacency list, BFS queue, and
// visited set are pre-allocated to capacity. The SubnetAllocator uses a [256]bool
// bitmap — no maps, no hash overhead per lookup.
func Allocate(req models.AllocateRequest) models.AllocateResponse {
	resp := models.AllocateResponse{
		Conflicts: make([]models.Issue, 0),
		Warnings:  make([]models.Issue, 0),
	}

	// Merge user-provided zone overrides with defaults
	zones := mergeZones(req.CustomZones)

	totalNodes := len(req.Nodes)

	// ── 1. Index nodes by ID ────────────────────────────────────────────────
	type nodeEntry struct {
		dto *models.NodeDTO
		idx int
	}
	nodeIndex := make(map[string]nodeEntry, totalNodes)
	for i := range req.Nodes {
		nodeIndex[req.Nodes[i].ID] = nodeEntry{dto: &req.Nodes[i], idx: i}
	}

	// ── 2. Build undirected adjacency list ──────────────────────────────────
	adj := make(map[string][]string, totalNodes)
	for i := range req.Nodes {
		n := &req.Nodes[i]
		for _, connID := range n.Connections {
			adj[n.ID] = append(adj[n.ID], connID)
			adj[connID] = append(adj[connID], n.ID)
		}
	}
	for i := range req.Routers {
		_ = adj[req.Routers[i].ID]
	}

	// ── 3. Normalise routers ────────────────────────────────────────────────
	routerSubnet := make(map[string]int, len(req.Routers))
	defaultSubnetCounter := 1
	for i := range req.Routers {
		r := &req.Routers[i]
		if r.GatewayIP == "" {
			r.GatewayIP = fmt.Sprintf("192.168.%d.1", defaultSubnetCounter)
			defaultSubnetCounter++
		}
		if r.Subnet == "" {
			r.Subnet = utils.SubnetPrefix(r.GatewayIP) + ".0/24"
		}
		routerSubnet[r.ID] = i
	}

	// ── 4. Pre-reserve existing IPs per subnet ─────────────────────────────
	type preReserve struct {
		prefix string
		octet  int
	}
	var preReserves []preReserve
	for i := range req.Nodes {
		n := &req.Nodes[i]
		if n.ExistingIP != "" && utils.IsValidIPv4(n.ExistingIP) {
			preReserves = append(preReserves, preReserve{
				prefix: utils.SubnetPrefix(n.ExistingIP),
				octet:  utils.ParseLastOctet(n.ExistingIP),
			})
		}
		for j := range n.VMs {
			vm := &n.VMs[j]
			if vm.ExistingIP != "" && utils.IsValidIPv4(vm.ExistingIP) {
				preReserves = append(preReserves, preReserve{
					prefix: utils.SubnetPrefix(vm.ExistingIP),
					octet:  utils.ParseLastOctet(vm.ExistingIP),
				})
			}
		}
	}

	// ── 5. BFS from each router ─────────────────────────────────────────────
	visited := make(map[string]bool, totalNodes+len(req.Routers))

	results := make([]models.NodeResult, totalNodes)
	for i := range req.Nodes {
		results[i] = models.NodeResult{
			ID:   req.Nodes[i].ID,
			Type: req.Nodes[i].Type,
			VMs:  make([]models.VMResult, len(req.Nodes[i].VMs)),
		}
		for j := range req.Nodes[i].VMs {
			results[i].VMs[j].ID = req.Nodes[i].VMs[j].ID
		}
	}

	routerResults := make([]models.RouterResult, len(req.Routers))
	for i := range req.Routers {
		routerResults[i] = models.RouterResult{
			ID:        req.Routers[i].ID,
			GatewayIP: req.Routers[i].GatewayIP,
			Subnet:    req.Routers[i].Subnet,
		}
	}

	for ri := range req.Routers {
		r := &req.Routers[ri]
		if visited[r.ID] {
			continue
		}
		visited[r.ID] = true

		dhcpStart, dhcpEnd := 0, 0
		if r.DHCPEnabled {
			dhcpStart = DefaultDHCPStart
			dhcpEnd = DefaultDHCPEnd
		}

		sa := NewSubnetAllocator(r.GatewayIP, zones, dhcpStart, dhcpEnd)

		// Seed existing IPs that belong to this subnet
		for _, pr := range preReserves {
			if pr.prefix == sa.Prefix {
				sa.Reserve(pr.octet)
			}
		}

		// BFS — pre-allocate queue
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

				if _, isRouter := routerSubnet[neighborID]; isRouter {
					queue = append(queue, neighborID)
					continue
				}

				entry, ok := nodeIndex[neighborID]
				if !ok {
					queue = append(queue, neighborID)
					continue
				}
				n := entry.dto
				res := &results[entry.idx]
				queue = append(queue, neighborID)

				if NonNetworkTypes[n.Type] {
					continue
				}

				// ── Assign node IP ──
				if n.ExistingIP != "" && utils.IsValidIPv4(n.ExistingIP) {
					res.AssignedIP = n.ExistingIP
				} else {
					zone := GetZone(n.Type, zones)
					blockStart := sa.AllocateBlock(zone.BaseOffset, zone.Step)
					if blockStart < 0 {
						resp.Warnings = append(resp.Warnings, models.Issue{
							NodeID:  n.ID,
							Message: fmt.Sprintf("subnet %s.0/24 exhausted for type %q (zone base=%d)", sa.Prefix, n.Type, zone.BaseOffset),
						})
						continue
					}
					res.AssignedIP = sa.FormatIP(blockStart)
					sa.Reserve(blockStart)

					// ── Assign VM IPs within the host block ──
					if zone.CanHostVMs && len(n.VMs) > 0 {
						vmSlot := 1
						for j := range n.VMs {
							vm := &n.VMs[j]
							if vm.ExistingIP != "" && utils.IsValidIPv4(vm.ExistingIP) {
								res.VMs[j].AssignedIP = vm.ExistingIP
								continue
							}
							assigned := false
							for ; vmSlot < zone.Step; vmSlot++ {
								candidate := blockStart + vmSlot
								if sa.IsAvailable(candidate) {
									res.VMs[j].AssignedIP = sa.FormatIP(candidate)
									sa.Reserve(candidate)
									vmSlot++
									assigned = true
									break
								}
							}
							if !assigned {
								resp.Warnings = append(resp.Warnings, models.Issue{
									NodeID:  vm.ID,
									Message: fmt.Sprintf("no free VM slot in block %d–%d for host %s", blockStart, blockStart+zone.Step-1, n.ID),
								})
							}
						}
					}

					// Seal the rest of the block
					sa.ReserveBlock(blockStart, zone.Step)
				}
			}
		}
	}

	resp.Routers = routerResults
	resp.Nodes = results
	return resp
}

// mergeZones applies user overrides on top of DefaultDeviceZones.
func mergeZones(overrides map[string]models.ZoneOverride) map[string]ZoneConfig {
	zones := make(map[string]ZoneConfig, len(DefaultDeviceZones)+len(overrides))
	for k, v := range DefaultDeviceZones {
		zones[k] = v
	}
	for k, v := range overrides {
		zones[k] = ZoneConfig{
			BaseOffset: v.BaseOffset,
			Step:       v.Step,
			CanHostVMs: v.CanHostVMs,
			Label:      k,
		}
	}
	return zones
}
