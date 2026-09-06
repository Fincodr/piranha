import {readFileSync} from 'node:fs';
import {Game as BaseGame} from '../src/game.js';
import {CollisionMasks} from '../src/collision.js';
export const atlas=JSON.parse(readFileSync(new URL('../assets/atlas.json',import.meta.url)));
export const masks=new CollisionMasks(atlas,readFileSync(new URL('../assets/collision.bin',import.meta.url)));
export class Game extends BaseGame {
 constructor(onEvent){super(onEvent,masks);}
}
