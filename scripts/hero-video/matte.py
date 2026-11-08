import sys, subprocess, numpy as np, onnxruntime as ort, time
src, out = sys.argv[1], sys.argv[2]
W,H=720,1280
sess=ort.InferenceSession(sys.argv[3], providers=['CPUExecutionProvider'])
print([ (i.name,i.shape,i.type) for i in sess.get_inputs()])
dec=subprocess.Popen(['ffmpeg','-v','error','-i',src,'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','gray','-s',f'{W}x{H}','-r','30','-i','-','-c:v','libx264','-crf','12','-pix_fmt','yuv420p',out],stdin=subprocess.PIPE)
rec=[np.zeros([1,1,1,1],np.float32)]*4
dr=np.array([0.4],np.float32)
n=0;t=time.time()
while True:
    b=dec.stdout.read(W*H*3)
    if len(b)<W*H*3: break
    f=np.frombuffer(b,np.uint8).reshape(H,W,3).astype(np.float32)/255
    x=f.transpose(2,0,1)[None]
    fgr,pha,*rec=sess.run(None,{'src':x,'r1i':rec[0],'r2i':rec[1],'r3i':rec[2],'r4i':rec[3],'downsample_ratio':dr})
    a=(pha[0,0]*255).clip(0,255).astype(np.uint8)
    enc.stdin.write(a.tobytes()); n+=1
    if n%100==0: print(n, round(n/(time.time()-t),1),'fps',flush=True)
enc.stdin.close(); enc.wait(); print('done',n)
