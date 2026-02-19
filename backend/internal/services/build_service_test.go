package services

import (
	"encoding/json"
	"testing"

	"github.com/Butterski/homelab-builder/backend/internal/models"
	"github.com/google/uuid"
)

// ─── Create ───────────────────────────────────────────────────────────────────

func TestBuildService_Create_Succeeds(t *testing.T) {
	tx := testTx(t)
	svc := NewBuildService(tx)
	user := models.User{Email: uuid.NewString() + "@t.com", Name: "T", GoogleID: uuid.NewString()}
	tx.Create(&user)

	build, err := svc.Create(user.ID, "My Build", `{"hardwareNodes":[]}`, "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if build.ID == uuid.Nil {
		t.Error("expected non-nil UUID")
	}
	if build.Name != "My Build" {
		t.Errorf("name: want 'My Build', got %q", build.Name)
	}
}

// ─── GetByID + VirtualMachines Preload (Regression) ────────────────────────────

// TestGetByID_PreloadsVirtualMachines is the regression test for the bug where
// GetByID was missing Preload("Nodes.VirtualMachines"), causing VMs to always
// appear empty after a network recalculation.
func TestGetByID_PreloadsVirtualMachines(t *testing.T) {
	tx := testTx(t)
	svc := NewBuildService(tx)
	user := models.User{Email: uuid.NewString() + "@t.com", Name: "T", GoogleID: uuid.NewString()}
	tx.Create(&user)

	buildJSON := buildJSONWithVM("node-1", "server", "My Server", "vm-1", "nginx")
	build, err := svc.Create(user.ID, "VM Test Build", buildJSON, "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	// Trigger lazy migration via GetByID
	loaded, err := svc.GetByID(build.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if len(loaded.Nodes) == 0 {
		t.Fatal("expected Nodes to be populated after lazy migration")
	}

	// This is the regression: before the fix, VirtualMachines was always empty
	node := loaded.Nodes[0]
	if len(node.VirtualMachines) == 0 {
		t.Errorf("regression: Nodes[0].VirtualMachines is empty — Preload(\"Nodes.VirtualMachines\") is missing")
	} else if node.VirtualMachines[0].Name != "nginx" {
		t.Errorf("VM name: want 'nginx', got %q", node.VirtualMachines[0].Name)
	}
}

func TestGetByID_NotFound(t *testing.T) {
	svc := NewBuildService(testTx(t))
	_, err := svc.GetByID(uuid.New())
	if err == nil {
		t.Error("expected error for non-existent build, got nil")
	}
}

// ─── syncDataFromJSON / lazy migration ────────────────────────────────────────────

// TestSyncDataFromJSON_CreatesNodes verifies that GetByID on a build with JSON
// data but no relational records triggers the lazy migration correctly.
func TestSyncDataFromJSON_CreatesNodes(t *testing.T) {
	tx := testTx(t)
	svc := NewBuildService(tx)
	user := models.User{Email: uuid.NewString() + "@t.com", Name: "T", GoogleID: uuid.NewString()}
	tx.Create(&user)

	data := `{
		"hardwareNodes": [
			{"id":"n1","type":"router","name":"Router","x":0,"y":0,"ip":"","details":{},"vms":[]},
			{"id":"n2","type":"switch","name":"Switch","x":100,"y":0,"ip":"","details":{},"vms":[]}
		],
		"edges": [{"id":"e1","source":"n1","target":"n2"}],
		"selectedServices": []
	}`

	build, err := svc.Create(user.ID, "Sync Test", data, "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	loaded, err := svc.GetByID(build.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if len(loaded.Nodes) != 2 {
		t.Errorf("expected 2 nodes, got %d", len(loaded.Nodes))
	}
	if len(loaded.Edges) != 1 {
		t.Errorf("expected 1 edge, got %d", len(loaded.Edges))
	}
	typeSet := map[string]bool{}
	for _, n := range loaded.Nodes {
		typeSet[n.Type] = true
	}
	if !typeSet["router"] || !typeSet["switch"] {
		t.Errorf("expected router+switch types, got %v", typeSet)
	}
}

// TestSyncDataFromJSON_EdgesOnlyCreatedForValidNodes ensures that edges
// referencing unknown node IDs are silently skipped.
func TestSyncDataFromJSON_EdgesOnlyCreatedForValidNodes(t *testing.T) {
	tx := testTx(t)
	svc := NewBuildService(tx)
	user := models.User{Email: uuid.NewString() + "@t.com", Name: "T", GoogleID: uuid.NewString()}
	tx.Create(&user)

	data := `{
		"hardwareNodes": [
			{"id":"n1","type":"router","name":"Router","x":0,"y":0,"ip":"","details":{},"vms":[]}
		],
		"edges": [
			{"id":"e1","source":"n1","target":"MISSING"},
			{"id":"e2","source":"ALSO_MISSING","target":"n1"}
		],
		"selectedServices": []
	}`

	build, err := svc.Create(user.ID, "Bad Edges", data, "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	loaded, err := svc.GetByID(build.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if len(loaded.Edges) != 0 {
		t.Errorf("expected 0 valid edges, got %d", len(loaded.Edges))
	}
}

// TestSyncDataFromJSON_VMIPPreserved verifies that VM IPs stored in JSON are
// preserved after sync (not reset to empty).
func TestSyncDataFromJSON_VMIPPreserved(t *testing.T) {
	tx := testTx(t)
	svc := NewBuildService(tx)
	user := models.User{Email: uuid.NewString() + "@t.com", Name: "T", GoogleID: uuid.NewString()}
	tx.Create(&user)

	data := `{
		"hardwareNodes": [{
			"id":"n1","type":"server","name":"Server","x":0,"y":0,"ip":"192.168.1.150","details":{},
			"vms":[{"id":"v1","name":"nginx","type":"container","ip":"192.168.1.151","os":"","cpu_cores":1,"ram_mb":512,"status":"stopped"}]
		}],
		"edges": [],
		"selectedServices": []
	}`

	build, err := svc.Create(user.ID, "IP Preserve", data, "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	loaded, err := svc.GetByID(build.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if len(loaded.Nodes) == 0 {
		t.Fatal("no nodes after migration")
	}
	node := loaded.Nodes[0]
	if node.IP != "192.168.1.150" {
		t.Errorf("server IP: want 192.168.1.150, got %q", node.IP)
	}
	if len(node.VirtualMachines) == 0 {
		t.Fatal("no VMs after migration")
	}
	if node.VirtualMachines[0].IP != "192.168.1.151" {
		t.Errorf("VM IP: want 192.168.1.151, got %q", node.VirtualMachines[0].IP)
	}
}

// ─── Update ────────────────────────────────────────────────────────────────────────

// TestUpdate_ReSyncsRelationalData ensures that Update re-syncs the relational
// tables to match the new JSON blob.
func TestUpdate_ReSyncsRelationalData(t *testing.T) {
	tx := testTx(t)
	svc := NewBuildService(tx)
	user := models.User{Email: uuid.NewString() + "@t.com", Name: "T", GoogleID: uuid.NewString()}
	tx.Create(&user)

	initialData := `{"hardwareNodes":[{"id":"n1","type":"router","name":"Router","x":0,"y":0,"ip":"","details":{},"vms":[]}],"edges":[],"selectedServices":[]}`
	build, err := svc.Create(user.ID, "Update Test", initialData, "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	// Trigger first sync
	if _, err := svc.GetByID(build.ID); err != nil {
		t.Fatalf("GetByID: %v", err)
	}

	updatedData := `{"hardwareNodes":[
		{"id":"n1","type":"router","name":"Router","x":0,"y":0,"ip":"","details":{},"vms":[]},
		{"id":"n2","type":"switch","name":"Switch","x":100,"y":0,"ip":"","details":{},"vms":[]}
	],"edges":[],"selectedServices":[]}`
	if _, err := svc.Update(build.ID, user.ID, "Update Test", updatedData, ""); err != nil {
		t.Fatalf("Update: %v", err)
	}

	loaded, err := svc.GetByID(build.ID)
	if err != nil {
		t.Fatalf("GetByID (after update): %v", err)
	}
	if len(loaded.Nodes) != 2 {
		t.Errorf("expected 2 nodes after update, got %d", len(loaded.Nodes))
	}
}

// TestUpdate_Unauthorized rejects updates from a different user.
func TestUpdate_Unauthorized(t *testing.T) {
	tx := testTx(t)
	svc := NewBuildService(tx)
	owner := models.User{Email: uuid.NewString() + "@t.com", Name: "Owner", GoogleID: uuid.NewString()}
	attacker := models.User{Email: uuid.NewString() + "@t.com", Name: "Attacker", GoogleID: uuid.NewString()}
	tx.Create(&owner)
	tx.Create(&attacker)

	build, _ := svc.Create(owner.ID, "Private Build", `{"hardwareNodes":[],"edges":[],"selectedServices":[]}`, "")

	_, err := svc.Update(build.ID, attacker.ID, "Stolen", "{}", "")
	if err == nil || err.Error() != "unauthorized" {
		t.Errorf("expected 'unauthorized' error, got %v", err)
	}
}

// ─── Delete ─────────────────────────────────────────────────────────────────────────

func TestDelete_OwnerCanDelete(t *testing.T) {
	tx := testTx(t)
	svc := NewBuildService(tx)
	user := models.User{Email: uuid.NewString() + "@t.com", Name: "T", GoogleID: uuid.NewString()}
	tx.Create(&user)

	build, _ := svc.Create(user.ID, "To Delete", `{"hardwareNodes":[],"edges":[],"selectedServices":[]}`, "")
	if err := svc.Delete(build.ID, user.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	_, err := svc.GetByID(build.ID)
	if err == nil {
		t.Error("expected error fetching deleted build, got nil")
	}
}

func TestDelete_NonOwnerFails(t *testing.T) {
	tx := testTx(t)
	svc := NewBuildService(tx)
	owner := models.User{Email: uuid.NewString() + "@t.com", Name: "Owner", GoogleID: uuid.NewString()}
	other := models.User{Email: uuid.NewString() + "@t.com", Name: "Other", GoogleID: uuid.NewString()}
	tx.Create(&owner)
	tx.Create(&other)

	build, _ := svc.Create(owner.ID, "Protected", `{"hardwareNodes":[],"edges":[],"selectedServices":[]}`, "")
	if err := svc.Delete(build.ID, other.ID); err == nil {
		t.Error("expected error deleting another user's build, got nil")
	}
}

// ─── Test data helpers ────────────────────────────────────────────────────────────

func buildJSONWithVM(nodeID, nodeType, nodeName, vmID, vmName string) string {
	type vmData struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Type     string `json:"type"`
		IP       string `json:"ip"`
		OS       string `json:"os"`
		CPUCores int    `json:"cpu_cores"`
		RAMMB    int    `json:"ram_mb"`
		Status   string `json:"status"`
	}
	type nodeData struct {
		ID      string   `json:"id"`
		Type    string   `json:"type"`
		Name    string   `json:"name"`
		X       float64  `json:"x"`
		Y       float64  `json:"y"`
		IP      string   `json:"ip"`
		Details struct{} `json:"details"`
		VMs     []vmData `json:"vms"`
	}
	type buildData struct {
		HardwareNodes []nodeData `json:"hardwareNodes"`
		Edges         []struct{} `json:"edges"`
		Services      []struct{} `json:"selectedServices"`
	}

	d := buildData{
		HardwareNodes: []nodeData{
			{
				ID:   nodeID,
				Type: nodeType,
				Name: nodeName,
				VMs:  []vmData{{ID: vmID, Name: vmName, Type: "container", Status: "stopped"}},
			},
		},
	}
	b, _ := json.Marshal(d)
	return string(b)
}
