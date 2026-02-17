#!/usr/bin/env python3
"""
Test for directory structure validation.
Tests:
1. Backend directories: cmd, internal, pkg exist
2. Frontend directories: src, public exist
"""

import os
import sys

def test_directory_structure():
    """Test directory structure exists as required."""
    base_path = '/home/claw/.openclaw/workspaces/feature-dev/agents/planner'
    
    required_dirs = [
        'backend/cmd',
        'backend/internal', 
        'backend/pkg',
        'frontend/src',
        'frontend/public'
    ]
    
    for dir_path in required_dirs:
        full_path = os.path.join(base_path, dir_path)
        assert os.path.isdir(full_path), f"Directory missing: {dir_path}"
        print(f"✓ {dir_path} exists")
    
    print("\n✓ All directory structure tests passed")

if __name__ == '__main__':
    test_directory_structure()
    print("All tests passed!")