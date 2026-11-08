from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request,urlopen
from PIL import Image
from io import BytesIO
p=Path('/root/ifa-app/deploy/vps/profile-portraits')
photos={'ade':32,'ifemi':52,'tunde':75,'admin':11,'client':12,'other':33,'pending':46,'rejected':60,'suspended':83}
def download(item):
 key,index=item
 url=f'https://randomuser.me/api/portraits/men/{index}.jpg'
 data=urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25).read()
 im=Image.open(BytesIO(data)).convert('RGB');im.save(p/f'{key}.jpg',quality=92)
 return key,im.size
with ThreadPoolExecutor(max_workers=4) as pool:
 for result in pool.map(download,photos.items()): print(*result)
