import numpy as np; from PIL import Image
W,H=720,1280
def ramp(n,a,b): # 0 at a ->1 at b
    x=np.arange(n,dtype=float); r=np.clip((x-a)/(b-a),0,1); return r*r*(3-2*r)
def mk(left,right,bottom,name):
    h=np.ones(W)
    if left: h*=ramp(W,0,left)
    if right: h*=ramp(W,W,W-right)
    v=ramp(H,H,H-bottom)
    Image.fromarray((np.outer(v,h)*255).astype(np.uint8)).save(name)
mk(110,110,300,'mask_desk.png')
mk(40,0,260,'mask_mob.png')
# desktop: soft elliptical spotlight around the group, right edge kept (it sits on the frame edge)
y,x=np.mgrid[0:H,0:W].astype(float)
d=np.sqrt(((x-470)/560)**2+((y-640)/780)**2)
r=np.clip((1.0-d)/0.32,0,1); r=r*r*(3-2*r)
r=np.maximum(r, np.where(x>520, r.max(), 0)*np.clip((x-520)/120,0,1)*ramp(H,H,H-300)[:,None])
left=ramp(W,0,70)[None,:]
Image.fromarray((np.clip(r*left*ramp(H,H,H-300)[:,None],0,1)*255).astype(np.uint8)).save('mask_desk.png')
