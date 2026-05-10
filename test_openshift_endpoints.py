#!/usr/bin/env python3
"""
Quick test script to verify OpenShift-compatible endpoints.
Run this after starting the application locally or in OpenShift.

Usage:
    python test_openshift_endpoints.py http://localhost:8080
    python test_openshift_endpoints.py https://your-openshift-route.com
"""

import sys
import requests


def test_endpoints(base_url: str):
    """Test all critical endpoints for OpenShift compatibility."""
    
    print(f"Testing endpoints at: {base_url}\n")
    print("=" * 60)
    
    tests = [
        {
            "name": "Root Endpoint",
            "url": f"{base_url}/",
            "expected_status": 200,
            "expected_content_type": "text/html",
            "description": "Main application page"
        },
        {
            "name": "Health Endpoint",
            "url": f"{base_url}/health",
            "expected_status": 200,
            "expected_content_type": "application/json",
            "expected_json": {"status": "healthy"},
            "description": "OpenShift health probe endpoint"
        },
        {
            "name": "API Status Endpoint",
            "url": f"{base_url}/api/status",
            "expected_status": 200,
            "expected_content_type": "application/json",
            "expected_json_keys": ["status", "service", "temp_path", "temp_writable"],
            "description": "Detailed status information"
        },
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        print(f"\n📋 Test: {test['name']}")
        print(f"   URL: {test['url']}")
        print(f"   Description: {test['description']}")
        
        try:
            response = requests.get(test['url'], timeout=10)
            
            # Check status code
            if response.status_code == test['expected_status']:
                print(f"   ✅ Status Code: {response.status_code}")
            else:
                print(f"   ❌ Status Code: {response.status_code} (expected {test['expected_status']})")
                failed += 1
                continue
            
            # Check content type
            content_type = response.headers.get('content-type', '').split(';')[0]
            if test['expected_content_type'] in content_type:
                print(f"   ✅ Content-Type: {content_type}")
            else:
                print(f"   ⚠️  Content-Type: {content_type} (expected {test['expected_content_type']})")
            
            # Check JSON response if expected
            if 'expected_json' in test:
                json_data = response.json()
                if all(json_data.get(k) == v for k, v in test['expected_json'].items()):
                    print(f"   ✅ JSON Response: {json_data}")
                else:
                    print(f"   ❌ JSON Response: {json_data} (expected {test['expected_json']})")
                    failed += 1
                    continue
            
            # Check JSON keys if expected
            if 'expected_json_keys' in test:
                json_data = response.json()
                missing_keys = [k for k in test['expected_json_keys'] if k not in json_data]
                if not missing_keys:
                    print(f"   ✅ JSON Keys Present: {list(json_data.keys())}")
                    print(f"   📊 Response: {json_data}")
                else:
                    print(f"   ❌ Missing Keys: {missing_keys}")
                    failed += 1
                    continue
            
            passed += 1
            print(f"   ✅ PASSED")
            
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Request Failed: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"\n📊 Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("✅ All tests passed! Application is OpenShift-ready.")
        return 0
    else:
        print("❌ Some tests failed. Check the output above.")
        return 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_openshift_endpoints.py <base_url>")
        print("Example: python test_openshift_endpoints.py http://localhost:8080")
        sys.exit(1)
    
    base_url = sys.argv[1].rstrip('/')
    exit_code = test_endpoints(base_url)
    sys.exit(exit_code)
