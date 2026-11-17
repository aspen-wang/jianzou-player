import * as THREE from 'three';

(() => {
  const canvas = document.getElementById('turntable');
  const fallback = document.getElementById('turntable-fallback');
  const fail = () => { fallback?.classList.add('visible'); canvas.style.display = 'none'; };
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true}); }
  catch (_) { fail(); window.turntable={update(){},onAction(){}}; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=0.95;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  canvas.addEventListener('webglcontextlost', (event) => {event.preventDefault(); fail();});

  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-7,7,4.5,-4.5,.1,100);
  camera.position.set(0,0,22); camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xd5d6d0,0x353330,1.35));
  const key=new THREE.DirectionalLight(0xfff6d8,2.15); key.position.set(-6,8,15); scene.add(key);
  const fill=new THREE.DirectionalLight(0xa3a4a2,.7); fill.position.set(8,-2,7); scene.add(fill);
  const machine=new THREE.Group(); machine.rotation.set(-.52,-.32,.01); machine.position.y=-.08; scene.add(machine);
  const mat=(color,roughness=.65,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const shell=new THREE.MeshPhysicalMaterial({color:0xc2c8c8,roughness:.1,metalness:.07,transparent:true,opacity:.075,depthWrite:false,clearcoat:1,clearcoatRoughness:.05}), edge=new THREE.MeshPhysicalMaterial({color:0x576363,roughness:.16,metalness:.25,transparent:true,opacity:.23,depthWrite:false,clearcoat:1}), black=mat(0x171819,.42,.2), steel=mat(0x9a9d99,.24,.72), graphite=mat(0x252729,.42,.3);
  function roundedShape(w,h,r){const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;}
  function rounded(w,h,r,d,material,x=0,y=0,z=0){const geo=new THREE.ExtrudeGeometry(roundedShape(w,h,r),{depth:d,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:.035,bevelThickness:.035,curveSegments:8});const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);machine.add(m);return m;}
  function cylinder(radius,depth,material,x,y,z,parent=machine){const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,96),material);m.rotation.x=Math.PI/2;m.position.set(x,y,z);parent.add(m);return m;}
  // A diffuse shadow lifts the clear acrylic off the dark surface without a solid backplate.
  const shadowCanvas=document.createElement('canvas'); shadowCanvas.width=1024; shadowCanvas.height=720;
  const shadowCtx=shadowCanvas.getContext('2d'); shadowCtx.filter='blur(24px)';
  shadowCtx.fillStyle='rgba(0,0,0,.48)'; shadowCtx.beginPath(); shadowCtx.roundRect(45,50,934,620,54); shadowCtx.fill();
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas); shadowTexture.colorSpace=THREE.SRGBColorSpace;
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(12.7,8.0),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
  shadow.position.set(.12,-.20,-.95); machine.add(shadow);
  // A pool of album-colored light lands beneath the translucent acrylic chassis.
  const glowCanvas=document.createElement('canvas'); glowCanvas.width=512; glowCanvas.height=256;
  const glowCtx=glowCanvas.getContext('2d');
  const glowTexture=new THREE.CanvasTexture(glowCanvas);glowTexture.colorSpace=THREE.SRGBColorSpace;
  const glowPlane=new THREE.Mesh(new THREE.PlaneGeometry(7.2,2.2),new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,depthWrite:false}));glowPlane.position.set(-2.0,-3.35,-.7);machine.add(glowPlane);
  // Smoked acrylic: a thin dark edge with a translucent face and a second inset rim.
  // The side material is deliberately deeper and darker than the clear top,
  // making the thickness of the acrylic visible from the oblique camera angle.
  const invisibleTop=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
  const acrylicSide=new THREE.MeshPhysicalMaterial({color:0x53615f,roughness:.22,metalness:.25,transparent:true,opacity:.72,depthWrite:false,clearcoat:1});
  rounded(11.45,6.85,.22,.46,[invisibleTop,acrylicSide],0,0,-.62);
  rounded(11.45,6.85,.22,.29,edge,0,0,-.48);
  // Low machined feet add depth beneath the clear acrylic base.
  for (const x of [-4.8,4.8]) for (const y of [-2.65,2.65]) { cylinder(.28,.27,graphite,x,y,-.60); cylinder(.16,.29,steel,x,y,-.59); }
  rounded(11.38,6.78,.20,.10,shell,0,0,-.18);
  // Delicate directional reflections on the acrylic face, clipped to the chassis.
  const reflectionCanvas=document.createElement('canvas'); reflectionCanvas.width=1200; reflectionCanvas.height=720;
  const reflectionCtx=reflectionCanvas.getContext('2d');
  reflectionCtx.beginPath(); reflectionCtx.roundRect(0,0,1200,720,25); reflectionCtx.clip();
  const reflection=reflectionCtx.createLinearGradient(120,0,850,720);
  reflection.addColorStop(0,'rgba(255,255,255,.15)'); reflection.addColorStop(.16,'rgba(255,255,255,.035)');
  reflection.addColorStop(.43,'rgba(255,255,255,0)'); reflection.addColorStop(.71,'rgba(255,255,255,.018)'); reflection.addColorStop(1,'rgba(0,0,0,.06)');
  reflectionCtx.fillStyle=reflection; reflectionCtx.fillRect(0,0,1200,720);
  reflectionCtx.strokeStyle='rgba(255,255,255,.16)'; reflectionCtx.lineWidth=2;
  reflectionCtx.beginPath(); reflectionCtx.moveTo(44,12); reflectionCtx.lineTo(500,12); reflectionCtx.stroke();
  const reflectionTexture=new THREE.CanvasTexture(reflectionCanvas); reflectionTexture.colorSpace=THREE.SRGBColorSpace;
  const reflectionFace=new THREE.Mesh(new THREE.PlaneGeometry(11.38,6.78),new THREE.MeshBasicMaterial({map:reflectionTexture,transparent:true,depthWrite:false}));
  reflectionFace.position.z=-.03; machine.add(reflectionFace);
  const inset=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.ExtrudeGeometry(roundedShape(11.18,6.58,.18),{depth:.03,bevelEnabled:false,curveSegments:8})),new THREE.LineBasicMaterial({color:0xced0c9,transparent:true,opacity:.20}));inset.position.z=-.02;machine.add(inset);
  const platterX=-2.65, platterY=-.04;
  const platterRim=new THREE.Mesh(new THREE.RingGeometry(2.53,2.64,128),new THREE.MeshBasicMaterial({color:0xa8a69b,transparent:true,opacity:.28,side:THREE.DoubleSide}));platterRim.position.set(platterX,platterY,.05);machine.add(platterRim);
  const record=new THREE.Group();record.position.set(platterX,platterY,.19);machine.add(record);
  const vinyl=new THREE.MeshPhysicalMaterial({color:0xd5b64b,roughness:.2,metalness:.03,transparent:true,opacity:.18,depthWrite:false,clearcoat:1,clearcoatRoughness:.12});
  cylinder(2.53,.065,vinyl,0,0,0,record);
  // Layer a translucent radial tint and fine highlights over the clear disc.
  // The background remains visible through the outer rim and lighter grooves.
  const vinylCanvas=document.createElement('canvas');vinylCanvas.width=1024;vinylCanvas.height=1024;
  const vctx=vinylCanvas.getContext('2d');
  const vinylTexture=new THREE.CanvasTexture(vinylCanvas);vinylTexture.colorSpace=THREE.SRGBColorSpace;
  const vinylFace=new THREE.Mesh(new THREE.CircleGeometry(2.53,128),new THREE.MeshBasicMaterial({map:vinylTexture,transparent:true,depthWrite:false}));vinylFace.position.z=.037;record.add(vinylFace);
  // The scene uses a bounded sample of the artwork, not its raw pixels at render time.
  // Tonal clamping keeps the transparent vinyl legible for very dark or pale covers.
  const defaultTint = { h: .135, s: .68, l: .60 };
  let currentTint = defaultTint;
  function hsl(h,s,l,alpha=1) { return `hsla(${Math.round(h*360)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%, ${alpha})`; }
  function tintScene(tone) {
    currentTint=tone;
    vinyl.color.setHSL(tone.h, tone.s*.78, tone.l*.82);
    glowCtx.clearRect(0,0,512,256);
    const glow=glowCtx.createRadialGradient(256,118,3,256,118,220);
    glow.addColorStop(0,hsl(tone.h,tone.s,.62,.36)); glow.addColorStop(.27,hsl(tone.h,tone.s,.56,.18)); glow.addColorStop(1,hsl(tone.h,tone.s,.48,0));
    glowCtx.fillStyle=glow; glowCtx.fillRect(0,0,512,256); glowTexture.needsUpdate=true;
    vctx.clearRect(0,0,1024,1024);
    const tint=vctx.createRadialGradient(470,438,45,512,512,510);
    tint.addColorStop(0,hsl(tone.h,tone.s*.85,.78,.38));
    tint.addColorStop(.44,hsl(tone.h,tone.s,.62,.53));
    tint.addColorStop(.72,hsl(tone.h,tone.s,.61,.49));
    tint.addColorStop(.85,hsl(tone.h,tone.s*.65,.76,.30));
    tint.addColorStop(.96,hsl(tone.h,tone.s*.35,.83,.14));
    tint.addColorStop(1,hsl(tone.h,tone.s*.24,.90,.07));
    vctx.fillStyle=tint;vctx.fillRect(0,0,1024,1024);
    const sheen=vctx.createLinearGradient(70,80,900,930);
    sheen.addColorStop(0,'rgba(255,255,255,.32)'); sheen.addColorStop(.24,'rgba(255,255,255,.06)');
    sheen.addColorStop(.50,'rgba(255,255,255,0)'); sheen.addColorStop(.77,'rgba(255,255,255,.09)'); sheen.addColorStop(1,'rgba(20,20,20,.08)');
    vctx.fillStyle=sheen;vctx.fillRect(0,0,1024,1024);
    for(let i=0;i<90;i++){const r=185+i*3.5;vctx.beginPath();vctx.arc(512,512,r,0,Math.PI*2);vctx.lineWidth=i%5===0?1:.5;vctx.strokeStyle=i%5===0?'rgba(255,255,255,.13)':'rgba(22,22,22,.07)';vctx.stroke();}
    vinylTexture.needsUpdate=true;
  }
  function artworkTint(img) {
    const sample=document.createElement('canvas'); sample.width=48; sample.height=48;
    const c=sample.getContext('2d',{willReadFrequently:true});
    c.drawImage(img,0,0,48,48); const pixels=c.getImageData(0,0,48,48).data;
    const bins=new Map();
    for(let i=0;i<pixels.length;i+=4){
      if(pixels[i+3]<96)continue;
      const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255;
      const hi=Math.max(r,g,b),lo=Math.min(r,g,b),delta=hi-lo,lum=(hi+lo)/2;
      if(lum<.10 || (lum>.94 && delta<.12))continue;
      const sat=delta===0?0:delta/(1-Math.abs(2*lum-1));
      let hue=0;if(delta){if(hi===r)hue=((g-b)/delta)%6;else if(hi===g)hue=(b-r)/delta+2;else hue=(r-g)/delta+4;hue=(hue/6+1)%1;}
      // Group similar hues so a busy photo still yields a stable dominant color.
      const key=sat<.13?'neutral':Math.floor(hue*24);
      const weight=(.35+.65*sat)*(.65+.35*(1-Math.abs(lum-.5)*2));
      const entry=bins.get(key)||{weight:0,x:0,y:0,s:0,l:0,neutral:key==='neutral'};
      entry.weight+=weight;entry.x+=Math.cos(hue*2*Math.PI)*weight;entry.y+=Math.sin(hue*2*Math.PI)*weight;entry.s+=sat*weight;entry.l+=lum*weight;bins.set(key,entry);
    }
    let best=null; for(const entry of bins.values())if(!best||entry.weight>best.weight)best=entry;
    if(!best)return defaultTint;
    const hue=(Math.atan2(best.y,best.x)/(2*Math.PI)+1)%1;
    return {h:hue,s:best.neutral?0:Math.max(.16,Math.min(.76,best.s/best.weight)),l:Math.max(.49,Math.min(.67,best.l/best.weight))};
  }
  tintScene(defaultTint);
  const center=mat(0x242426,.48,.12);
  cylinder(.98,.035,center,0,0,.045,record);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=512;const lctx=labelCanvas.getContext('2d');
  const labelTexture=new THREE.CanvasTexture(labelCanvas);labelTexture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Mesh(new THREE.CircleGeometry(.70,96),new THREE.MeshBasicMaterial({map:labelTexture}));label.position.z=.069;record.add(label);
  function defaultLabel(){lctx.fillStyle='#28292a';lctx.fillRect(0,0,512,512);lctx.strokeStyle='rgba(205,202,186,.13)';lctx.lineWidth=2;[145,170,195].forEach(r=>{lctx.beginPath();lctx.arc(256,256,r,0,Math.PI*2);lctx.stroke();});labelTexture.needsUpdate=true;}
  defaultLabel();cylinder(.07,.10,steel,0,0,.10,record);
  cylinder(.025,.12,black,0,0,.155,record);
  // Cantilever arm rests on a black pivot at the lower left, like the reference.
  cylinder(.19,.12,black,-4.92,-2.64,.13);cylinder(.105,.15,graphite,-4.92,-2.64,.24);
  const arm=new THREE.Group();arm.position.set(-4.92,-2.64,.37);machine.add(arm);
  const armPath=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.20,.17,.015),new THREE.Vector3(1.04,1.03,.02),new THREE.Vector3(1.90,1.90,0)]);
  arm.add(new THREE.Mesh(new THREE.TubeGeometry(armPath,40,.045,10,false),graphite));
  const head=new THREE.Mesh(new THREE.BoxGeometry(.27,.38,.13),black);head.position.set(.10,.12,.01);head.rotation.z=-.72;arm.add(head);
  // Compact, layered black mechanism at the upper right of the platter.
  const hardware=mat(0x171819,.48,.2), hardware2=mat(0x292b2b,.5,.25);
  rounded(.92,1.10,.04,.09,hardware,.03,2.00,.04);
  rounded(.42,1.05,.02,.10,hardware2,.34,1.86,.13);
  rounded(.48,.21,.015,.10,hardware,-.45,2.26,.10);
  rounded(.48,.12,.015,.10,hardware,-.45,1.98,.10);
  rounded(.50,.12,.015,.10,hardware,-.45,1.72,.10);
  // A small silver bridge sits against the black motor, catching the warm light.
  rounded(.42,.17,.02,.10,steel,-.44,1.38,.13);
  // A compact smoked-glass readout and separate machined controls make the
  // entire composition a single physical instrument, not an app panel.
  const displayX=2.92, displayY=1.85, displayW=4.15, displayH=1.22;
  const bezel=mat(0x252727,.3,.45), controlMetal=mat(0x8f9794,.27,.72), buttonDark=mat(0x242727,.38,.48);
  rounded(displayW+.17,displayH+.17,.10,.10,bezel,displayX,displayY,.07);
  rounded(displayW,displayH,.065,.025,mat(0x0b1111,.24,.1),displayX,displayY,.18);
  const display=document.createElement('canvas');display.width=1200;display.height=340;
  const ctx=display.getContext('2d'); const texture=new THREE.CanvasTexture(display); texture.colorSpace=THREE.SRGBColorSpace;
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(displayW-.12,displayH-.10),new THREE.MeshBasicMaterial({map:texture}));panel.position.set(displayX,displayY,.29);machine.add(panel);
  let data={selected:'spotify',sources:{},track:{},error:'',alwaysOnTop:false};let handler=()=>{};let lastArt='',imageRequest=0,seekPreview=null;
  function round(ctx,x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
  function text(ctx,value,x,y,font,color,limit){ctx.fillStyle=color;ctx.font=font;ctx.textBaseline='alphabetic';const s=String(value||'');if(!limit||ctx.measureText(s).width<=limit){ctx.fillText(s,x,y);return;}let t=s;while(t.length&&ctx.measureText(t+'…').width>limit)t=t.slice(0,-1);ctx.fillText(t+'…',x,y);}
  function format(n){n=Math.max(0,Math.floor(Number(n)||0));const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=String(n%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${s}`:`${m}:${s}`;}
  function face(w,h,pixelsW,pixelsH,x,y,z){
    const c=document.createElement('canvas');c.width=pixelsW;c.height=pixelsH;
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));m.position.set(x,y,z);machine.add(m);return {canvas:c,ctx:c.getContext('2d'),texture:t,mesh:m};
  }
  const labelLayer=face(4.25,2.9,1200,820,2.92,-.52,.48);
  const lc=labelLayer.ctx;
  // Two raised input keys, separate from the display.
  rounded(1.55,.43,.07,.10,buttonDark,1.86,.62,.19);
  rounded(1.55,.43,.07,.10,buttonDark,3.69,.62,.19);
  cylinder(.19,.13,buttonDark,4.91,.62,.19);
  // Metal-backed transport buttons: rim, dark inset and a subtly luminous centre.
  for(const [x,r] of [[1.86,.26],[2.92,.39],[3.98,.26]]){
    cylinder(r+.055,.12,controlMetal,x,-.29,.15);
    cylinder(r,.13,buttonDark,x,-.29,.23);
  }
  const playLight=cylinder(.335,.035,new THREE.MeshStandardMaterial({color:0xd1b54c,roughness:.32,metalness:.18,emissive:0x302710,emissiveIntensity:.15}),2.92,-.29,.32);
  // A recessed groove and a movable metal carriage make seeking tactile.
  rounded(3.82,.16,.08,.03,buttonDark,2.92,-1.40,.12);
  rounded(3.70,.033,.016,.012,mat(0x7e8580,.4,.5),2.92,-1.40,.165);
  const seekCarriage=rounded(.10,.30,.04,.07,controlMetal,1.07,-1.40,.20);
  const hitMeshes=[];
  function hitBox(action,x,y,w,h){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    m.position.set(x,y,.8);m.userData.action=action;machine.add(m);hitMeshes.push(m);return m;
  }
  hitBox('spotify',1.86,.62,1.66,.60);hitBox('music',3.69,.62,1.66,.60);hitBox('pin',4.91,.62,.52,.60);
  hitBox('previous',1.86,-.29,.70,.76);hitBox('playPause',2.92,-.29,.94,.94);hitBox('next',3.98,-.29,.70,.76);
  const seekHit=hitBox('seek',2.92,-1.40,3.70,.45);
  function drawIcon(ctx,name,x,y,color){
    ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=4;ctx.lineCap='round';
    if(name==='play'){ctx.beginPath();ctx.moveTo(x-9,y-16);ctx.lineTo(x+16,y);ctx.lineTo(x-9,y+16);ctx.closePath();ctx.fill();}
    else if(name==='pause'){round(ctx,x-13,y-17,9,34,2,color);round(ctx,x+4,y-17,9,34,2,color);}
    else if(name==='previous'||name==='next'){const d=name==='previous'?-1:1;ctx.beginPath();ctx.moveTo(x-d*11,y-15);ctx.lineTo(x+d*9,y);ctx.lineTo(x-d*11,y+15);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(x+d*16,y-15);ctx.lineTo(x+d*16,y+15);ctx.stroke();}
    else if(name==='pin'){ctx.save();ctx.translate(x,y);ctx.rotate(.7);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-9,-11);ctx.lineTo(9,-11);ctx.lineTo(6,-1);ctx.lineTo(11,4);ctx.lineTo(-11,4);ctx.lineTo(-6,-1);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(0,15);ctx.stroke();ctx.restore();}
  }
  function draw(){
    const track=data.track||{},ready=!!(track.running&&track.title),playing=ready&&!!track.playing;
    ctx.clearRect(0,0,1200,340);ctx.fillStyle='#111716';ctx.fillRect(0,0,1200,340);
    const accent=hsl(currentTint.h,currentTint.s,.76);
    ctx.fillStyle=accent;ctx.beginPath();ctx.arc(56,55,8,0,Math.PI*2);ctx.fill();
    text(ctx,ready?(playing?'正在播放':'已暂停'):'等待播放',78,66,'500 30px -apple-system, BlinkMacSystemFont, sans-serif','#b9c6be',1000);
    text(ctx,ready?track.title:'还没有播放音乐',48,164,'600 62px -apple-system, BlinkMacSystemFont, sans-serif','#edf4ed',1100);
    text(ctx,ready?(track.artist||'未知艺术家'):`打开 ${data.selected==='music'?'Apple Music':'Spotify'}，播放一首歌。`,48,224,'400 36px -apple-system, BlinkMacSystemFont, sans-serif','#aebcb3',1100);
    const pos=Math.max(0,seekPreview??(Number(track.position)||0)),duration=Math.max(0,Number(track.duration)||0),pct=duration?Math.max(0,Math.min(1,pos/duration)):0;
    text(ctx,format(pos),48,298,'500 28px -apple-system, BlinkMacSystemFont, sans-serif','#9aaea5');
    const end=format(duration);ctx.font='500 28px -apple-system, BlinkMacSystemFont, sans-serif';text(ctx,end,1150-ctx.measureText(end).width,298,'500 28px -apple-system, BlinkMacSystemFont, sans-serif','#9aaea5');
    if(data.error){
      ctx.fillStyle='#111716';ctx.fillRect(32,85,1136,235);ctx.fillStyle='#ffbd9f';ctx.font='400 34px -apple-system, BlinkMacSystemFont, sans-serif';
      let line='',y=135;
      for(const ch of Array.from(String(data.error))){if(ch==='\n'||ctx.measureText(line+ch).width>1090){ctx.fillText(line,48,y);line=ch==='\n'?'':ch;y+=48;if(y>279)break;}else line+=ch;}
      if(line&&y<=279)ctx.fillText(line,48,y);
    }

    texture.needsUpdate=true;
    // Printing sits on the keys themselves; symbols move with the controls.
    lc.clearRect(0,0,1200,820);
    const sourceY=96;
    text(lc,'Spotify',233,sourceY,'600 34px -apple-system, BlinkMacSystemFont, sans-serif',data.selected==='spotify'?'#f8f6e9':'#a8b0ac',300);
    text(lc,'Apple Music',727,sourceY,'600 34px -apple-system, BlinkMacSystemFont, sans-serif',data.selected==='music'?'#f8f6e9':'#a8b0ac',340);
    lc.beginPath();lc.arc(138,84,6,0,Math.PI*2);lc.fillStyle=data.sources?.spotify?.running?accent:'#727977';lc.fill();
    lc.beginPath();lc.arc(650,84,6,0,Math.PI*2);lc.fillStyle=data.sources?.music?.running?accent:'#727977';lc.fill();
    drawIcon(lc,'pin',1164,84,data.alwaysOnTop?accent:'#bac1ba');
    // Coordinates here correspond to the physical key and button centres.
    drawIcon(lc,'previous',302,342,ready?'#e7e9df':'#777e79');
    drawIcon(lc,playing?'pause':'play',600,342,'#151b19');
    drawIcon(lc,'next',900,342,ready?'#e7e9df':'#777e79');
    labelLayer.texture.needsUpdate=true;
    seekCarriage.position.x=1.07+3.70*pct;
    playLight.material.color.setHSL(currentTint.h,currentTint.s*.65,ready?.70:.38);
  }
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let playing=false,angle=0,frame=0,last=0;
  let tintFrame=0;
  function transitionTint(target){
    if(tintFrame)cancelAnimationFrame(tintFrame);
    const start={...currentTint}, began=performance.now();
    if(reduced.matches){tintScene(target);draw();schedule();return;}
    let lastStep=-1;
    const step=now=>{
      const progress=Math.min(1,(now-began)/450), index=Math.floor(progress*14);
      if(index!==lastStep){
        lastStep=index; const t=progress*progress*(3-2*progress);
        const dh=((target.h-start.h+1.5)%1)-.5;
        tintScene({h:(start.h+dh*t+1)%1,s:start.s+(target.s-start.s)*t,l:start.l+(target.l-start.l)*t});draw();schedule();
      }
      tintFrame=progress<1?requestAnimationFrame(step):0;
    };
    tintFrame=requestAnimationFrame(step);
  }
  function schedule(){if(!frame){last=performance.now();frame=requestAnimationFrame(render);}}
  function render(now){frame=0;const dt=Math.min((now-last)/1000,.08);last=now;if(playing&&!reduced.matches)angle+=dt*2*Math.PI/1.8;record.rotation.z=-angle;const target=playing?-.16:0;if(reduced.matches)arm.rotation.z=target;else arm.rotation.z+=(target-arm.rotation.z)*Math.min(dt*3,1);renderer.render(scene,camera);if((playing&&!reduced.matches)||Math.abs(target-arm.rotation.z)>.001)frame=requestAnimationFrame(render);}
  function resize(){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height,false);const aspect=rect.width/rect.height,height=Math.max(9.2,13.7/aspect);camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();schedule();}
  new ResizeObserver(resize).observe(canvas);reduced.addEventListener('change',schedule);
  const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let dragging=false;
  function intersections(e,targets=hitMeshes){const rect=canvas.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);ray.setFromCamera(mouse,camera);return ray.intersectObjects(targets,false);}
  function hit(e){return intersections(e)[0]||null;}
  function previewSeek(e){const duration=Number(data.track?.duration)||0,match=intersections(e,[seekHit])[0];if(duration>0&&match){seekPreview=Math.max(0,Math.min(1,match.uv.x))*duration;draw();schedule();}}
  canvas.addEventListener('pointermove',e=>{if(dragging){previewSeek(e);return;}canvas.style.cursor=hit(e)?'pointer':'default';});
  canvas.addEventListener('pointerdown',e=>{const match=hit(e),target=match?.object.userData.action;if(!target)return;const track=data.track||{},ready=!!(track.running&&track.title);if(target==='spotify'||target==='music')handler('source',target);else if(target==='pin')handler('pin');else if(target==='seek'&&ready&&Number(track.duration)>0){dragging=true;canvas.setPointerCapture(e.pointerId);previewSeek(e);}else if(ready&&['previous','playPause','next'].includes(target))handler(target);});
  canvas.addEventListener('pointerup',e=>{if(!dragging)return;previewSeek(e);dragging=false;const value=seekPreview;seekPreview=null;if(value!==null)handler('seek',value);});
  canvas.addEventListener('pointercancel',()=>{dragging=false;seekPreview=null;draw();schedule();});
  window.turntable={onAction(fn){handler=typeof fn==='function'?fn:()=>{};},update(next){
    data=next||data;const track=data.track||{};const nextPlaying=!!(track.running&&track.title&&track.playing);if(playing!==nextPlaying){playing=nextPlaying;schedule();}
    const url=track.running&&track.title?track.artworkUrl||'':'';if(url!==lastArt){lastArt=url;const token=++imageRequest;if(!url){defaultLabel();transitionTint(defaultTint);}else {const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{if(token!==imageRequest)return;try{const n=Math.min(img.width,img.height);lctx.clearRect(0,0,512,512);lctx.drawImage(img,(img.width-n)/2,(img.height-n)/2,n,n,0,0,512,512);labelTexture.needsUpdate=true;try{transitionTint(artworkTint(img));}catch(_){transitionTint(defaultTint);}draw();schedule();}catch(_){defaultLabel();transitionTint(defaultTint);draw();schedule();}};img.onerror=()=>{if(token===imageRequest){defaultLabel();transitionTint(defaultTint);draw();schedule();}};img.src=url;}}
    draw();schedule();
  }};
  draw();resize();
})();
