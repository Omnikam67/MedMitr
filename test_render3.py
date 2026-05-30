import urllib.request
import json
import time

start = time.time()
try:
    req1 = urllib.request.Request(
        'https://pharma-znex.onrender.com/auth/system-manager/login',
        b'{"manager_id":"sysmanager","password":"SysManager@123"}',
        {'Content-Type': 'application/json'},
        method='POST'
    )
    res1 = urllib.request.urlopen(req1, timeout=30).read()
    token = json.loads(res1)['access_token']
    
    payload = json.dumps({
        "product_name": "TestMed123",
        "description": "Test",
        "stock": 10,
        "price": 20,
        "prescription_required": False
    }).encode('utf-8')
    
    req2 = urllib.request.Request(
        'https://pharma-znex.onrender.com/admin/products',
        payload,
        {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        },
        method='POST'
    )
    res2 = urllib.request.urlopen(req2, timeout=60).read()
    print("Success:", res2.decode())
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print("Body:", e.read().decode())
print("Took", time.time() - start, "seconds")
