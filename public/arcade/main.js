import { gameDefinitions, startGame } from './games.js?v=5.0.0';

const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const id=Object.hasOwn(gameDefinitions,query.get('game'))?query.get('game'):'snake';
const game=gameDefinitions[id];
document.title=game.name+' | Aether Originals';
$('title').textContent=game.name;$('description').textContent=game.description;$('genre').textContent=game.category+' / AETHER ORIGINALS';$('rules').textContent=game.rules;
$('scoreLabel').textContent=game.scoreLabel||'Score';$('bestLabel').textContent=game.bestLabel||'Personal best';

const storageKey='aether.arcade.'+id;
let stored={best:null,rounds:0,wins:0};
const validStats=value=>value&&typeof value==='object'&&Number.isFinite(value.best)&&value.best>=0;
try{const value=JSON.parse(localStorage.getItem(storageKey));if(validStats(value))stored={best:value.best,rounds:Math.max(0,Number(value.rounds)||0),wins:Math.max(0,Number(value.wins)||0)};}catch{}
let soundEnabled=false;
try{soundEnabled=localStorage.getItem('aether.arcade.sound')==='on';}catch{}
let audio=null,paused=false,activeContext=null,raf=0,lastTime=0,tasks=[],listeners=[],gameOver=false,elapsed=0;
const formatScore=value=>game.format?game.format(value):String(Math.round(value));
const renderBest=()=>{$('best').textContent=stored.best===null?'–':game.bestFormat?game.bestFormat(stored.best):formatScore(stored.best);};renderBest();
const saveStats=()=>{try{localStorage.setItem(storageKey,JSON.stringify(stored));}catch{}if(parent!==window)parent.postMessage({type:'gp-save',key:storageKey,value:stored,requestId:'arcade-'+id+'-'+Date.now()},location.origin);};
function tone(frequency=420,duration=.075){if(!soundEnabled)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();void audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(.055,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch{}}
function updateSound(){$('sound').textContent=soundEnabled?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(soundEnabled));}updateSound();
$('sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;try{localStorage.setItem('aether.arcade.sound',soundEnabled?'on':'off');}catch{}updateSound();tone();});
function setPaused(value){const changed=paused!==value;paused=value;$('pauseLayer').hidden=!value;$('pause').textContent=value?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(value));lastTime=0;if(changed){if(value)activeContext?.onPause?.();else activeContext?.onResume?.();}}
$('pause').addEventListener('click',()=>setPaused(!paused));$('resume').addEventListener('click',()=>setPaused(false));
document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='p'&&!/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)){event.preventDefault();setPaused(!paused);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!gameOver)setPaused(true);});
window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin||!event.data||event.data.type!=='gp-init')return;
  let remote=event.data.saves?.[storageKey];try{if(typeof remote==='string')remote=JSON.parse(remote);}catch{return;}
  if(validStats(remote)){const better=stored.best===null||(game.lowerBest?remote.best<stored.best:remote.best>stored.best);stored={best:better?remote.best:stored.best,rounds:Math.max(stored.rounds,Number(remote.rounds)||0),wins:Math.max(stored.wins,Number(remote.wins)||0)};try{localStorage.setItem(storageKey,JSON.stringify(stored));}catch{}renderBest();}
});
if(parent!==window)parent.postMessage({type:'gp-ready',game:id},location.origin);
for(const link of document.querySelectorAll('a[href="/#games"]'))link.addEventListener('click',event=>{if(parent===window)return;event.preventDefault();parent.postMessage({type:'aether-arcade-exit',game:id},location.origin);});

function runFrame(time){raf=requestAnimationFrame(runFrame);const dt=lastTime?Math.min((time-lastTime)/1000,.06):0;lastTime=time;if(paused)return;elapsed+=dt;const due=tasks.filter(task=>task.time<=elapsed);tasks=tasks.filter(task=>task.time>elapsed);for(const task of due)task.fn();activeContext?.frame?.(dt,elapsed);}
function listen(target,event,handler,options){const wrapped=e=>{if(!paused)handler(e);};target.addEventListener(event,wrapped,options);listeners.push(()=>target.removeEventListener(event,wrapped,options));return wrapped;}
function start(){cancelAnimationFrame(raf);for(const remove of listeners)remove();listeners=[];tasks=[];elapsed=0;lastTime=0;gameOver=false;setPaused(false);$('board').replaceChildren();$('controls').replaceChildren();$('score').textContent=formatScore(0);$('status').textContent='Your move.';
  const ctx={board:$('board'),controls:$('controls'),game,id,frame:null,get ended(){return gameOver;},get elapsed(){return elapsed;},listen,tone,status:text=>{if($('status').textContent!==text)$('status').textContent=text;},score:value=>{const text=formatScore(value);if($('score').textContent!==text)$('score').textContent=text;},after:(seconds,fn)=>{tasks.push({time:elapsed+seconds,fn});},cancelTasks:()=>{tasks=[];},button:(text,handler,options={})=>{const button=document.createElement('button');button.type='button';button.textContent=text;if(options.label)button.setAttribute('aria-label',options.label);if(options.primary)button.className='primary';listen(button,'click',handler);(options.parent||$('controls')).append(button);return button;},record:(score,extra={})=>{if(!Number.isFinite(score)||score<0)return;stored.rounds++;if(extra.won)stored.wins++;if(stored.best===null||(game.lowerBest?score<stored.best:score>stored.best))stored.best=score;renderBest();saveStats();if(parent!==window)parent.postMessage({type:'aether-arcade-result',game:id,score,won:Boolean(extra.won),stats:extra},location.origin);},finish:(message,score,extra={})=>{if(gameOver)return;gameOver=true;$('status').textContent=message;if(Number.isFinite(score))ctx.record(score,extra);tone(extra.won?740:180,.18);const banner=document.createElement('div');banner.className='result-banner';banner.textContent=message;ctx.board.append(banner);ctx.button('Play again',start,{primary:true});}};
  activeContext=ctx;startGame(id,ctx);raf=requestAnimationFrame(runFrame);
}
$('restart').addEventListener('click',start);start();
