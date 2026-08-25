(()=>{
"use strict";
const FPS=60,PREVIEW_SECONDS=20,$=s=>document.querySelector(s);
const canvas=$("#canvas"),ctx=canvas.getContext("2d",{alpha:false}),audioInput=$("#audioInput"),artist=$("#artist"),title=$("#title"),styleSelect=$("#styleSelect"),formatSelect=$("#formatSelect"),playBtn=$("#playPreview"),muteBtn=$("#mutePreview"),exportBtn=$("#exportButton"),status=$("#status"),empty=$("#emptyState"),progress=$("#previewProgress"),previewTime=$("#previewTime"),fileLabel=$("#fileLabel");
const formats={vertical:{w:1080,h:1920},portrait:{w:1080,h:1350},square:{w:1080,h:1080},landscape:{w:1920,h:1080}};
let audioCtx=null,buffer=null,analyser=null,source=null,gain=null,playing=false,muted=false,currentStyle="spectrum",animationId=0;
function audioEngine(){if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error("Web Audio no disponible");audioCtx=new AC()}return audioCtx}
function fmt(s){s=Math.max(0,Math.floor(s));return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`}
function setStatus(t){status.textContent=t}
function fit(){const f=formats[formatSelect.value];canvas.width=f.w;canvas.height=f.h;draw(performance.now(),.08)}
function seeded(n){const x=Math.sin(n*12.9898)*43758.5453;return x-Math.floor(x)}
function matrix(t,intensity=1){const w=canvas.width,h=canvas.height,fs=Math.max(14,Math.round(Math.min(w,h)*.022));ctx.font=`600 ${fs}px monospace`;ctx.textAlign="center";const cols=Math.ceil(w/(fs*1.35));for(let i=0;i<cols;i++){const speed=.08+seeded(i+3)*.18,y=((t*speed*fs*1.8+seeded(i+8)*h)%(h+fs))-fs,rows=5+Math.floor(seeded(i+11)*10);for(let r=0;r<rows;r++){const yy=y-r*fs*1.15;if(yy<-fs||yy>h)continue;const a=(.02+.055*seeded(i*19+r))*intensity;ctx.fillStyle=`rgba(0,151,255,${a})`;ctx.fillText(String.fromCharCode(48+Math.floor(seeded(i*7+r)*10)),i*fs*1.35+fs/2,yy)}}}
function background(t,e){const w=canvas.width,h=canvas.height,g=ctx.createRadialGradient(w*.5,h*.42,0,w*.5,h*.48,Math.max(w,h)*.75);g.addColorStop(0,"#071c32");g.addColorStop(.45,"#030b15");g.addColorStop(1,"#010308");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);matrix(t,.9+e*.7);const glow=ctx.createRadialGradient(w*.5,h*.55,0,w*.5,h*.55,Math.min(w,h)*.42);glow.addColorStop(0,`rgba(0,126,255,${.04+e*.06})`);glow.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=glow;ctx.fillRect(0,0,w,h)}
function textLayer(){const w=canvas.width,h=canvas.height,cx=w/2,cy=h*.43,base=Math.min(w,h),a=(artist.value||"ARTISTA").trim().toUpperCase(),b=(title.value||"TÍTULO DE LA CANCIÓN").trim().toUpperCase();ctx.textAlign="center";ctx.shadowColor="#66c9ff";ctx.shadowBlur=18;ctx.fillStyle="#f4fbff";ctx.font=`800 ${Math.max(24,base*.055)}px Arial`;ctx.fillText(a,cx,cy);ctx.shadowBlur=12;ctx.fillStyle="#13a4ff";ctx.font=`600 ${Math.max(15,base*.027)}px Arial`;ctx.fillText(b,cx,cy+Math.max(30,base*.07));ctx.shadowBlur=0}
function spectrum(e,t){const w=canvas.width,h=canvas.height,cx=w/2,base=Math.min(w,h),floor=h*.73,count=64,maxWidth=Math.min(w*.74,base*1.15),gap=Math.max(2,base*.0045),bw=(maxWidth-gap*(count-1))/count;ctx.save();ctx.lineCap="round";for(let i=0;i<count;i++){const wave=.22+.78*Math.abs(Math.sin(i*.73+t*.0024)),edge=Math.sin(i/count*Math.PI),bh=Math.max(base*.012,base*(.025+e*.22*wave*edge)),x=cx-maxWidth/2+i*(bw+gap),y=floor-bh,grad=ctx.createLinearGradient(0,y,0,floor);grad.addColorStop(0,"#c5efff");grad.addColorStop(.25,"#35b8ff");grad.addColorStop(1,"#0077ff");ctx.fillStyle=grad;ctx.shadowColor="#078cff";ctx.shadowBlur=8;ctx.fillRect(x,y,bw,bh)}ctx.shadowBlur=0;ctx.strokeStyle="rgba(27,165,255,.55)";ctx.lineWidth=Math.max(1,base*.002);ctx.beginPath();ctx.moveTo(cx-maxWidth/2,floor+2);ctx.lineTo(cx+maxWidth/2,floor+2);ctx.stroke();ctx.restore()}
function wave(e,t){const w=canvas.width,h=canvas.height,base=Math.min(w,h),y=h*.7;ctx.save();ctx.lineWidth=Math.max(2,base*.006);ctx.lineCap="round";for(let k=0;k<3;k++){ctx.beginPath();for(let x=0;x<=w;x+=8){const amp=base*(.025+k*.007)+e*base*(.11-k*.018),yy=y+(k-1)*base*.065+Math.sin(x*.014+t*.006+k)*amp;x?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.strokeStyle=k===1?"#bdefff":"rgba(0,135,255,.65)";ctx.shadowColor="#078cff";ctx.shadowBlur=15;ctx.stroke()}ctx.restore()}
function particles(e,t){const w=canvas.width,h=canvas.height,cx=w/2,base=Math.min(w,h);ctx.save();for(let i=0;i<180;i++){const a=seeded(i)*Math.PI*2+t*.00025*(.5+seeded(i+4)),r=base*(.16+seeded(i+9)*.27)+e*base*.1,x=cx+Math.cos(a)*r,y=h*.64+Math.sin(a)*r*.35;ctx.fillStyle=i%9===0?"#d6f5ff":"rgba(14,151,255,.65)";ctx.shadowColor="#078cff";ctx.shadowBlur=8;ctx.beginPath();ctx.arc(x,y,Math.max(1,base*.003*(.7+e*2)),0,Math.PI*2);ctx.fill()}ctx.restore()}
function minimal(e){const w=canvas.width,h=canvas.height,base=Math.min(w,h);ctx.save();ctx.translate(w/2,h*.69);ctx.strokeStyle="#0b9aff";ctx.shadowColor="#0b9aff";ctx.shadowBlur=24;ctx.lineWidth=Math.max(3,base*.008);const r=base*(.13+e*.035);ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,-Math.PI/2+Math.PI*2*(.22+e*.7));ctx.stroke();ctx.strokeStyle="rgba(255,255,255,.25)";ctx.lineWidth=Math.max(1,base*.002);ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,-Math.PI/2+Math.PI*2);ctx.stroke();ctx.restore()}
function draw(t,e){background(t,e);textLayer();if(currentStyle==="spectrum")spectrum(e,t);if(currentStyle==="wave")wave(e,t);if(currentStyle==="particles")particles(e,t);if(currentStyle==="minimal")minimal(e,t)}
function energy(){if(!analyser)return .08;const d=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(d);let sum=0;for(const v of d)sum+=v;return Math.min(1,sum/d.length/255*2.1)}
function stop(){if(source){try{source.stop()}catch{}try{source.disconnect()}catch{}}if(gain){try{gain.disconnect()}catch{}}source=null;gain=null;playing=false;cancelAnimationFrame(animationId);progress.style.width="0%";previewTime.textContent="0:00 / 0:10";playBtn.textContent="▶"}
async function preview(){if(!buffer)return;stop();const ac=audioEngine();await ac.resume();analyser=ac.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.72;source=ac.createBufferSource();source.buffer=buffer;gain=ac.createGain();gain.gain.value=muted?0:1;source.connect(analyser);analyser.connect(gain);gain.connect(ac.destination);source.onended=()=>{if(playing){playing=false;playBtn.textContent="▶"}};source.start(0);playing=true;playBtn.textContent="■";const start=performance.now();const loop=now=>{if(!playing)return;const elapsed=(now-start)/1000;if(elapsed>=PREVIEW_SECONDS){stop();draw(now,.08);return}draw(now,energy());progress.style.width=`${elapsed/PREVIEW_SECONDS*100}%`;previewTime.textContent=`${fmt(elapsed)} / 0:20`;animationId=requestAnimationFrame(loop)};animationId=requestAnimationFrame(loop)}
function download(blob){const url=URL.createObjectURL(blob),a=document.createElement("a"),name=(title.value||"music-visualizer").replace(/[^\w\- ]/g,"").trim()||"music-visualizer";a.href=url;a.download=`${name}.webm`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
async function exportVideo(){
  if(!buffer)return;

  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC||!HTMLCanvasElement.prototype.captureStream||!window.MediaRecorder){
    setStatus("Este navegador no ofrece la captura WEBM necesaria. Usa Chrome o Edge de escritorio.");
    return;
  }

  stopPlayback();
  exportBtn.disabled=true;
  exportBtn.classList.add("exporting");
  if(exportFill) exportFill.style.width="0%";
  if(exportProgress) exportProgress.style.width="0%";

  const f=formats[formatSelect.value];
  canvas.width=f.w;
  canvas.height=f.h;

  const ac=new AC();
  await ac.resume();

  const src=ac.createBufferSource();
  src.buffer=buffer;

  const an=ac.createAnalyser();
  an.fftSize=1024;
  an.smoothingTimeConstant=.72;

  const audioDest=ac.createMediaStreamDestination();
  src.connect(an);
  an.connect(audioDest);

  const videoStream=canvas.captureStream(FPS);
  const stream=new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks()
  ]);

  const mimeTypes=[
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  const mime=mimeTypes.find(m=>MediaRecorder.isTypeSupported(m));

  if(!mime){
    setStatus("WEBM no está disponible. Usa Chrome o Edge de escritorio.");
    stream.getTracks().forEach(t=>t.stop());
    await ac.close();
    exportBtn.disabled=false;
    exportBtn.classList.remove("exporting");
    return;
  }

  const chunks=[];
  const recorder=new MediaRecorder(stream,{
    mimeType:mime,
    videoBitsPerSecond:12000000,
    audioBitsPerSecond:192000
  });

  recorder.ondataavailable=e=>{
    if(e.data && e.data.size) chunks.push(e.data);
  };

  const stopped=new Promise(resolve=>recorder.addEventListener("stop",resolve,{once:true}));
  const duration=buffer.duration;
  let startedAt=0;
  let rafId=0;

  function render(now){
    if(!startedAt) startedAt=now;
    const elapsed=Math.min(duration,(now-startedAt)/1000);
    const pct=Math.round((elapsed/duration)*100);

    draw(now,readEnergy());
    setStatus(`EXPORTANDO WEBM · ${pct}% · ${fmtTime(elapsed)} / ${fmtTime(duration)}`);

    if(elapsed<duration){
      rafId=requestAnimationFrame(render);
    }
  }

  setStatus(`EXPORTANDO WEBM · 0% · 0:00 / ${fmtTime(duration)}`);
  recorder.start(250);

  src.addEventListener("ended",()=>{
    cancelAnimationFrame(rafId);
    draw(performance.now(),0.08);
    setStatus(`EXPORTANDO WEBM · 100% · ${fmtTime(duration)} / ${fmtTime(duration)}`);
    // Let MediaRecorder flush its last chunk.
    setTimeout(()=>{ if(recorder.state!=="inactive") recorder.stop(); },350);
  },{once:true});

  src.start(0);
  rafId=requestAnimationFrame(render);

  // Safety timeout in case an unusual browser never fires "ended".
  setTimeout(()=>{
    if(recorder.state!=="inactive"){
      cancelAnimationFrame(rafId);
      draw(performance.now(),0.08);
      recorder.stop();
    }
  },(duration+3)*1000);

  await stopped;

  stream.getTracks().forEach(t=>t.stop());
  try{await ac.close()}catch{}

  const blob=new Blob(chunks,{type:mime});
  downloadBlob(blob);

  setStatus(`LISTO · 100% · ${f.w}×${f.h} · WEBM · ${(blob.size/1048576).toFixed(1)} MB`);
  exportBtn.disabled=false;
  exportBtn.classList.remove("exporting");
  fitCanvasForFormat();
}

audioInput.addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{const ac=audioEngine();await ac.resume();buffer=await ac.decodeAudioData(await file.arrayBuffer());fileLabel.textContent=file.name.length>27?file.name.slice(0,24)+"…":file.name;empty.style.display="none";playBtn.disabled=false;muteBtn.disabled=false;exportBtn.disabled=false;setStatus(`Audio listo · ${fmt(buffer.duration)} · elige formato y exporta.`);fit()}catch(err){console.error(err);setStatus("No pude leer ese archivo. Prueba con un MP3 o WAV estándar.")}});
artist.addEventListener("input",()=>draw(performance.now(),.08));title.addEventListener("input",()=>draw(performance.now(),.08));styleSelect.addEventListener("change",()=>{currentStyle=styleSelect.value;draw(performance.now(),.08)});formatSelect.addEventListener("change",fit);playBtn.addEventListener("click",()=>playing?stop():preview());muteBtn.addEventListener("click",()=>{muted=!muted;muteBtn.textContent=muted?"○":"◉";if(gain)gain.gain.value=muted?0:1});fit();draw(performance.now(),.08);
})();
