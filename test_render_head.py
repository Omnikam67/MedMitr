import urllib.request
import time

start = time.time()
req = urllib.request.Request(
    'https://pharma-znex.onrender.com/', 
    method='HEAD'
)

try:
    response = urllib.request.urlopen(req, timeout=10)
    print("Success:", response.read().decode())
    print("Code:", response.getcode())
except Exception as e:
    print('Error:', e)
    if hasattr(e, "read"):
        print("Body:", e.read().decode())
    
print('Took', time.time() - start, 'seconds')
