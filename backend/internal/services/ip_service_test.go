package services

import (
	"testing"

	"github.com/Butterski/homelab-builder/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ─── Test helpers ────────────────────────────────────────────────────────────

// createNode inserts a Node into the DB and returns it.
func createNode(t *testing.T, db *gorm.DB, buildID uuid.UUID, hwType, name, ip string) models.Node {
	t.Helper()
	n := models.Node{
		BuildID: buildID,
		Type:    hwType,
		Name:    name,
		IP:      ip,
		Details: "{}",
	}
	if err := db.Create(&n).Error; err != nil {
		t.Fatalf("createNode(%s): %v", name, err)
	}
	return n
}

// connectNodes inserts an Edge between two nodes.
func connectNodes(t *testing.T, db *gorm.DB, buildID, srcID, dstID uuid.UUID) {
	t.Helper()
	e := models.Edge{
		BuildID:      buildID,
		SourceNodeID: srcID,
		TargetNodeID: dstID,
		Type:         "ethernet",
	}
	if err := db.Create(&e).Error; err != nil {
		t.Fatalf("connectNodes: %v", err)
	}
}

// fetchIP reloads a node's IP from the DB.
func fetchIP(t *testing.T, db *gorm.DB, nodeID uuid.UUID) string {
	t.Helper()
	var n models.Node
	if err := db.First(&n, "id = ?", nodeID).Error; err != nil {
		t.Fatalf("fetchIP: %v", err)
	}
	return n.IP
}

// newBuildID creates a minimal user + build inside db and returns the build ID.
// Nodes have a FK to builds.id, so we need a real build row before inserting nodes.
func newBuildID(t *testing.T, db *gorm.DB) uuid.UUID {
	t.Helper()
	user := models.User{Email: uuid.NewString() + "@test.com", Name: "T", GoogleID: uuid.NewString()}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("newBuildID: create user: %v", err)
	}
	build := models.Build{UserID: user.ID, Name: "test", Data: "{}"}
	if err := db.Create(&build).Error; err != nil {
		t.Fatalf("newBuildID: create build: %v", err)
	}
	return build.ID
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// TestCalculateNetwork_NoNodes returns nil without error when there are no nodes.
func TestCalculateNetwork_NoNodes(t *testing.T) {
	svc := NewIPService(testTx(t))
	if err := svc.CalculateNetwork(uuid.New()); err != nil {
		t.Errorf("expected nil error for empty build, got: %v", err)
	}
}

// TestCalculateNetwork_NoRouter_ReturnsError expects an error when the build
// has no router node — regression for the original "no router found" 500 panic.
func TestCalculateNetwork_NoRouter_ReturnsError(t *testing.T) {
	tx := testTx(t)
	svc := NewIPService(tx)
	buildID := newBuildID(t, tx)

	createNode(t, tx, buildID, "server", "Server 1", "")
	createNode(t, tx, buildID, "switch", "Switch 1", "")

	err := svc.CalculateNetwork(buildID)
	if err == nil {
		t.Fatal("expected error 'no router found', got nil")
	}
	if err.Error() != "no router found to establish gateway" {
		t.Errorf("unexpected error: %v", err)
	}
}

// TestCalculateNetwork_RouterWithNoIP_GetsDefault192168 verifies that a router
// with an empty IP is auto-assigned 192.168.1.1 before calculation.
func TestCalculateNetwork_RouterWithNoIP_GetsDefault192168(t *testing.T) {
	tx := testTx(t)
	svc := NewIPService(tx)
	buildID := newBuildID(t, tx)

	router := createNode(t, tx, buildID, "router", "Router", "")

	if err := svc.CalculateNetwork(buildID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ip := fetchIP(t, tx, router.ID); ip != "192.168.1.1" {
		t.Errorf("expected router IP 192.168.1.1, got %q", ip)
	}
}

// TestCalculateNetwork_SingleRouter_ConnectedNodesGetSubnetIPs is the primary
// regression test for the original bug: nodes were not getting IPs.
// Topology: Router(192.168.1.1) — Switch — Server
func TestCalculateNetwork_SingleRouter_ConnectedNodesGetSubnetIPs(t *testing.T) {
	tx := testTx(t)
	svc := NewIPService(tx)
	buildID := newBuildID(t, tx)

	router := createNode(t, tx, buildID, "router", "Router", "192.168.1.1")
	sw := createNode(t, tx, buildID, "switch", "Switch", "")
	server := createNode(t, tx, buildID, "server", "Server", "")

	connectNodes(t, tx, buildID, router.ID, sw.ID)
	connectNodes(t, tx, buildID, sw.ID, server.ID)

	if err := svc.CalculateNetwork(buildID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	swIP := fetchIP(t, tx, sw.ID)
	serverIP := fetchIP(t, tx, server.ID)

	if swIP == "" {
		t.Error("switch should have an IP, got empty")
	}
	if !hasPrefix(swIP, "192.168.1.") {
		t.Errorf("switch IP should be in 192.168.1.x, got %q", swIP)
	}
	if serverIP == "" {
		t.Error("server should have an IP, got empty")
	}
	if !hasPrefix(serverIP, "192.168.1.") {
		t.Errorf("server IP should be in 192.168.1.x, got %q", serverIP)
	}
	if swIP == serverIP {
		t.Errorf("switch and server must not share IP %q", swIP)
	}
	// Specific zone offsets: switch base = 10, server base = 150
	if swIP != "192.168.1.10" {
		t.Errorf("switch expected 192.168.1.10, got %q", swIP)
	}
	if serverIP != "192.168.1.150" {
		t.Errorf("server expected 192.168.1.150, got %q", serverIP)
	}
}

// TestCalculateNetwork_OrphanNodes_GetNoIP verifies that nodes not connected
// to any router remain unassigned (isolated in the graph).
func TestCalculateNetwork_OrphanNodes_GetNoIP(t *testing.T) {
	tx := testTx(t)
	svc := NewIPService(tx)
	buildID := newBuildID(t, tx)

	router := createNode(t, tx, buildID, "router", "Router", "192.168.1.1")
	connected := createNode(t, tx, buildID, "switch", "Connected Switch", "")
	orphan := createNode(t, tx, buildID, "server", "Orphan Server", "")

	// Only connect router ↔ switch; orphan server has no edges
	connectNodes(t, tx, buildID, router.ID, connected.ID)

	if err := svc.CalculateNetwork(buildID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ip := fetchIP(t, tx, connected.ID); ip == "" {
		t.Error("connected switch should have an IP")
	}
	if ip := fetchIP(t, tx, orphan.ID); ip != "" {
		t.Errorf("orphan server should have no IP, got %q", ip)
	}
}

// TestCalculateNetwork_TwoRouters_IndependentSubnets is the core regression
// for the screenshot bug: two routers with different /24s should each assign
// IPs from their own subnet without collision.
// Topology:
//
//	Router A (192.168.0.1) — Switch A
//	Router B (192.168.2.1) — Switch B
func TestCalculateNetwork_TwoRouters_IndependentSubnets(t *testing.T) {
	tx := testTx(t)
	svc := NewIPService(tx)
	buildID := newBuildID(t, tx)

	routerA := createNode(t, tx, buildID, "router", "Router A", "192.168.0.1")
	swA := createNode(t, tx, buildID, "switch", "Switch A", "")
	routerB := createNode(t, tx, buildID, "router", "Router B", "192.168.2.1")
	swB := createNode(t, tx, buildID, "switch", "Switch B", "")

	connectNodes(t, tx, buildID, routerA.ID, swA.ID)
	connectNodes(t, tx, buildID, routerB.ID, swB.ID)

	if err := svc.CalculateNetwork(buildID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ipA := fetchIP(t, tx, swA.ID)
	ipB := fetchIP(t, tx, swB.ID)

	if !hasPrefix(ipA, "192.168.0.") {
		t.Errorf("Switch A should be in 192.168.0.x, got %q", ipA)
	}
	if !hasPrefix(ipB, "192.168.2.") {
		t.Errorf("Switch B should be in 192.168.2.x, got %q", ipB)
	}
	if ipA != "192.168.0.10" {
		t.Errorf("Switch A expected 192.168.0.10, got %q", ipA)
	}
	if ipB != "192.168.2.10" {
		t.Errorf("Switch B expected 192.168.2.10, got %q", ipB)
	}
}

// TestCalculateNetwork_TwoRouters_SameSubnet_NoDuplicateGateway tests the
// reported screenshot scenario: two routers both with 192.168.1.x.
// After reassign, switches connected to each router must get different IPs.
func TestCalculateNetwork_TwoRouters_SameSubnet_NoDuplicateGateway(t *testing.T) {
	tx := testTx(t)
	svc := NewIPService(tx)
	buildID := newBuildID(t, tx)

	routerA := createNode(t, tx, buildID, "router", "Router A", "192.168.1.1")
	routerB := createNode(t, tx, buildID, "router", "Router B", "192.168.1.1")
	swA := createNode(t, tx, buildID, "switch", "Switch A", "")
	swB := createNode(t, tx, buildID, "switch", "Switch B", "")

	connectNodes(t, tx, buildID, routerA.ID, swA.ID)
	connectNodes(t, tx, buildID, routerB.ID, swB.ID)

	if err := svc.CalculateNetwork(buildID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ipA := fetchIP(t, tx, swA.ID)
	ipB := fetchIP(t, tx, swB.ID)

	if ipA == "" {
		t.Error("Switch A should have an IP")
	}
	if ipB == "" {
		t.Error("Switch B should have an IP")
	}
	if ipA == ipB {
		t.Errorf("two switches on same-subnet routers got same IP %q — this is the reported bug", ipA)
	}
}

// TestCalculateNetwork_ReassignClearsOldIPs verifies that a second call to
// CalculateNetwork resets and re-assigns — stale IPs do not persist after
// topology changes.
func TestCalculateNetwork_ReassignClearsOldIPs(t *testing.T) {
	tx := testTx(t)
	svc := NewIPService(tx)
	buildID := newBuildID(t, tx)

	router := createNode(t, tx, buildID, "router", "Router", "192.168.1.1")
	sw := createNode(t, tx, buildID, "switch", "Switch", "")
	connectNodes(t, tx, buildID, router.ID, sw.ID)

	// First call: switch gets an IP
	if err := svc.CalculateNetwork(buildID); err != nil {
		t.Fatalf("first call: %v", err)
	}
	firstIP := fetchIP(t, tx, sw.ID)
	if firstIP == "" {
		t.Fatal("switch should have IP after first call")
	}

	// Disconnect the switch (delete its edge) to make it an orphan
	tx.Where("source_node_id = ? OR target_node_id = ?", sw.ID, sw.ID).Delete(&models.Edge{})

	// Second call: switch is now orphaned, should lose its IP
	if err := svc.CalculateNetwork(buildID); err != nil {
		t.Fatalf("second call: %v", err)
	}
	if ip := fetchIP(t, tx, sw.ID); ip != "" {
		t.Errorf("orphaned switch should have no IP after second call, got %q", ip)
	}
}

// TestCalculateNetwork_RouterIPPreserved verifies that a router's own IP is
// never overwritten by CalculateNetwork.
func TestCalculateNetwork_RouterIPPreserved(t *testing.T) {
	tx := testTx(t)
	svc := NewIPService(tx)
	buildID := newBuildID(t, tx)

	router := createNode(t, tx, buildID, "router", "Router", "10.0.0.1")
	sw := createNode(t, tx, buildID, "switch", "Switch", "")
	connectNodes(t, tx, buildID, router.ID, sw.ID)

	if err := svc.CalculateNetwork(buildID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ip := fetchIP(t, tx, router.ID); ip != "10.0.0.1" {
		t.Errorf("router IP should remain 10.0.0.1, got %q", ip)
	}
	if swIP := fetchIP(t, tx, sw.ID); !hasPrefix(swIP, "10.0.0.") {
		t.Errorf("switch should be in 10.0.0.x, got %q", swIP)
	}
}

// TestCalculateNetwork_NonNetworkTypes_SkipIP verifies that non-network types
// (disk, gpu, etc.) are never assigned IPs even when connected to a router.
func TestCalculateNetwork_NonNetworkTypes_SkipIP(t *testing.T) {
	tx := testTx(t)
	svc := NewIPService(tx)
	buildID := newBuildID(t, tx)

	router := createNode(t, tx, buildID, "router", "Router", "192.168.1.1")
	gpu := createNode(t, tx, buildID, "gpu", "GPU", "")
	disk := createNode(t, tx, buildID, "disk", "Disk", "")

	connectNodes(t, tx, buildID, router.ID, gpu.ID)
	connectNodes(t, tx, buildID, router.ID, disk.ID)

	if err := svc.CalculateNetwork(buildID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ip := fetchIP(t, tx, gpu.ID); ip != "" {
		t.Errorf("GPU should never get an IP, got %q", ip)
	}
	if ip := fetchIP(t, tx, disk.ID); ip != "" {
		t.Errorf("Disk should never get an IP, got %q", ip)
	}
}

// TestCalculateNetwork_VMsGetSubnetIPs verifies that VMs on a host node get
// IPs in the same /24 subnet as their host after CalculateNetwork.
func TestCalculateNetwork_VMsGetSubnetIPs(t *testing.T) {
	tx := testTx(t)
	svc := NewIPService(tx)
	buildID := newBuildID(t, tx)

	router := createNode(t, tx, buildID, "router", "Router", "192.168.1.1")
	server := createNode(t, tx, buildID, "server", "Server", "")

	// Attach a VM to the server
	vm := models.VirtualMachine{
		NodeID: server.ID,
		Name:   "nginx",
		Type:   "container",
		Status: "stopped",
	}
	if err := tx.Create(&vm).Error; err != nil {
		t.Fatalf("create vm: %v", err)
	}

	connectNodes(t, tx, buildID, router.ID, server.ID)

	if err := svc.CalculateNetwork(buildID); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	serverIP := fetchIP(t, tx, server.ID)
	if serverIP == "" {
		t.Fatal("server should have an IP")
	}

	// Reload VM from DB
	var updatedVM models.VirtualMachine
	if err := tx.First(&updatedVM, "id = ?", vm.ID).Error; err != nil {
		t.Fatalf("reload vm: %v", err)
	}
	if !hasPrefix(updatedVM.IP, "192.168.1.") {
		t.Errorf("VM should be in 192.168.1.x, got %q (server has %q)", updatedVM.IP, serverIP)
	}
	if updatedVM.IP == serverIP {
		t.Errorf("VM must not share IP %q with its host", serverIP)
	}
}

// ─── assignVMIPInSubnet unit tests (pure logic, no DB) ──────────────────────────

func TestAssignVMIPInSubnet_AllocatesAfterHostBlock(t *testing.T) {
	host := &models.Node{Type: "nas", IP: "192.168.1.100"} // Step=10 → VMs at .101-.109
	used := map[int]bool{1: true, 100: true}

	ip := assignVMIPInSubnet(host, used)
	if ip != "192.168.1.101" {
		t.Errorf("expected 192.168.1.101, got %q", ip)
	}
}

func TestAssignVMIPInSubnet_SkipsUsedOffsets(t *testing.T) {
	host := &models.Node{Type: "server", IP: "192.168.1.150"} // Step=10
	used := map[int]bool{1: true, 150: true, 151: true}       // .151 already taken

	ip := assignVMIPInSubnet(host, used)
	if ip != "192.168.1.152" {
		t.Errorf("expected 192.168.1.152, got %q", ip)
	}
}

func TestAssignVMIPInSubnet_NoAvailableSlots(t *testing.T) {
	host := &models.Node{Type: "server", IP: "192.168.1.150"} // Step=10
	used := map[int]bool{}
	for i := 150; i < 160; i++ {
		used[i] = true
	}

	ip := assignVMIPInSubnet(host, used)
	if ip != "" {
		t.Errorf("expected empty string when range exhausted, got %q", ip)
	}
}

func TestAssignVMIPInSubnet_SwitchGetsNoVMs(t *testing.T) {
	host := &models.Node{Type: "switch", IP: "192.168.1.10"} // Step=1 → no VM slot
	used := map[int]bool{1: true, 10: true}

	ip := assignVMIPInSubnet(host, used)
	if ip != "" {
		t.Errorf("switch type cannot host VMs, expected empty string, got %q", ip)
	}
}

func TestAssignVMIPInSubnet_EmptyHostIP(t *testing.T) {
	host := &models.Node{Type: "server", IP: ""}
	used := map[int]bool{}

	ip := assignVMIPInSubnet(host, used)
	if ip != "" {
		t.Errorf("expected empty string for unassigned host, got %q", ip)
	}
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

func hasPrefix(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}
