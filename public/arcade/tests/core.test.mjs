import test from 'node:test';
import assert from 'node:assert/strict';
import {snakeStep,mergeLine,moveMerge,mergeHasMoves,makeMines,revealMines,ticWinner,ticAI,dropConnect,connectWinner,connectAI,slideMove,slideSolved,makeSlide,toggleLights,sudokuAllowed,countSudoku,makeSudoku,angleDistance} from '../core.js';
import {gameDefinitions} from '../games.js';
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

test('snake grows on food, collides with walls and can enter a vacated tail cell',()=>{
  const state=[{x:2,y:1},{x:1,y:1},{x:1,y:2},{x:2,y:2}];
  const grew=snakeStep(state,{x:1,y:0},{x:3,y:1},5,5);assert.equal(grew.ate,true);assert.equal(grew.snake.length,5);
  const tail=snakeStep(state,{x:0,y:1},{x:4,y:4},5,5);assert.equal(tail.dead,false);assert.equal(tail.snake.length,4);
  assert.equal(snakeStep([{x:0,y:0}],{x:-1,y:0},{x:4,y:4},5,5).dead,true);
  assert.equal(snakeStep(state,{x:-1,y:0},{x:4,y:4},5,5).dead,true);
});
test('merge joins each source tile once and respects all four directions',()=>{
  assert.deepEqual(mergeLine([2,2,2,2]),{line:[4,4,0,0],score:8});
  assert.deepEqual(mergeLine([4,0,4,8]),{line:[8,8,0,0],score:8});
  const board=[2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  assert.deepEqual(moveMerge(board,'right').board.slice(0,4),[0,0,0,4]);
  assert.equal(moveMerge(board,'down').board[12],2);assert.equal(moveMerge(board,'down').board[13],2);
  assert.equal(moveMerge([2,4,8,16,4,8,16,32,8,16,32,64,16,32,64,128],'up').changed,false);
  assert.equal(mergeHasMoves([2,4,8,16,4,8,16,32,8,16,32,64,16,32,64,128]),false);
});
test('mine fields protect the first reveal neighborhood and reveal floods avoid bombs',()=>{
  for(let seed=1;seed<=30;seed++){
    const board=makeMines(9,9,10,40,random(seed));assert.equal(board.filter(n=>n===-1).length,10);assert.equal(board[40],0);
    for(const i of [30,31,32,39,40,41,48,49,50])assert.notEqual(board[i],-1);
    const revealed=revealMines(board,new Set(),new Set([0]),40,9,9);assert.equal(revealed.has(0),false);for(const i of revealed)assert.notEqual(board[i],-1);
  }
});
test('perfect tic-tac-toe takes wins and blocks losses',()=>{
  assert.equal(ticAI([2,2,0,1,1,0,0,0,0]),2);assert.equal(ticAI([1,1,0,0,2,0,0,0,0]),2);
  assert.equal(ticWinner([1,2,1,2,1,2,1,0,0]).winner,1);
  function allHumanPaths(board){const outcome=ticWinner(board);if(outcome){assert.notEqual(outcome.winner,1);return;}for(let i=0;i<9;i++)if(!board[i]){const next=[...board];next[i]=1;const humanEnd=ticWinner(next);if(humanEnd){assert.notEqual(humanEnd.winner,1);continue;}next[ticAI(next)]=2;allHumanPaths(next);}}
  allHumanPaths(Array(9).fill(0));
});
test('connect four respects gravity, all win directions, and forced tactical moves',()=>{
  let board=Array(42).fill(0);for(const c of [0,1,2])board=dropConnect(board,c,2).board;assert.equal(connectAI(board,4),3);
  board=Array(42).fill(0);for(const c of [0,1,2])board=dropConnect(board,c,1).board;assert.equal(connectAI(board,4),3);
  board=Array(42).fill(0);for(let i=0;i<4;i++)board=dropConnect(board,5,1).board;assert.equal(connectWinner(board).winner,1);
  board=Array(42).fill(0);for(let i=0;i<4;i++)board[(5-i)*7+i]=2;assert.equal(connectWinner(board).winner,2);
  board=Array(42).fill(0);for(let i=0;i<6;i++)board=dropConnect(board,0,1).board;assert.equal(dropConnect(board,0,2),null);
});
test('sliding puzzles remain solvable and reject illegal moves',()=>{
  const solved=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0];assert.equal(slideMove(solved,0),null);
  assert.equal(slideSolved(slideMove(slideMove(solved,14),15)),true);
  for(let seed=1;seed<=100;seed++){const board=makeSlide(4,200,random(seed));assert.equal(slideSolved(board),false);assert.equal(new Set(board).size,16);let inversions=0;const values=board.filter(Boolean);for(let i=0;i<15;i++)for(let j=i+1;j<15;j++)if(values[i]>values[j])inversions++;const blankRowFromBottom=4-Math.floor(board.indexOf(0)/4);assert.equal((inversions+blankRowFromBottom)%2,1);}
});
test('lights switches affect orthogonal neighbors and are reversible',()=>{
  const board=Array(25).fill(false);const center=toggleLights(board,12);assert.deepEqual(center.map((v,i)=>v?i:-1).filter(i=>i>=0),[7,11,12,13,17]);
  assert.deepEqual(toggleLights(center,12),board);assert.equal(toggleLights(board,0).filter(Boolean).length,3);
});
test('sudoku creates unique puzzles with valid full solutions',()=>{
  for(let seed=1;seed<=20;seed++){const {puzzle,solution}=makeSudoku(random(seed));assert.equal(countSudoku(puzzle),1);assert.ok(puzzle.filter(Boolean).length>=38);assert.ok(puzzle.filter(Boolean).length<60);assert.equal(new Set(solution.slice(0,9)).size,9);for(let i=0;i<81;i++)assert.equal(sudokuAllowed(solution,i,solution[i]),true);}
});
test('orbit timing distance wraps around and all 16 game definitions have rules',()=>{
  assert.ok(angleDistance(.1,Math.PI*2-.1)<.21);assert.ok(angleDistance(0,Math.PI)>3.14);assert.equal(Object.keys(gameDefinitions).length,16);for(const game of Object.values(gameDefinitions)){assert.ok(game.name);assert.ok(game.rules.length>100);}
});
