#!/usr/bin/env python3
"""
Test for Docker configuration validation.
Tests:
1. docker-compose.yml is valid YAML
2. docker-compose.yml contains required PostgreSQL 15 service
3. docker-compose.yml has healthcheck configured
"""

import yaml
import sys
import os

def test_docker_compose_structure():
    """Test docker-compose.yml structure."""
    with open('docker-compose.yml', 'r') as f:
        compose = yaml.safe_load(f)
    
    # Test 1: PostgreSQL service exists
    assert 'postgres' in compose['services'], "PostgreSQL service missing"
    
    # Test 2: Uses PostgreSQL 15 image
    assert compose['services']['postgres']['image'] == 'postgres:15', "Not using postgres:15"
    
    # Test 3: Has healthcheck
    assert 'healthcheck' in compose['services']['postgres'], "Healthcheck missing"
    
    # Test 4: Healthcheck uses pg_isready
    healthcheck_cmd = compose['services']['postgres']['healthcheck']['test']
    assert 'pg_isready' in str(healthcheck_cmd), "Healthcheck doesn't use pg_isready"
    
    # Test 5: Has environment variables
    assert 'environment' in compose['services']['postgres'], "Environment variables missing"
    
    print("✓ All Docker configuration tests passed")

if __name__ == '__main__':
    os.chdir('/home/claw/.openclaw/workspaces/feature-dev/agents/planner')
    test_docker_compose_structure()
    print("All tests passed!")
