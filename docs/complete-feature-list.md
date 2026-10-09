# Pixel Farm — Phase 3: Full Feature Roadmap

Your current game already has the foundation for a pixel-art farming
simulator: an island map, a central farmhouse, crop plots, trees,
currency, day progression, and navigation for features such as the
Market, Barn, Crafting, Orders, and Fishing.

**Phase 3 should turn this map into a complete farming and production
game.** The key is to connect every new feature into one gameplay loop
instead of implementing fishing, animals, buildings, achievements, and
deliveries as separate systems.

For example:

Plant wheat → harvest wheat → mill it into flour → use flour to bake
bread → fulfill a delivery order → earn coins and XP → unlock a dairy
building → produce milk and cheese → complete achievements for
additional rewards.

The following plan is designed to expand your existing game without
rebuilding the systems that already work.

## 1. The complete feature list

### 1. Fishing system

- Fishing spots, ponds, or a shoreline interaction.
- Fishing rod, bait, bite timing, and catch mechanics.
- Common, uncommon, rare, and legendary fish.
- Fish inventory, market selling, cooking, and delivery orders.
- Fishing experience, collection records, and unlockable rods.

### 2. Expanded crops and orchards

- **Vegetables:** tomato, potato, carrot, corn, cabbage, pumpkin.
- **Fruits:** strawberry, blueberry, watermelon, grapes.
- **Fruit trees:** apple, mango, banana, orange, and pear.
- Crop growth stages, seasonal or level-based unlocks, harvesting, and
  regrowth where appropriate.
- Seeds, saplings, water requirements, yield, and crop quality.
- Fruits and crops usable in recipes, animal feed, and deliveries.

### 3. Animal farms and livestock

- Chickens produce eggs; cows produce milk; sheep produce wool.
- Goats produce goat milk; pigs can support a later breeding or
  livestock system.
- Animal purchasing, feeding, happiness, health, and production timers.
- Hay, grain, and mixed feed as resources.
- Barn, coop, and pasture capacity upgrades.
- Animal products become ingredients for recipes and orders.

### 4. Production buildings and crafting chains

- **Feed Mill:** convert crops into animal feed.
- **Grain Mill:** convert wheat and corn into flour or meal.
- **Dairy:** turn milk into butter, cheese, cream, and yogurt.
- **Bakery:** make bread, cakes, and pies.
- **Juice Press:** make fruit juice.
- **Jam Kitchen:** make jam and preserves.
- **Kitchen:** prepare meals, soups, and fish dishes.
- Buildings have recipes, input/output inventories, production
  durations, and upgrade levels.

### 5. Delivery orders and contracts

- Customers request specific quantities of crops, fish, animal products,
  or processed goods.
- Rewards include coins, XP, reputation, and occasional bonus items.
- Orders have deadlines, difficulty levels, and optional bonus
  objectives.
- Order board with available, active, completed, and expired states.
- Bulk contracts, recurring requests, and special event orders unlocked
  later.

### 6. Achievements, progression, and rewards

- Harvesting milestones, fishing collections, animal production, and
  crafting mastery.
- Delivery streaks, building upgrades, and total earnings.
- XP, player levels, coins, seeds, decorations, and unlockable recipes.
- Daily tasks, milestone rewards, and collection completion bonuses.
- Achievement notifications and a dedicated achievements screen.

## 2. Additional systems worth including

These systems connect the major features and give players a reason to
keep playing.

### Farm progression and land expansion

Unlock new plots, orchard space, fishing areas, animal pens, and
production zones through coins, XP, and milestones. Keep expansion tied
to the existing island map.

### Inventory and storage

Shared inventory for harvested goods, fish, animal products, feed,
crafted goods, seeds, and building materials. Add storage capacity
upgrades and clear insufficient-space warnings.

### Daily gameplay and events

Daily missions, rotating customer requests, limited-time harvest goals,
and seasonal events. Make rewards optional bonuses rather than mandatory
chores.

### Economy and balancing

Give every item a consistent selling price, ingredient cost, production
time, XP reward, and unlock requirement. Processed goods should
generally provide more value than raw goods, while accounting for time
and input costs.

### Save system and persistence

Persist player progress, coins, day, inventory, crop timers, animals,
production queues, orders, achievements, and building upgrades.
Reloading the game must not reset progress or duplicate rewards.

## 3. Recommended building and product unlock list

Use this as the initial content catalogue. Unlock levels and prices
should be adjusted to your existing economy after inspecting the code.

| Building or area | Main inputs                  | Main outputs                  |
|------------------|------------------------------|-------------------------------|
| Farm plots       | Seeds, water                 | Crops                         |
| Orchard          | Saplings, time               | Fruits                        |
| Fishing spot     | Rod, optional bait           | Fish                          |
| Chicken coop     | Grain/feed                   | Eggs                          |
| Cowshed          | Animal feed                  | Milk                          |
| Sheep pen        | Animal feed                  | Wool                          |
| Goat shelter     | Animal feed                  | Goat milk                     |
| Feed Mill        | Wheat, corn                  | Animal feed                   |
| Grain Mill       | Wheat, corn                  | Flour, cornmeal               |
| Dairy            | Milk                         | Cheese, butter, cream, yogurt |
| Bakery           | Flour, eggs, milk            | Bread, cakes, pies            |
| Juice Press      | Fruit                        | Juice                         |
| Jam Kitchen      | Fruit, sugar                 | Jam, preserves                |
| Kitchen          | Crops, fish, animal products | Meals                         |
| Market           | Sellable inventory           | Coins                         |
| Delivery Depot   | Requested goods              | Coins, XP, reputation         |
| Warehouse        | Coins or materials           | More storage capacity         |

**Recommended implementation order:** fishing and new crops first, then
inventory and recipes, then animals and their feed chain, followed by
delivery orders and achievements. Add the buildings as the production
systems they support become available.

This sequence lets you test a complete gameplay loop early rather than
building many empty screens.
