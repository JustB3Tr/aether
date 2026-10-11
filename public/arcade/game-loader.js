export {gameDefinitions} from './game-definitions.js?v=5.5.1&build=551a';
import {gameDefinitions} from './game-definitions.js?v=5.5.1&build=551a';

// Definitions are tiny. Only the selected renderer family downloads at launch.
export async function startGame(id, ctx) {
  if (!Object.hasOwn(gameDefinitions,id)) throw new Error('Unknown Aether Original');
  if (!ctx.active) return;
  let factory;
  if (['railrush','ricochet','skybound'].includes(id)) factory=(await import('./games-kinetic.js?v=5.5.1&build=551a')).kineticGames[id];
  else if (id === 'driftline') factory=(await import('./driftline-game.js?v=5.5.1&build=551a')).driftline;
  else if (id === 'pulsearena') factory=(await import('./pulse-arena-game.js?v=5.5.1&build=551a')).pulsearena;
  else if (id === 'breach' || id === 'overdrive') factory=(await import('./games-action.js?v=5.5.1&build=551a')).actionGames[id];
  else if (id === 'stack' || id === 'typerush') factory=(await import('./games-extra.js?v=5.5.1&build=551a')).extraGames[id];
  else {
    const classic=await import('./games.js?v=5.5.1&build=551a');
    factory=context=>classic.startGame(id,context);
  }
  if (ctx.active && !ctx.ended) return factory(ctx);
}
