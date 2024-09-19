// spell-checker:ignore Deno

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Adapt } from '../dist/esm/lib/XDG.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { XDG } from '../dist/types/mod.d.ts';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { adapter } from './platform-adapters/deno.deno.ts';

const _: XDG = Adapt(adapter).XDG;

export type { XDG };
export default _;
