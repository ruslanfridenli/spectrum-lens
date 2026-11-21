const I18N = {
  en: { start:"Start microphone", privacy:"Audio is processed locally in your browser — nothing is recorded or uploaded.",
    sens:"Sensitivity", smooth:"Smoothing", waveform:"Waveform overlay", peaks:"Peak hold", dominant:"Dominant" },
  de: { start:"Mikrofon starten", privacy:"Audio wird lokal in deinem Browser verarbeitet — nichts wird aufgezeichnet oder hochgeladen.",
    sens:"Empfindlichkeit", smooth:"Glättung", waveform:"Wellenform-Overlay", peaks:"Peak-Hold", dominant:"Dominante" }
};
let lang = localStorage.getItem('sl-lang') || 'en';
const t = k => I18N[lang][k] || k;
function applyLang(){
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i]').forEach(el => el.textContent = t(el.dataset.i));
  document.querySelectorAll('.lang button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
}
document.querySelectorAll('.lang button').forEach(b => b.onclick = () => { lang=b.dataset.lang; localStorage.setItem('sl-lang',lang); applyLang(); });

const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
let W,H, analyser=null, data=null, wave=null, stream=null, raf=null;
const peaksHold = new Float32Array(1024);

function resize(){ const r=cv.parentElement.getBoundingClientRect(); W=cv.width=r.width*devicePixelRatio; H=cv.height=r.height*devicePixelRatio; }
addEventListener('resize', resize); resize();

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function freqToNote(f){
  if (f<=0) return '—';
  const n = 69 + 12*Math.log2(f/440);
  const name = NOTE_NAMES[((Math.round(n)%12)+12)%12];
  const oct = Math.floor(n/12)-1;
  return `${name}${oct}`;
}

async function start(){
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:false, noiseSuppression:false } });
  } catch(e){ alert(lang==='de' ? 'Mikrofonzugriff verweigert.' : 'Microphone access denied.'); return; }
  const ac = new (window.AudioContext||window.webkitAudioContext)();
  const src = ac.createMediaStreamSource(stream);
  analyser = ac.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.75;
  src.connect(analyser);
  data = new Uint8Array(analyser.frequencyBinCount);
  wave = new Uint8Array(analyser.fftSize);
  document.getElementById('start').style.display='none';
  draw();
}
document.getElementById('go').onclick = start;
document.getElementById('smooth').oninput = e => { if(analyser) analyser.smoothingTimeConstant = +e.target.value; };

const BARS = 96;
function draw(){
  raf = requestAnimationFrame(draw);
  analyser.getByteFrequencyData(data);
  analyser.getByteTimeDomainData(wave);
  const sens = +document.getElementById('sens').value;
  ctx.fillStyle='#05070c'; ctx.fillRect(0,0,W,H);

  const barW = W/BARS;
  let maxV=0, maxF=0;
  const nyq = analyser.context.sampleRate/2;
  for (let i=0;i<BARS;i++){
    // log-spaced bin
    const f0 = 30 * Math.pow(nyq/30, i/BARS);
    const f1 = 30 * Math.pow(nyq/30, (i+1)/BARS);
    const b0 = Math.floor(f0/(nyq/data.length)), b1 = Math.max(b0+1, Math.floor(f1/(nyq/data.length)));
    let v=0; for(let b=b0;b<b1&&b<data.length;b++) v=Math.max(v,data[b]);
    v = Math.min(1, v/255*sens);
    if (v>maxV){maxV=v; maxF=(f0+f1)/2;}
    const h = v*(H*0.72);
    const hue = 190 + (i/BARS)*120;
    const grad = ctx.createLinearGradient(0,H-h,0,H);
    grad.addColorStop(0,`hsla(${hue},90%,60%,.9)`); grad.addColorStop(1,`hsla(${hue},90%,50%,.15)`);
    ctx.fillStyle = grad;
    ctx.fillRect(i*barW+1, H-h-40, barW-2, h);
    // peak hold
    if (document.getElementById('peaks').checked){
      peaksHold[i] = Math.max(peaksHold[i]-0.004, v);
      ctx.fillStyle='rgba(255,255,255,.55)';
      ctx.fillRect(i*barW+1, H-peaksHold[i]*(H*0.72)-40, barW-2, 2);
    }
  }
  // freq labels
  ctx.fillStyle='#6d80a3'; ctx.font='10px ui-monospace,monospace';
  [50,100,250,500,1000,2500,5000,10000].forEach(f=>{
    const x = (Math.log(f/30)/Math.log(nyq/30))*W;
    if (x>0&&x<W){ ctx.fillText(f>=1000?(f/1000)+'k':f, x, H-8); }
  });
  // waveform
  if (document.getElementById('wave').checked){
    ctx.beginPath();
    const step = Math.floor(wave.length/W);
    for (let x=0;x<W;x++){
      const y = (wave[x*step]/128-1)*(H*0.14);
      x===0?ctx.moveTo(x,H*0.92+y):ctx.lineTo(x,H*0.92+y);
    }
    ctx.strokeStyle='rgba(177,140,255,.8)'; ctx.lineWidth=1.5; ctx.stroke();
  }
  document.getElementById('note').textContent = maxV>0.08 ? freqToNote(maxF) : '—';
  document.getElementById('freq').textContent = maxF>0 ? `${Math.round(maxF)} Hz` : '';
}
applyLang();
