import numpy as np
from PIL import Image, ImageFilter
ink=np.array([0x12,0x16,0x11],float)
def radial(W,H,cx,cy,rx,ry,col,strength):
    y,x=np.mgrid[0:H,0:W]
    d=np.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2)
    g=np.clip(1-d,0,1)**2.2*strength
    return g[...,None]*np.array(col,float)
def make(W,H,cx,cy,name):
    img=np.tile(ink,(H,W,1))
    img+=radial(W,H,cx,cy,W*0.55,H*0.75,[0xb5-0x12,0x50-0x16,0x2b-0x11],0.55)  # camwood glow
    img+=radial(W,H,cx,cy*0.9,W*0.28,H*0.42,[0xf2-0x12,0xc2-0x16,0x30-0x11],0.22)  # sun core
    img+=radial(W,H,W*0.1,H*0.15,W*0.5,H*0.6,[0x28-0x12,0x36-0x16,0x7f-0x11],0.25) # indigo cool corner
    # subtle grain
    rng=np.random.default_rng(1); img+=rng.normal(0,2.2,img.shape)
    Image.fromarray(np.clip(img,0,255).astype(np.uint8)).save(name)
make(1920,1080,1460,470,'bg_desk.png')
make(720,1280,430,430,'bg_mob.png')
# haze texture: soft clouds, grayscale
def haze(W,H,seed,name):
    rng=np.random.default_rng(seed); acc=np.zeros((H,W))
    for s,a in [(8,1),(16,.6),(32,.35),(64,.2)]:
        n=Image.fromarray((rng.random((max(2,H//(H//s)),s))*255).astype(np.uint8)).resize((W,H),Image.BICUBIC)
        acc+=np.asarray(n,float)*a
    acc=(acc-acc.min())/(acc.max()-acc.min())
    acc=np.clip((acc-0.45)*2.2,0,1)**1.5
    im=Image.fromarray((acc*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(W/80))
    im.save(name)
haze(3840,1080,3,'haze_desk.png')
haze(1440,1280,5,'haze_mob.png')
