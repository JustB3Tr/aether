export {gameDefinitions} from './game-definitions.js?v=5.5.0&build=55b';
import {gameDefinitions} from './game-definitions.js?v=5.5.0&build=55b';

// Definitions are tiny. Only the selected renderer family downloads at launch.
export async function startGame(id, ctx) {
  if (!Object.hasOwn(gameDefinitions,id)) throw new Error('Unknown Aether Original');
  if (!ctx.active) return;
  let factory;
  if (['railrush','ricochet','skybound'].includes(id)) factory=(await import('./games-kinetic.js?v=5.5.0&build=55b')).kineticGames[id];
  else if (id === 'driftline') factory=(await import('./driftline-game.js?v=5.5.0&build=55b')).driftline;
  else if (id === 'pulsearena') factory=(await import('./pulse-arena-game.js?v=5.5.0&build=55b')).pulsearena;
  else if (id === 'breach' || id === 'overdrive') factory=(await import('./games-action.js?v=5.5.0&build=55b')).actionGames[id];
  else if (id === 'stack' || id === 'typerush') factory=(await import('./games-extra.js?v=5.5.0&build=55b')).extraGames[id];
  else {
    const classic=await import('./games.js?v=5.5.0&build=55b');
    factory=context=>classic.startGame(id,context);
  }
  if (ctx.active && !ctx.ended) return factory(ctx);
}
