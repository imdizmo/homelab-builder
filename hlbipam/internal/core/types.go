package core

// ZoneConfig defines the IP offset range for a device type within a /24 subnet.
type ZoneConfig struct {
	BaseOffset int    `json:"base_offset"`
	Step       int    `json:"step"`
	CanHostVMs bool   `json:"can_host_vms"`
	Label      string `json:"label"`
}

// DefaultDeviceZones are the built-in role-based IP zones.
// Users can override these per-request via the allocate payload.
var DefaultDeviceZones = map[string]ZoneConfig{
	"router":       {BaseOffset: 1, Step: 1, CanHostVMs: false, Label: "Router"},
	"switch":       {BaseOffset: 10, Step: 1, CanHostVMs: false, Label: "Switch"},
	"access_point": {BaseOffset: 20, Step: 1, CanHostVMs: false, Label: "AP"},
	"ups":          {BaseOffset: 80, Step: 1, CanHostVMs: false, Label: "UPS"},
	"pdu":          {BaseOffset: 85, Step: 1, CanHostVMs: false, Label: "PDU"},
	"disk":         {BaseOffset: 90, Step: 1, CanHostVMs: false, Label: "Disk"},
	"nas":          {BaseOffset: 100, Step: 10, CanHostVMs: true, Label: "NAS"},
	"server":       {BaseOffset: 150, Step: 10, CanHostVMs: true, Label: "Server"},
	"pc":           {BaseOffset: 160, Step: 10, CanHostVMs: true, Label: "PC"},
	"minipc":       {BaseOffset: 170, Step: 10, CanHostVMs: true, Label: "Mini PC"},
	"sbc":          {BaseOffset: 180, Step: 10, CanHostVMs: true, Label: "SBC"},
	"gpu":          {BaseOffset: 190, Step: 1, CanHostVMs: false, Label: "GPU"},
	"hba":          {BaseOffset: 195, Step: 1, CanHostVMs: false, Label: "HBA"},
	"pcie":         {BaseOffset: 198, Step: 1, CanHostVMs: false, Label: "PCIe"},
}

var FallbackZone = ZoneConfig{BaseOffset: 200, Step: 1, CanHostVMs: false, Label: "Device"}

// NonNetworkTypes are device types that don't receive an IP address.
var NonNetworkTypes = map[string]bool{
	"disk": true, "gpu": true, "hba": true, "pcie": true, "pdu": true, "ups": true,
}

// DefaultDHCPRange defines the DHCP pool that should be excluded from static allocation.
var DefaultDHCPStart = 30
var DefaultDHCPEnd = 99

// GetZone returns the zone config for a device type, falling back to FallbackZone.
func GetZone(deviceType string, zones map[string]ZoneConfig) ZoneConfig {
	if zones != nil {
		if z, ok := zones[deviceType]; ok {
			return z
		}
	}
	if z, ok := DefaultDeviceZones[deviceType]; ok {
		return z
	}
	return FallbackZone
}
