import type * as Phaser from 'phaser';
import type { RecipeDef } from '@core/entities/content';
import type { AnimalState } from '@core/entities/types';
import type { GameSession } from '@core/GameSession';
import { jobProgress } from '@core/systems/productionQueue';
import { animalTextureKey } from '../../art/ExtraArtist';
import { formatDuration, formatMoney } from '../format';
import { iconImage } from '../icons';
import { itemIconKey } from '../itemIcons';
import { slotRow } from '../rows';
import { iconKey } from '../uiTextures';
import { FONT_SIZE, UI_PX, UI_TEXT, uiText } from '../uiTheme';
import { Button } from '../widgets/Button';
import { Dialog } from '../widgets/Dialog';
import { createFrame } from '../widgets/Frame';
import { PagedList } from '../widgets/PagedList';
import { BAR_COLORS, ProgressBar } from '../widgets/ProgressBar';
import type { ToastManager } from '../widgets/ToastManager';

const WIDTH = UI_PX * 250;
const HEIGHT = UI_PX * 196;
const HEADER = UI_PX * 18;
const SLOT = UI_PX * 26;
const SLOT_GAP = UI_PX * 3;
const ROW_HEIGHT = UI_PX * 20;
const ROW_GAP = UI_PX * 2;
const ACTION_HEIGHT = UI_PX * 18;
const UPGRADE_WIDTH = UI_PX * 70;

interface Ctx {
  scene: Phaser.Scene;
  session: GameSession;
  toasts: ToastManager;
  dialog: Dialog;
  objectId: number;
}

/** Opens the panel for a production building or animal housing. */
export function openBuildingDialog(
  scene: Phaser.Scene,
  session: GameSession,
  toasts: ToastManager,
  objectId: number,
): void {
  const object = session.world.get(objectId);
  if (!object || !session.buildings.isBuilding(objectId)) return;
  const name = session.catalog.get(object.itemId).name;
  const dialog = Dialog.open(scene, { title: name, width: WIDTH, height: HEIGHT });
  const ctx: Ctx = { scene, session, toasts, dialog, objectId };
  const header = scene.add.text(0, UI_PX * 2, '', uiText(FONT_SIZE.body));
  const upgrade = new Button(scene, dialog.innerWidth - UPGRADE_WIDTH, 0, {
    width: UPGRADE_WIDTH,
    height: HEADER - UI_PX * 2,
    label: '',
    icon: iconKey('star'),
    iconSize: UI_PX * 7,
    fontSize: FONT_SIZE.small,
    align: 'center',
    onClick: () =>
      report(ctx, session.farm.upgradeBuilding(objectId), `${name} upgraded!`, iconKey('star')),
  });
  const construction = scene.add
    .text(dialog.innerWidth / 2, dialog.innerHeight / 2, '', {
      ...uiText(FONT_SIZE.title),
      align: 'center',
    })
    .setOrigin(0.5);
  const body = scene.add.container(0, HEADER + UI_PX * 3);
  dialog.content.add([header, upgrade, construction, body]);

  if (session.buildings.def(objectId).role === 'production') buildProduction(ctx, body);
  else buildHousing(ctx, body);

  dialog.onRefresh(() => {
    const { buildings, economy, progression } = session;
    if (!buildings.isBuilding(objectId)) {
      dialog.close();
      return;
    }
    const operational = buildings.isOperational(objectId);
    body.setVisible(operational);
    upgrade.setVisible(operational);
    construction.setVisible(!operational);
    const level = buildings.record(objectId).level;
    if (!operational) {
      header.setText(`Level ${level}`);
      construction.setText(
        `Under construction\n${formatDuration(buildings.constructionRemaining(objectId))} left`,
      );
      return;
    }
    const levelDef = buildings.levelDef(objectId);
    const detail =
      levelDef.slots !== undefined ? `${levelDef.slots} slots` : `room for ${levelDef.capacity}`;
    header.setText(`Level ${level} · ${detail} · speed ×${levelDef.speed}`);
    const next = buildings.nextLevel(objectId);
    if (!next) upgrade.setLabel('Max level').setEnabled(false);
    else if (!progression.isUnlocked(next.unlockLevel)) {
      upgrade.setLabel(`Level ${next.unlockLevel}`).setEnabled(false);
    } else {
      upgrade
        .setLabel(`Upgrade $${formatMoney(next.cost)}`)
        .setEnabled(economy.canAfford(next.cost));
    }
  });
}

function report(
  ctx: Ctx,
  result: { ok: true } | { ok: false; reason: string },
  success: string,
  icon: string,
): void {
  ctx.toasts.show(result.ok ? success : result.reason, {
    icon,
    color: result.ok ? UI_TEXT.gold : UI_TEXT.danger,
  });
  ctx.dialog.refresh();
}

