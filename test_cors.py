"""
Simple CORS test script to verify cross-origin requests work correctly.
Run this after starting the server with: uvicorn main:app --reload
"""

import requests

# Test the local server
BASE_URL = "http://localhost:8000"

def test_cors():
    """Test CORS configuration with OPTIONS preflight and GET request."""
    
    print("=" * 60)
    print("CORS Test Suite")
    print("=" * 60)
    
    # Test 1: OPTIONS preflight request
    print("\n1. Testing OPTIONS preflight request...")
    try:
        response = requests.options(
            f"{BASE_URL}/cors-test",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "content-type",
            }
        )
        print(f"   Status: {response.status_code}")
        print(f"   Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin', 'NOT SET')}")
        print(f"   Access-Control-Allow-Methods: {response.headers.get('Access-Control-Allow-Methods', 'NOT SET')}")
        print(f"   Access-Control-Allow-Headers: {response.headers.get('Access-Control-Allow-Headers', 'NOT SET')}")
        print(f"   Access-Control-Allow-Credentials: {response.headers.get('Access-Control-Allow-Credentials', 'NOT SET')}")
        
        if response.headers.get('Access-Control-Allow-Origin'):
            print("   ✓ CORS headers present")
        else:
            print("   ✗ CORS headers MISSING")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 2: GET request with Origin header
    print("\n2. Testing GET request with Origin header...")
    try:
        response = requests.get(
            f"{BASE_URL}/cors-test",
            headers={"Origin": "https://example.com"}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin', 'NOT SET')}")
        print(f"   Access-Control-Allow-Credentials: {response.headers.get('Access-Control-Allow-Credentials', 'NOT SET')}")
        print(f"   Response: {response.json()}")
        
        if response.headers.get('Access-Control-Allow-Origin'):
            print("   ✓ CORS headers present")
        else:
            print("   ✗ CORS headers MISSING")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 3: Health endpoint
    print("\n3. Testing /health endpoint...")
    try:
        response = requests.get(
            f"{BASE_URL}/health",
            headers={"Origin": "https://example.com"}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin', 'NOT SET')}")
        print(f"   Response: {response.json()}")
        
        if response.headers.get('Access-Control-Allow-Origin'):
            print("   ✓ CORS headers present")
        else:
            print("   ✗ CORS headers MISSING")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    # Test 4: API status endpoint
    print("\n4. Testing /api/status endpoint...")
    try:
        response = requests.get(
            f"{BASE_URL}/api/status",
            headers={"Origin": "https://example.com"}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Access-Control-Allow-Origin: {response.headers.get('Access-Control-Allow-Origin', 'NOT SET')}")
        print(f"   Response: {response.json()}")
        
        if response.headers.get('Access-Control-Allow-Origin'):
            print("   ✓ CORS headers present")
        else:
            print("   ✗ CORS headers MISSING")
    except Exception as e:
        print(f"   ✗ Error: {e}")
    
    print("\n" + "=" * 60)
    print("CORS Test Complete")
    print("=" * 60)

if __name__ == "__main__":
    test_cors()
