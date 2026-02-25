package core

import (
	"github.com/Butterski/hlbipam/internal/utils"
)

// SubnetAllocator tracks IP allocation within a single /24 subnet.
// It uses a fixed-size [256]bool bitmap for O(1) reserve/check operations
// with zero heap allocations per lookup.
type SubnetAllocator struct {
	Prefix    string                // e.g. "192.168.1"
	Gateway   int                   // last octet of the gateway, e.g. 1
	Used      [256]bool             // bitmap: Used[offset] = true means occupied
	DHCPStart int                   // start of DHCP exclusion range (inclusive)
	DHCPEnd   int                   // end of DHCP exclusion range (inclusive)
	Zones     map[string]ZoneConfig // device-type zones (may include user overrides)
}

// NewSubnetAllocator creates an allocator for the given gateway IP.
// It pre-reserves the gateway, network (.0), and broadcast (.255) addresses,
// plus the DHCP exclusion range.
func NewSubnetAllocator(gatewayIP string, zones map[string]ZoneConfig, dhcpStart, dhcpEnd int) *SubnetAllocator {
	prefix := utils.SubnetPrefix(gatewayIP)
	gwOctet := utils.ParseLastOctet(gatewayIP)
	if gwOctet < 0 {
		gwOctet = 1
	}

	sa := &SubnetAllocator{
		Prefix:    prefix,
		Gateway:   gwOctet,
		DHCPStart: dhcpStart,
		DHCPEnd:   dhcpEnd,
		Zones:     zones,
	}

	// Reserve network, broadcast, and gateway
	sa.Used[0] = true
	sa.Used[255] = true
	sa.Used[gwOctet] = true

	// Reserve the DHCP exclusion range
	if dhcpStart > 0 && dhcpEnd > 0 {
		for i := dhcpStart; i <= dhcpEnd && i < 255; i++ {
			sa.Used[i] = true
		}
	}

	return sa
}

// Reserve marks an offset as occupied. Returns false if already taken.
func (sa *SubnetAllocator) Reserve(offset int) bool {
	if offset < 0 || offset > 255 || sa.Used[offset] {
		return false
	}
	sa.Used[offset] = true
	return true
}

// IsAvailable checks whether an offset is free.
func (sa *SubnetAllocator) IsAvailable(offset int) bool {
	return offset >= 0 && offset <= 255 && !sa.Used[offset]
}

// AllocateBlock finds the first free contiguous block of `step` offsets
// starting from `baseOffset`, scanning up to octet 254.
// Returns the starting offset of the found block, or -1 if exhausted.
func (sa *SubnetAllocator) AllocateBlock(baseOffset, step int) int {
	for offset := baseOffset; offset+step-1 < 255; offset++ {
		free := true
		for k := 0; k < step; k++ {
			if sa.Used[offset+k] {
				free = false
				break
			}
		}
		if free {
			return offset
		}
	}
	return -1
}

// ReserveBlock marks a contiguous block of offsets as used.
func (sa *SubnetAllocator) ReserveBlock(start, step int) {
	for k := 0; k < step && start+k < 256; k++ {
		sa.Used[start+k] = true
	}
}

// AllocateSlot finds the first single free offset starting from baseOffset.
// Unlike AllocateBlock, it does NOT require a contiguous block of `step` offsets.
// Returns the offset, or -1 if the subnet is exhausted.
func (sa *SubnetAllocator) AllocateSlot(baseOffset int) int {
	for offset := baseOffset; offset < 255; offset++ {
		if !sa.Used[offset] {
			return offset
		}
	}
	return -1
}

// FormatIP combines this allocator's prefix with an offset into "x.x.x.offset".
func (sa *SubnetAllocator) FormatIP(offset int) string {
	return utils.FormatIP(sa.Prefix, offset)
}
