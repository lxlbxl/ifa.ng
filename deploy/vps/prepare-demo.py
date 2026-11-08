"""Create private demo passwords and generated seed media. Requires Pillow."""
from pathlib import Path
import json, secrets, wave, struct, math
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parent
people=[('admin','Femi Akinola','admin'),('client','Ayo Adeyemi','user'),('other','Bola Akinyemi','user'),('suspended','Segun Balogun','user'),('ade','Ade Adewale','babalawo'),('ifemi','Ifemi Adebayo','babalawo'),('tunde','Tunde Ogunleye','babalawo'),('pending','Seyi Alabi','babalawo'),('rejected','Kunle Afolabi','babalawo')]
credentials=root/'demo-credentials.json'
if not credentials.exists():
 credentials.write_text(json.dumps([dict(key=k,name=n,role=r,email=k+'@demo.ifa.test',password=secrets.token_urlsafe(18)) for k,n,r in people],indent=2))
 credentials.chmod(0o600)
accounts=json.loads(credentials.read_text())
access=root/'DEMO-ACCESS.md'
if not access.exists():
 access.write_text('# Test accounts\n\nLogin: https://ifa.ng/auth\n\n'+''.join(f'- {a["key"]}: {a["email"]} / {a["password"]}\n' for a in accounts)+'\nThese are fictional accounts and financial fixtures. No real funds are represented.\n')
 access.chmod(0o600)
assets=root/'demo-assets';assets.mkdir(exist_ok=True)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',76)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
for k,color in zip(['ade','ifemi','tunde','pending','rejected'],['#345c55','#63533e','#3f526e','#696069','#734e4f']):
 im=Image.new('RGB',(256,256),color);d=ImageDraw.Draw(im);d.text((128,112),k[:2].upper(),font=font,fill='white',anchor='mm');d.text((128,200),'DEMO',font=small,fill='white',anchor='mm');im.save(assets/f'{k}.png')
with wave.open(str(assets/'demo-tone.wav'),'wb') as w:
 w.setparams((1,2,16000,0,'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',int(1200*math.sin(2*math.pi*440*i/16000))) for i in range(32000)))
print('Private credentials and seed assets ready; existing passwords preserved.')
