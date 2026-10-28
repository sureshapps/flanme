// Decode once so seeking works even on hosts without HTTP byte-range support.
class ChromeScore {
  constructor(url) {
    this.data=fetch(url).then(r=>{if(!r.ok)throw Error('Score unavailable');return r.arrayBuffer()}).catch(()=>null);
    this.context=null;this.buffer=null;this.source=null;this.enabled=false;this.origin=0;
  }
  async enable() {
    if(!this.context){
      this.context=new (window.AudioContext||window.webkitAudioContext)();
      this.gain=this.context.createGain();this.gain.gain.value=.75;this.gain.connect(this.context.destination);
    }
    // Resume inside the click gesture, before waiting for the downloaded score.
    await this.context.resume();
    if(!this.buffer){const data=await this.data;if(!data)throw Error('Score unavailable');this.buffer=await this.context.decodeAudioData(data.slice(0));}
    this.enabled=true;
  }
  stop(){if(this.source){const old=this.source;this.source=null;old.onended=null;old.stop();old.disconnect();}}
  mute(){this.enabled=false;this.stop();}
  sync(time,playing){
    if(!this.enabled||!playing||!this.buffer||time>=this.buffer.duration){this.stop();return;}
    if(this.source&&Math.abs(this.context.currentTime-this.origin-time)<.12)return;
    this.stop();
    const source=this.context.createBufferSource();source.buffer=this.buffer;source.connect(this.gain);
    this.source=source;this.origin=this.context.currentTime-time;
    source.onended=()=>{if(this.source===source)this.source=null;source.disconnect()};
    source.start(0,Math.max(0,time));
  }
}
