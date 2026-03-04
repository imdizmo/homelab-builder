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
//  5. Assign infrastructure devices (switch, AP, UPS…) to their fixed low zones.
//  6. Group VM-hosting devices by type and lay out zones sequentially
//     (in VMHostTypeOrder) starting from VMHostStartOffset. Each zone gets
//     exactly deviceCount × dynamicStep addresses.
//  7. Assign VM IPs within the host's allocated block.
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

	isRouter := make(map[string]bool, len(req.Routers))
	for i := range req.Routers {
		isRouter[req.Routers[i].ID] = true
	}

	for i := range req.Nodes {
		n := &req.Nodes[i]
		adj[n.ID] = n.Connections

		for _, neighbor := range n.Connections {
			if isRouter[neighbor] {
				adj[neighbor] = append(adj[neighbor], n.ID)
			}
		}
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

	// ── 5. Init results ─────────────────────────────────────────────────────
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

	// ── 6. BFS per router ───────────────────────────────────────────────────
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

		// Pre-pass: count VM-hosting devices for dynamic pool sizing
		vmHostCount := 0
		for i := range req.Nodes {
			n := &req.Nodes[i]
			if NonNetworkTypes[n.Type] {
				continue
			}
			zone := GetZone(n.Type, zones)
			if zone.CanHostVMs {
				vmHostCount++
			}
		}
		dhcpSize := 0
		if r.DHCPEnabled {
			dhcpSize = DefaultDHCPEnd - DefaultDHCPStart + 1
		}
		dynamicStep := CalculateDynamicStep(vmHostCount, dhcpSize)

		// Create subnet zones with dynamic steps for VM hosts
		subnetZones := make(map[string]ZoneConfig)
		for t, z := range DefaultDeviceZones {
			subnetZones[t] = z
		}
		for t, z := range zones {
			subnetZones[t] = z
		}
		for t, z := range subnetZones {
			if z.CanHostVMs {
				z.Step = dynamicStep
				subnetZones[t] = z
			}
		}

		sa := NewSubnetAllocator(r.GatewayIP, subnetZones, dhcpStart, dhcpEnd)

		// Seed existing IPs
		for _, pr := range preReserves {
			if pr.prefix == sa.Prefix {
				sa.Reserve(pr.octet)
			}
		}

		// ── BFS: discover reachable nodes, split into infra vs VM-hosts ──
		type pendingNode struct {
			entry nodeEntry
			dto   *models.NodeDTO
		}
		var infraNodes []pendingNode
		// Group VM hosts by type (preserving BFS discovery order within each type)
		vmHostsByType := make(map[string][]pendingNode)

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

				if _, isRtr := routerSubnet[neighborID]; isRtr {
					queue = append(queue, neighborID)
					continue
				}

				entry, ok := nodeIndex[neighborID]
				if !ok {
					queue = append(queue, neighborID)
					continue
				}
				n := entry.dto
				queue = append(queue, neighborID)

				if NonNetworkTypes[n.Type] {
					continue
				}

				zone := GetZone(n.Type, sa.Zones)
				pn := pendingNode{entry: entry, dto: n}
				if zone.CanHostVMs {
					vmHostsByType[n.Type] = append(vmHostsByType[n.Type], pn)
				} else {
					infraNodes = append(infraNodes, pn)
				}
			}
		}

		// ── Phase 1: Assign infrastructure devices to fixed zones ──
		for _, pn := range infraNodes {
			n := pn.dto
			res := &results[pn.entry.idx]
			zone := GetZone(n.Type, sa.Zones)

			if n.ExistingIP != "" && utils.IsValidIPv4(n.ExistingIP) {
				res.AssignedIP = n.ExistingIP
				sa.Reserve(utils.ParseLastOctet(n.ExistingIP))
			} else {
				offset := sa.AllocateSlot(zone.BaseOffset)
				if offset < 0 {
					resp.Warnings = append(resp.Warnings, models.Issue{
						NodeID:  n.ID,
						Message: fmt.Sprintf("subnet %s.0/24 exhausted for infra type %q", sa.Prefix, n.Type),
					})
					continue
				}
				res.AssignedIP = sa.FormatIP(offset)
				sa.Reserve(offset)
			}
		}

		// ── Phase 2: Lay out VM-host zones by type order ──
		// Each type gets a contiguous zone: [zoneStart .. zoneStart + deviceCount*step)
		nextZoneStart := VMHostStartOffset
		// Skip past DHCP range if it overlaps
		if r.DHCPEnabled && nextZoneStart >= dhcpStart && nextZoneStart <= dhcpEnd {
			nextZoneStart = dhcpEnd + 1
		}

		for _, typeName := range VMHostTypeOrder {
			hosts, exists := vmHostsByType[typeName]
			if !exists || len(hosts) == 0 {
				continue
			}

			zone := GetZone(typeName, sa.Zones)
			zoneStart := nextZoneStart

			for _, pn := range hosts {
				n := pn.dto
				res := &results[pn.entry.idx]

				var hostOffset int

				if n.ExistingIP != "" && utils.IsValidIPv4(n.ExistingIP) {
					res.AssignedIP = n.ExistingIP
					hostOffset = utils.ParseLastOctet(n.ExistingIP)
					sa.Reserve(hostOffset)
				} else {
					// Allocate next available slot starting from current zone position
					hostOffset = sa.AllocateSlot(nextZoneStart)
					if hostOffset < 0 {
						resp.Warnings = append(resp.Warnings, models.Issue{
							NodeID:  n.ID,
							Message: fmt.Sprintf("subnet %s.0/24 exhausted for VM host type %q", sa.Prefix, n.Type),
						})
						continue
					}
					res.AssignedIP = sa.FormatIP(hostOffset)
					sa.Reserve(hostOffset)
				}

				// Assign VM IPs within the host's pool [hostOffset+1 .. hostOffset+step-1]
				if zone.CanHostVMs && len(n.VMs) > 0 {
					for j := range n.VMs {
						vm := &n.VMs[j]
						if vm.ExistingIP != "" && utils.IsValidIPv4(vm.ExistingIP) {
							res.VMs[j].AssignedIP = vm.ExistingIP
							sa.Reserve(utils.ParseLastOctet(vm.ExistingIP))
							continue
						}
						// Try within the reserved block first
						assigned := false
						for slot := hostOffset + 1; slot < hostOffset+zone.Step && slot < 255; slot++ {
							if sa.IsAvailable(slot) {
								res.VMs[j].AssignedIP = sa.FormatIP(slot)
								sa.Reserve(slot)
								assigned = true
								break
							}
						}
						// Fallback: find any free slot after host
						if !assigned {
							vmOffset := sa.AllocateSlot(hostOffset + 1)
							if vmOffset < 0 {
								resp.Warnings = append(resp.Warnings, models.Issue{
									NodeID:  vm.ID,
									Message: fmt.Sprintf("subnet exhausted, no free slot for VM on host %s", n.ID),
								})
							} else {
								res.VMs[j].AssignedIP = sa.FormatIP(vmOffset)
								sa.Reserve(vmOffset)
							}
						}
					}
				}

				// Reserve the full block so next host in this zone starts after
				sa.ReserveBlock(hostOffset, zone.Step)

				// Advance zone cursor past this host's block
				blockEnd := hostOffset + zone.Step
				if blockEnd > nextZoneStart {
					nextZoneStart = blockEnd
				}
			}

			// If the zone didn't advance (all had existing IPs), ensure we don't overlap
			actualZoneEnd := zoneStart + len(hosts)*zone.Step
			if actualZoneEnd > nextZoneStart {
				nextZoneStart = actualZoneEnd
			}
		}

		// Handle any VM-host types not in VMHostTypeOrder (fallback)
		for typeName, hosts := range vmHostsByType {
			if len(hosts) == 0 {
				continue
			}
			// Skip types already handled
			handled := false
			for _, t := range VMHostTypeOrder {
				if t == typeName {
					handled = true
					break
				}
			}
			if handled {
				continue
			}

			zone := GetZone(typeName, sa.Zones)
			for _, pn := range hosts {
				n := pn.dto
				res := &results[pn.entry.idx]

				var hostOffset int
				if n.ExistingIP != "" && utils.IsValidIPv4(n.ExistingIP) {
					res.AssignedIP = n.ExistingIP
					hostOffset = utils.ParseLastOctet(n.ExistingIP)
					sa.Reserve(hostOffset)
				} else {
					hostOffset = sa.AllocateSlot(nextZoneStart)
					if hostOffset < 0 {
						resp.Warnings = append(resp.Warnings, models.Issue{
							NodeID:  n.ID,
							Message: fmt.Sprintf("subnet %s.0/24 exhausted for VM host type %q", sa.Prefix, n.Type),
						})
						continue
					}
					res.AssignedIP = sa.FormatIP(hostOffset)
					sa.Reserve(hostOffset)
				}

				if zone.CanHostVMs && len(n.VMs) > 0 {
					for j := range n.VMs {
						vm := &n.VMs[j]
						if vm.ExistingIP != "" && utils.IsValidIPv4(vm.ExistingIP) {
							res.VMs[j].AssignedIP = vm.ExistingIP
							sa.Reserve(utils.ParseLastOctet(vm.ExistingIP))
							continue
						}
						assigned := false
						for slot := hostOffset + 1; slot < hostOffset+zone.Step && slot < 255; slot++ {
							if sa.IsAvailable(slot) {
								res.VMs[j].AssignedIP = sa.FormatIP(slot)
								sa.Reserve(slot)
								assigned = true
								break
							}
						}
						if !assigned {
							vmOffset := sa.AllocateSlot(hostOffset + 1)
							if vmOffset < 0 {
								resp.Warnings = append(resp.Warnings, models.Issue{
									NodeID:  vm.ID,
									Message: fmt.Sprintf("subnet exhausted, no free slot for VM on host %s", n.ID),
								})
							} else {
								res.VMs[j].AssignedIP = sa.FormatIP(vmOffset)
								sa.Reserve(vmOffset)
							}
						}
					}
				}

				sa.ReserveBlock(hostOffset, zone.Step)
				blockEnd := hostOffset + zone.Step
				if blockEnd > nextZoneStart {
					nextZoneStart = blockEnd
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
