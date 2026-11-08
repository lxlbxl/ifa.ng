import numpy as np
from PIL import Image
base=np.array([0xfd,0xfc,0xf8],float)
def radial(W,H,cx,cy,rx,ry):
    y,x=np.mgrid[0:H,0:W]; d=np.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2); return np.clip(1-d,0,1)**1.6
def make(W,H,cx,cy,name):
    img=np.tile(base,(H,W,1))
    img=img+radial(W,H,cx,cy,W*0.5,H*0.7)[...,None]*np.array([4,2,-6.0])      # faint warm halo
    img=img-(1-radial(W,H,W/2,H/2,W*0.95,H*0.95))[...,None]*np.array([10,12,16.0])  # soft cloth edge falloff
    img+=np.random.default_rng(2).normal(0,1.2,img.shape)
    Image.fromarray(np.clip(img,0,255).astype(np.uint8)).save(name)
make(1920,1080,1460,470,'bg_desk_white.png'); make(720,1280,430,430,'bg_mob_white.png')
