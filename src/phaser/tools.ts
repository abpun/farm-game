import { EventBus } from '@core/events/EventBus';

export type Tool =
  | { kind: 'none' }
  | { kind: 'plant'; cropId: string }
  | { kind: 'build'; itemId: string }
  | { kind: 'remove' }
  /** Move mode: tap to pick something up, then tap where it goes; `rotated` previews a turn. */
  | { kind: 'move'; objectId: number | null; rotated?: boolean };

export const NO_TOOL: Tool = { kind: 'none' };

export interface ToolEvents {
  ToolChanged: { tool: Tool };
}

const sameTool = (a: Tool, b: Tool) => JSON.stringify(a) === JSON.stringify(b);

// What a tap on the farm does right now: inspect/harvest, plant, build, move or remove.
export class ToolState {
  readonly bus = new EventBus<ToolEvents>();
  private current: Tool = NO_TOOL;

  get tool(): Tool {
    return this.current;
  }

  is(tool: Tool): boolean {
    return sameTool(this.current, tool);
  }

  set(tool: Tool): void {
    this.current = tool;
    this.bus.emit('ToolChanged', { tool });
  }

  /** Selecting the active tool again puts it away. */
  toggle(tool: Tool): void {
    this.set(this.is(tool) ? NO_TOOL : tool);
  }

  clear(): void {
    if (this.current.kind !== 'none') this.set(NO_TOOL);
  }
}