// Queue slots across the top, recipes below.
function buildProduction(ctx: Ctx, body: Phaser.GameObjects.Container): void {
  const { scene, session, dialog, objectId } = ctx;
  const width = dialog.innerWidth;
  const maxSlots = Math.max(...session.buildings.def(objectId).levels.map((l) => l.slots ?? 0));
  const slots = Array.from({ length: maxSlots }, (_, index) => {
    const x = index * (SLOT + SLOT_GAP);
    const frame = createFrame(scene, x, 0, SLOT, SLOT, 'slot');
    const icon = scene.add
      .image(x + SLOT / 2, SLOT / 2 - UI_PX * 2, iconKey('plus'))
      .setScale(UI_PX);
    const bar = new ProgressBar(
      scene,
      x + UI_PX * 3,
      SLOT - UI_PX * 6,
      SLOT - UI_PX * 6,
      UI_PX * 3,
    );
    const time = scene.add
      .text(x + SLOT / 2, SLOT + UI_PX, '', uiText(FONT_SIZE.small, UI_TEXT.muted))
      .setOrigin(0.5, 0);
    body.add([frame, icon, bar, time]);
    return { frame, icon, bar, time };
  });
  const collectWidth = UI_PX * 54;
  const collect = new Button(scene, width - collectWidth, UI_PX * 4, {
    width: collectWidth,
    height: ACTION_HEIGHT,
    label: '',
    icon: iconKey('basket'),
    iconSize: UI_PX * 8,
    align: 'center',
    onClick: () =>
      report(ctx, session.production.collect(objectId), 'Collected!', iconKey('basket')),
  });
  body.add(collect);

  const listY = SLOT + UI_PX * 12;
  const list = new PagedList<RecipeDef>(
    scene,
    0,
    listY,
    width,
    dialog.innerHeight - HEADER - UI_PX * 3 - listY,
    ROW_HEIGHT,
    ROW_GAP,
    (recipe, w, h) => recipeRow(ctx, recipe, w, h),
  );
  body.add(list);
  const redrawRecipes = () => list.setItems(session.production.recipes(objectId));
  redrawRecipes();
  for (const event of [
    'InventoryChanged',
    'ProductionStarted',
    'ProductionCollected',
    'LevelUp',
    'BuildingUpgraded',
  ] as const) {
    dialog.onClose(session.bus.on(event, redrawRecipes));
  }

  dialog.onRefresh(() => {
    if (!session.buildings.isBuilding(objectId)) return;
    const { queue } = session.buildings.record(objectId);
    const unlocked = session.production.slots(objectId);
    const now = session.time.now();
    slots.forEach((slot, index) => {
      const job = queue[index];
      const visible = index < unlocked;
      [slot.frame, slot.icon, slot.bar, slot.time].forEach((o) => o.setVisible(visible));
      if (!visible) return;
      if (!job) {
        slot.icon.setTexture(iconKey('plus')).setScale(UI_PX).setAlpha(0.35);
        slot.bar.setVisible(false);
        slot.time.setText('Empty');
        return;
      }
      const output = Object.keys(session.content.recipes.get(job.recipeId).outputs)[0] ?? '';
      const key = itemIconKey(session.content, output);
      slot.icon.setTexture(key).setAlpha(1);
      slot.icon.setScale(
        Math.max(1, Math.floor((SLOT - UI_PX * 10) / Math.max(slot.icon.width, slot.icon.height))),
      );
      const done = job.endsAt <= now;
      const waiting = job.startsAt > now;
      slot.bar
        .setVisible(!waiting)
        .setProgress(jobProgress(job, now))
        .setColor(done ? BAR_COLORS.xp : BAR_COLORS.grow);
      slot.time.setText(done ? 'Ready!' : waiting ? 'Queued' : formatDuration(job.endsAt - now));
      slot.time.setColor(done ? UI_TEXT.good : UI_TEXT.muted);
    });
    const ready = session.production.readyCount(objectId);
    collect.setLabel(ready > 0 ? `Collect ${ready}` : 'Nothing ready').setEnabled(ready > 0);
  });
}

function recipeRow(ctx: Ctx, recipe: RecipeDef, width: number, height: number) {
  const { session, objectId } = ctx;
  const { content, inventory, progression } = session;
  const [outputId = '', amount = 1] = Object.entries(recipe.outputs)[0] ?? [];
  const locked = !progression.isUnlocked(recipe.unlockLevel);
  const short = Object.entries(recipe.inputs).some(([id, need]) => inventory.count(id) < need);
  const inputs = Object.entries(recipe.inputs)
    .map(([id, need]) => `${need} ${content.items.name(id)} (${inventory.count(id)})`)
    .join(' · ');
  const speed = session.buildings.levelDef(objectId).speed;
  const blocker = session.production.blocker(objectId, recipe.id);
  return slotRow(ctx.scene, width, height, {
    icon: itemIconKey(content, outputId),
    title: `${content.items.name(outputId)} ×${amount} · ${formatDuration(recipe.durationSec / speed)} · +${recipe.xp}xp`,
    subtitle: locked ? `Unlocks at level ${recipe.unlockLevel}` : inputs,
    subtitleColor: locked || short ? UI_TEXT.danger : UI_TEXT.good,
    enabled: !locked,
    actions: [
      {
        label: locked ? 'Locked' : 'Make',
        enabled: blocker === null,
        onClick: () =>
          report(
            ctx,
            session.production.start(objectId, recipe.id),
            `Started ${content.items.name(outputId)}`,
            itemIconKey(content, outputId),
          ),
      },
    ],
  });
}

