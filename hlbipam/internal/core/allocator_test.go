package core

import (
	"testing"

	"github.com/Butterski/hlbipam/internal/models"
)

func TestAllocate_SingleRouterLinearTopology(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1", Subnet: "192.168.1.0/24"},
		},
		Nodes: []models.NodeDTO{
			{ID: "sw1", Type: "switch", Connections: []string{"r1"}},
			{ID: "srv1", Type: "server", Connections: []string{"sw1"},
				VMs: []models.VMDTO{{ID: "vm1"}, {ID: "vm2"}}},
			{ID: "pc1", Type: "pc", Connections: []string{"sw1"}},
		},
	}

	resp := Allocate(req)

	assertIP(t, resp, "sw1", "192.168.1.10")
	assertIP(t, resp, "srv1", "192.168.1.150")
	assertIP(t, resp, "pc1", "192.168.1.160")

	vmIPs := findVMIPs(resp, "srv1")
	if len(vmIPs) != 2 {
		t.Fatalf("expected 2 VM IPs, got %d", len(vmIPs))
	}
	if vmIPs[0] != "192.168.1.151" {
		t.Errorf("vm1 expected .151, got %s", vmIPs[0])
	}
	if vmIPs[1] != "192.168.1.152" {
		t.Errorf("vm2 expected .152, got %s", vmIPs[1])
	}

	if len(resp.Conflicts) != 0 {
		t.Errorf("unexpected conflicts: %v", resp.Conflicts)
	}
}

func TestAllocate_ExistingIPsPreserved(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1"},
		},
		Nodes: []models.NodeDTO{
			{ID: "sw1", Type: "switch", Connections: []string{"r1"}, ExistingIP: "192.168.1.15"},
			{ID: "srv1", Type: "server", Connections: []string{"sw1"}},
		},
	}

	resp := Allocate(req)
	assertIP(t, resp, "sw1", "192.168.1.15")
	assertIP(t, resp, "srv1", "192.168.1.150")
}

func TestAllocate_MultipleRoutersMultipleSubnets(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1"},
			{ID: "r2", GatewayIP: "10.0.0.1"},
		},
		Nodes: []models.NodeDTO{
			{ID: "sw1", Type: "switch", Connections: []string{"r1"}},
			{ID: "sw2", Type: "switch", Connections: []string{"r2"}},
		},
	}

	resp := Allocate(req)

	ip1 := findNodeIP(resp, "sw1")
	ip2 := findNodeIP(resp, "sw2")

	if ip1 != "192.168.1.10" {
		t.Errorf("sw1 expected 192.168.1.10, got %s", ip1)
	}
	if ip2 != "10.0.0.10" {
		t.Errorf("sw2 expected 10.0.0.10, got %s", ip2)
	}
}

func TestAllocate_DHCPExclusionRange(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1", DHCPEnabled: true},
		},
		Nodes: []models.NodeDTO{
			{ID: "ap1", Type: "access_point", Connections: []string{"r1"}},
			{ID: "nas1", Type: "nas", Connections: []string{"r1"}},
		},
	}

	resp := Allocate(req)

	if findNodeIP(resp, "ap1") != "192.168.1.20" {
		t.Errorf("ap1 expected .20, got %s", findNodeIP(resp, "ap1"))
	}
	if findNodeIP(resp, "nas1") != "192.168.1.100" {
		t.Errorf("nas1 expected .100, got %s", findNodeIP(resp, "nas1"))
	}
}

func TestAllocate_MultipleServersGetSeparateBlocks(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1"},
		},
		Nodes: []models.NodeDTO{
			{ID: "sw1", Type: "switch", Connections: []string{"r1"}},
			{ID: "srv1", Type: "server", Connections: []string{"sw1"},
				VMs: []models.VMDTO{{ID: "vm1"}}},
			{ID: "srv2", Type: "server", Connections: []string{"sw1"},
				VMs: []models.VMDTO{{ID: "vm2"}}},
		},
	}

	resp := Allocate(req)
	ip1 := findNodeIP(resp, "srv1")
	ip2 := findNodeIP(resp, "srv2")

	if ip1 == ip2 {
		t.Fatalf("two servers got same IP: %s", ip1)
	}
	if ip1 == "" || ip2 == "" {
		t.Fatalf("servers must have IPs: srv1=%s, srv2=%s", ip1, ip2)
	}
}

func TestAllocate_NonNetworkTypesSkipped(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{
			{ID: "r1", GatewayIP: "192.168.1.1"},
		},
		Nodes: []models.NodeDTO{
			{ID: "gpu1", Type: "gpu", Connections: []string{"r1"}},
			{ID: "hba1", Type: "hba", Connections: []string{"r1"}},
		},
	}

	resp := Allocate(req)
	for _, n := range resp.Nodes {
		if n.AssignedIP != "" {
			t.Errorf("non-network device %s should not have IP, got %s", n.ID, n.AssignedIP)
		}
	}
}

func TestAllocate_DefaultGatewayAssigned(t *testing.T) {
	req := models.AllocateRequest{
		Routers: []models.RouterDTO{{ID: "r1"}},
		Nodes: []models.NodeDTO{
			{ID: "sw1", Type: "switch", Connections: []string{"r1"}},
		},
	}

	resp := Allocate(req)

	if resp.Routers[0].GatewayIP != "192.168.1.1" {
		t.Errorf("expected default gateway 192.168.1.1, got %s", resp.Routers[0].GatewayIP)
	}
	assertIP(t, resp, "sw1", "192.168.1.10")
}

// ── Helpers ──

func assertIP(t *testing.T, resp models.AllocateResponse, nodeID, expectedIP string) {
	t.Helper()
	ip := findNodeIP(resp, nodeID)
	if ip != expectedIP {
		t.Errorf("node %s: expected IP %s, got %s", nodeID, expectedIP, ip)
	}
}

func findNodeIP(resp models.AllocateResponse, nodeID string) string {
	for _, n := range resp.Nodes {
		if n.ID == nodeID {
			return n.AssignedIP
		}
	}
	return ""
}

func findVMIPs(resp models.AllocateResponse, hostID string) []string {
	for _, n := range resp.Nodes {
		if n.ID == hostID {
			ips := make([]string, len(n.VMs))
			for i, vm := range n.VMs {
				ips[i] = vm.AssignedIP
			}
			return ips
		}
	}
	return nil
}
