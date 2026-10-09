// Pure game rules. Browser rendering lives in games.js.
export const shuffle = (items, random = Math.random) => { const out = [...items]; for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; };
export function snakeStep(snake, direction, food, width, height) {
  const head={x:snake[0].x+direction.x,y:snake[0].y+direction.y};
  const ate=head.x===food.x&&head.y===food.y;
  const body=ate?snake:snake.slice(0,-1);
  if(head.x<0||head.y<0||head.x>=width||head.y>=height||body.some(p=>p.x===head.x&&p.y===head.y))return {snake,ate:false,dead:true};
  return {snake:[head,...snake].slice(0,snake.length+(ate?1:0)),ate,dead:false};
}
export function mergeLine(line) {
  const values=line.filter(Boolean),merged=[]; let score=0;
  for(let i=0;i<values.length;i++){if(values[i]===values[i+1]){const v=values[i]*2;merged.push(v);score+=v;i++;}else merged.push(values[i]);}
  while(merged.length<line.length)merged.push(0);
  return {line:merged,score};
}
export function moveMerge(board, direction, size=4) {
  const result=[...board];let score=0;
  for(let line=0;line<size;line++){
    let indices=Array.from({length:size},(_,i)=>direction==='left'||direction==='right'?line*size+i:i*size+line);
    if(direction==='right'||direction==='down')indices.reverse();
    const moved=mergeLine(indices.map(i=>board[i]));score+=moved.score;indices.forEach((idx,i)=>result[idx]=moved.line[i]);
  }
  return {board:result,score,changed:result.some((v,i)=>v!==board[i])};
}
export function mergeHasMoves(board,size=4) {return board.some((v,i)=>!v||(i%size<size-1&&v===board[i+1])||(i<size*(size-1)&&v===board[i+size]));}
export const neighbors=(index,width,height)=>{const x=index%width,y=Math.floor(index/width),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<width&&ny<height)out.push(ny*width+nx);}return out;};
export function makeMines(width,height,count,safeIndex,random=Math.random) {
  const protectedCells=new Set([safeIndex,...neighbors(safeIndex,width,height)]);
  const choices=shuffle(Array.from({length:width*height},(_,i)=>i).filter(i=>!protectedCells.has(i)),random);
  const mines=new Set(choices.slice(0,count));
  return Array.from({length:width*height},(_,i)=>mines.has(i)?-1:neighbors(i,width,height).filter(n=>mines.has(n)).length);
}
export function revealMines(cells,revealed,flagged,index,width,height) {
  const out=new Set(revealed);const pending=[index];while(pending.length){const i=pending.pop();if(out.has(i)||flagged.has(i))continue;out.add(i);if(cells[i]===0)for(const n of neighbors(i,width,height))if(cells[n]>=0&&!out.has(n))pending.push(n);}return out;
}
const threeLines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export function ticWinner(board) {for(const line of threeLines)if(board[line[0]]&&line.every(i=>board[i]===board[line[0]]))return {winner:board[line[0]],line};return board.every(Boolean)?{winner:3,line:[]}:null;}
export function ticAI(board,player=2) {
  function search(state,turn,depth){const end=ticWinner(state);if(end)return end.winner===player?10-depth:end.winner===3?0:depth-10;const scores=[];state.forEach((v,i)=>{if(!v){const next=[...state];next[i]=turn;scores.push(search(next,turn===1?2:1,depth+1));}});return turn===player?Math.max(...scores):Math.min(...scores);}
  let best=-Infinity,choice=-1;board.forEach((v,i)=>{if(!v){const next=[...board];next[i]=player;const s=search(next,player===1?2:1,0);if(s>best){best=s;choice=i;}}});return choice;
}
export function dropConnect(board,column,player,cols=7,rows=6) {const out=[...board];for(let row=rows-1;row>=0;row--){const i=row*cols+column;if(!out[i]){out[i]=player;return {board:out,index:i};}}return null;}
export function connectWinner(board,cols=7,rows=6) {for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const p=board[r*cols+c];if(!p)continue;for(const [dc,dr]of[[1,0],[0,1],[1,1],[1,-1]]){const indices=[];for(let n=0;n<4;n++){const x=c+dc*n,y=r+dr*n;if(x<0||x>=cols||y<0||y>=rows)break;indices.push(y*cols+x);}if(indices.length===4&&indices.every(i=>board[i]===p))return {winner:p,line:indices};}}return board.every(Boolean)?{winner:3,line:[]}:null;}
export function connectAI(board,depth=4) {
  const order=[3,2,4,1,5,0,6];
  const evaluate=state=>{let score=0;for(let r=0;r<6;r++)for(let c=0;c<7;c++){if(c===3)score+=state[r*7+c]===2?6:state[r*7+c]===1?-6:0;for(const[dc,dr]of[[1,0],[0,1],[1,1],[1,-1]]){let a=0,b=0,n=0;for(let k=0;k<4;k++){const x=c+dc*k,y=r+dr*k;if(x<0||x>=7||y<0||y>=6)break;n++;if(state[y*7+x]===2)a++;if(state[y*7+x]===1)b++;}if(n!==4||a&&b)continue;score+=a?[0,1,8,60,50000][a]:-[0,1,9,75,50000][b];}}return score;};
  function search(state,d,turn,alpha,beta){const end=connectWinner(state);if(end)return end.winner===2?100000+d:end.winner===1?-100000-d:0;if(!d)return evaluate(state);let best=turn===2?-Infinity:Infinity;for(const c of order){const next=dropConnect(state,c,turn);if(!next)continue;const val=search(next.board,d-1,turn===2?1:2,alpha,beta);if(turn===2){best=Math.max(best,val);alpha=Math.max(alpha,best);}else{best=Math.min(best,val);beta=Math.min(beta,best);}if(alpha>=beta)break;}return best;}
  let best=-Infinity,column=-1;for(const c of order){const next=dropConnect(board,c,2);if(next){const val=search(next.board,depth-1,1,-Infinity,Infinity);if(val>best){best=val;column=c;}}}return column;
}
export function slideMove(board,index,size=4) {const empty=board.indexOf(0);const x=index%size,y=Math.floor(index/size),ex=empty%size,ey=Math.floor(empty/size);if(Math.abs(x-ex)+Math.abs(y-ey)!==1)return null;const out=[...board];[out[index],out[empty]]=[out[empty],out[index]];return out;}
export const slideSolved=board=>board.every((v,i)=>v===(i===board.length-1?0:i+1));
export function makeSlide(size=4,moves=200,random=Math.random){let board=Array.from({length:size*size},(_,i)=>(i+1)%(size*size)),last=-1;for(let m=0;m<moves;m++){const empty=board.indexOf(0),options=[];for(let i=0;i<board.length;i++)if(i!==last&&slideMove(board,i,size))options.push(i);const choice=options[Math.floor(random()*options.length)];last=empty;board=slideMove(board,choice,size);}return slideSolved(board)?makeSlide(size,moves,random):board;}
export function toggleLights(board,index,size=5) {const out=[...board],x=index%size,y=Math.floor(index/size);for(const[dx,dy]of[[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<size&&ny>=0&&ny<size)out[ny*size+nx]=!out[ny*size+nx];}return out;}
export function sudokuAllowed(board,index,value){const row=Math.floor(index/9),col=index%9,br=Math.floor(row/3)*3,bc=Math.floor(col/3)*3;for(let i=0;i<81;i++){if(i===index)continue;const r=Math.floor(i/9),c=i%9;if((r===row||c===col||r>=br&&r<br+3&&c>=bc&&c<bc+3)&&board[i]===value)return false;}return true;}
export function countSudoku(board,limit=2){let count=0;const state=[...board];function solve(){if(count>=limit)return;let choice=-1,options=[];for(let i=0;i<81;i++)if(!state[i]){const allowed=[];for(let v=1;v<=9;v++)if(sudokuAllowed(state,i,v))allowed.push(v);if(!allowed.length)return;if(choice===-1||allowed.length<options.length){choice=i;options=allowed;if(allowed.length===1)break;}}if(choice===-1){count++;return;}for(const value of options){state[choice]=value;solve();state[choice]=0;if(count>=limit)return;}}solve();return count;}
export function makeSudoku(random=Math.random){const bands=shuffle([0,1,2],random),stacks=shuffle([0,1,2],random),rows=bands.flatMap(b=>shuffle([0,1,2],random).map(r=>b*3+r)),cols=stacks.flatMap(b=>shuffle([0,1,2],random).map(c=>b*3+c)),numbers=shuffle([1,2,3,4,5,6,7,8,9],random);const solution=rows.flatMap(r=>cols.map(c=>numbers[(r*3+Math.floor(r/3)+c)%9]));const puzzle=[...solution];for(const i of shuffle(Array.from({length:81},(_,i)=>i),random)){if(puzzle.filter(Boolean).length<=38)break;const value=puzzle[i];puzzle[i]=0;if(countSudoku(puzzle)!==1)puzzle[i]=value;}return {puzzle,solution};}
export const angleDistance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
export const clamp=(n,low,high)=>Math.min(high,Math.max(low,n));
