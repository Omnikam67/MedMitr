import urllib.request
import time

start = time.time()
req = urllib.request.Request(
    'https://pharma-znex.onrender.com/auth/login', 
    b'{"phone":"0707071137","password":"password"}', 
    headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}, 
    method='POST'
)

try:
    response = urllib.request.urlopen(req, timeout=30)
    print("Success:", response.read().decode())
    print("Code:", response.getcode())
except Exception as e:
    print('Error:', e)
    if hasattr(e, "read"):
        print("Body:", e.read().decode())
    
print('Took', time.time() - start, 'seconds')