// Buy / feed / collect actions, then one row per animal with happiness and state.
function buildHousing(ctx: Ctx, body: Phaser.GameObjects.Container): void {
  const { scene, session, dialog, objectId } = ctx;
  const { ranch, content } = session;
  const animal = ranch.animalOf(objectId);
  if (!animal) return;
  const width = dialog.innerWidth;
  const actionWidth = Math.floor((width - UI_PX * 6) / 3 / UI_PX) * UI_PX;
  const action = (index: number, icon: string, onClick: () => void) =>
    new Button(scene, index * (actionWidth + UI_PX * 3), 0, {
      width: actionWidth,
      height: ACTION_HEIGHT,
      label: '',
      icon,
      iconSize: UI_PX * 8,
      fontSize: FONT_SIZE.small,
      align: 'center',
      onClick,
    });
  const product = itemIconKey(content, animal.product);
  const feedIcon = itemIconKey(content, animal.feed);
  const buy = action(0, iconKey('coin'), () =>
    report(ctx, ranch.buyAnimal(objectId), `A new ${animal.name} moved in!`, product),
  );
  const feed = action(1, feedIcon, () => report(ctx, ranch.feedAll(objectId), 'Fed!', feedIcon));
  const collect = action(2, product, () =>
    report(
      ctx,
      ranch.collectAll(objectId),
      `Collected ${content.items.name(animal.product)}!`,
      product,
    ),
  );
  const info = scene.add.text(
    0,
    ACTION_HEIGHT + UI_PX * 3,
    '',
    uiText(FONT_SIZE.small, UI_TEXT.muted),
  );
  body.add([buy, feed, collect, info]);

  const listY = ACTION_HEIGHT + UI_PX * 14;
  const list = new PagedList<AnimalState>(
    scene,
    0,
    listY,
    width,
    dialog.innerHeight - HEADER - UI_PX * 3 - listY,
    ROW_HEIGHT,
    ROW_GAP,
    (state, w, h) => animalRow(ctx, state, w, h),
  );
  body.add(list);

  dialog.onRefresh(() => {
    if (!session.buildings.isBuilding(objectId)) return;
    const animals = ranch.animals(objectId);
    const capacity = ranch.capacity(objectId);
    const hungry = ranch.countByStatus(objectId, 'hungry');
    const ready = ranch.countByStatus(objectId, 'ready');
    const locked = !session.progression.isUnlocked(animal.unlockLevel);
    buy
      .setLabel(
        locked ? `Level ${animal.unlockLevel}` : `${animal.name} $${formatMoney(animal.price)}`,
      )
      .setEnabled(!locked && animals.length < capacity && session.economy.canAfford(animal.price));
    const feedNeed = hungry * animal.feedAmount;
    feed
      .setLabel(`Feed ${hungry}`)
      .setEnabled(hungry > 0 && session.inventory.count(animal.feed) >= animal.feedAmount);
    collect.setLabel(`Collect ${ready}`).setEnabled(ready > 0);
    info.setText(
      `${animals.length}/${capacity} ${animal.name.toLowerCase()}s · ${content.items.name(animal.feed)}: ` +
        `${session.inventory.count(animal.feed)} in barn${feedNeed ? `, ${feedNeed} needed` : ''} · ` +
        `${animal.feedAmount} per meal`,
    );
    list.setItems(
      [...animals],
      `No animals yet. Buy a ${animal.name.toLowerCase()} to get started.`,
    );
  });
}

function animalRow(ctx: Ctx, state: AnimalState, width: number, height: number) {
  const { ranch, content, time } = ctx.session;
  const def = content.animals.get(state.animalId);
  const status = ranch.status(state);
  const happiness = Math.round(ranch.happiness(state));
  const label =
    status === 'hungry'
      ? 'Hungry, needs food'
      : status === 'ready'
        ? `${content.items.name(def.product)} ready!`
        : `Making ${content.items.name(def.product)} · ${formatDuration((state.readyAt ?? 0) - time.now())}`;
  const objects = slotRow(ctx.scene, width, height, {
    icon: animalTextureKey(def.id),
    title: `${def.name} · ${happiness}% happy`,
    subtitle: label,
    subtitleColor:
      status === 'hungry' ? UI_TEXT.danger : status === 'ready' ? UI_TEXT.good : UI_TEXT.muted,
    progress: { value: happiness / 100, color: BAR_COLORS.happy },
  });
  objects.push(iconImage(ctx.scene, iconKey('heart'), width - UI_PX * 10, height / 2, UI_PX * 8));
  return objects;
}
