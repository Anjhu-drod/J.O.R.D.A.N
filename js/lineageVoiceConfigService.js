import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firestore } from "./firebaseService.js";

const REF = doc(firestore, "lineageConfig", "voice");
export const DEFAULT_SHARED_VOICE_TUNING = Object.freeze({ speed:1, pitch:0, brightness:0, energy:1, expressiveness:1 });

function sanitize(data = {}) {
  const clamp = (v,min,max,fallback) => { const n=Number(v); return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback; };
  return {
    speed: clamp(data.speed,.80,1.35,1),
    pitch: clamp(data.pitch,-3,4,0),
    brightness: clamp(data.brightness,-.35,.45,0),
    energy: clamp(data.energy,.65,1.35,1),
    expressiveness: clamp(data.expressiveness,.55,1.50,1)
  };
}

export class LineageVoiceConfigService {
  constructor(){ this.current={...DEFAULT_SHARED_VOICE_TUNING}; this.unsubscribe=null; }
  async load(){ try { const snap=await getDoc(REF); if(snap.exists()) this.current=sanitize(snap.data()); } catch{} return this.current; }
  subscribe(callback){ this.unsubscribe?.(); this.unsubscribe=onSnapshot(REF,snap=>{ this.current=snap.exists()?sanitize(snap.data()):{...DEFAULT_SHARED_VOICE_TUNING}; callback?.(this.current); },()=>callback?.(this.current)); return ()=>this.unsubscribe?.(); }
  async save(tuning,{creatorId="jhuan"}={}){ const next=sanitize(tuning); await setDoc(REF,{...next,owner:creatorId,updatedAt:serverTimestamp()},{merge:true}); this.current=next; return next; }
}
export const lineageVoiceConfigService = new LineageVoiceConfigService();
