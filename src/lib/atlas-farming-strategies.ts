import { nonceAttr } from "./csp";

type Tier = "S" | "A" | "B" | "C" | "F";

interface StrategyLink {
  label: string;
  url: string;
}

interface StrategyNote {
  text: string;
  url?: string;
}

interface StrategyStep {
  title: string;
  waystone?: string;
  tablets?: string;
}

interface Strategy {
  id: string;
  name: string;
  subtitle?: string;
  tier: Tier;
  recommendedBy?: string;
  difficulty?: number;
  investment?: number;
  rarityNote?: string;
  recommendationNote?: string;
  video?: StrategyLink;
  guide?: StrategyLink;
  atlasTree?: StrategyLink;
  waystone?: string;
  tablets?: string[];
  notes?: StrategyNote[];
  steps?: StrategyStep[];
}

const TIER_META: Record<Tier, { label: string; bg: string; border: string; text: string }> = {
  S: { label: "S Tier", bg: "#85e047", border: "#268e36", text: "#14330d" },
  A: { label: "A Tier", bg: "#e0d447", border: "#cfa91f", text: "#332c05" },
  B: { label: "B Tier", bg: "#e09a47", border: "#cb6b31", text: "#3a2408" },
  C: { label: "C Tier", bg: "#e04747", border: "#b0310f", text: "#ffffff" },
  F: { label: "F Tier", bg: "#43437d", border: "#362758", text: "#ffffff" },
};

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "F"];

// Screenshots of each strategy's Atlas Master passive-tree allocation, cropped from the
// spreadsheet's embedded images and stored at public/atlas-trees/<id>.webp.
const ATLAS_TREE_SCREENSHOT_IDS = new Set([
  "deli-breach-farming",
  "deli-abyss-farming",
  "jackpot-ritual",
  "ritual",
  "tablet-farming",
  "aldurs-saga-hunting",
  "big-boom-expedition",
  "grand-expedition-farming",
  "hilda-logbook-farming",
  "unstable-hiveblood-farming",
  "deli-boss-rush",
  "doryani-deli-farming",
  "deli-splinter-farming",
  "liquid-emotion-farming",
  "abyssal-chests",
  "atziri-boss-rush",
]);

const STRATEGIES: Strategy[] = [
  {
    id: "deli-breach-farming",
    name: "200% Deli Breach Farming",
    tier: "S",
    recommendedBy: "Jado",
    difficulty: 5,
    investment: 4,
    rarityNote: "Rarity is mandatory. Aim for 100-120% Rarity on your gear with this strategy.",
    video: { label: "Vid by Fubgun", url: "https://www.youtube.com/watch?v=tRlH7v8_r4c" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/yx3xvm0w" },
    waystone: "T15 Waystone, 6 Modded and crafted with an Omen of Chaotic Quantity + Chaotic Monsters.",
    tablets: [
      "Breach Tablet\n2-3 Additional Rare monsters\n(and if you can) Rarity/Effectiveness",
      "Breach Tablet\n2-3 Additional Rare monsters\n(and if you can) Rarity/Effectiveness",
      "Breach Tablet\n2-3 Additional Rare monsters\n(and if you can) Rarity/Effectiveness",
      "Wraeclast Besieged Breach Tablet\n4-5 additional Rare monsters",
    ],
    notes: [
      { text: "Run a Delirium Strategy to spawn Grand Mirrors, then run those grand mirrors to spread Delirium fog onto city biomes on your atlas." },
      { text: "Run these Delirium Fog City Biomes for an Extra Tablet Slot thanks to the Atlas Tree node Industrial Improvements." },
      { text: "Catalysts, rings/amulets are currently the best option to spend your hiveblood on through the Genesis Tree. Optimal Tree setup for catalysts as of right now.", url: "https://prnt.sc/8tx3nn6Sfn3f" },
      { text: "Doryanis is another good Atlas Master option for this strategy. I opt for Jados because its a mini \"risk scarab\" from poe1 combined with 20% average inc effect of tablets." },
      { text: "Try and pair any generic juicing modifiers alongside the 2-3 additional rare monsters modifier on your tablets. Monster effectiveness, effectiveness of rare breach monsters and increased rarity of items found would be the best complimentary mods." },
      { text: "2 Rare Mob Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/mk6Wj9eZH6" },
      { text: "3 Rare Mob Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/Md6dzkLqFJ" },
      { text: "3 Rare Mob + Good Second Mod Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/2KXM4LZ0Fk" },
    ],
  },
  {
    id: "tablet-farming",
    name: "Tablet Farming",
    tier: "S",
    recommendedBy: "Jado",
    difficulty: 1,
    investment: 2,
    recommendationNote: "Focus on Mountain/City Biomes for either % inc tablets dropped or a fourth tablet slot.",
    video: { label: "Vid by Farmer", url: "https://www.youtube.com/watch?v=reCGV8Xl51c" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/6349070w" },
    waystone: "T15 Waystone, 6 Mod Corrupted with 90% Waystone Drop Chance.",
    tablets: [
      "Irradiated Tablet\n% Inc quantity of waystones\nmonsters have %inc effectiveness",
      "Irradiated Tablet\n% Inc quantity of waystones\nmonsters have %inc effectiveness",
      "Irradiated Tablet\n% Inc quantity of waystones\nmonsters have %inc effectiveness",
    ],
    notes: [
      { text: "The chance to drop a league mechanic specific tablet drops significantly if you are using that tablet (for example, if you are running an abyss tablet your odds of dropping one is lowered)." },
      { text: "Irradiated tablets add a random league mechanic to your Map - These league mechanics wont have the diminishing returns on tablet drops, creating a random tablet farm for every mechanic in the game." },
      { text: "Run your maps normally, completing all of the random league mechanics that spawn in it. For Ritual you do not need to run the altar, just kill the naturally spawned mobs on it. For temple, complete the circle and open the chest." },
      { text: "Uncrafted or crafted, tablets are expensive and will always be relevant. If you are interested in crafting your tablets for profit, look through this entire spreadsheet to see which tablets strategies run, and sell those when you roll them." },
      { text: "List of all the good Tablet Mods/Combos", url: "https://prnt.sc/Vgdj-qWUgD2c" },
      { text: "Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/9zV5pwj8SK" },
    ],
  },
  {
    id: "lineage-fragment-farming",
    name: "Lineage/Fragment Farming",
    tier: "S",
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/uk41z70w" },
    notes: [
      { text: "This Strategy should be combined with a fast paced mapping strategy to complete your \"inbetween maps\" as fast as possible. My personal recommendation is Deli Boss Rushing, as it sets up your atlas with Grand Mirrors, whilst also having a nice flow of consistent currency." },
      { text: "Great video by XTheFarmerX showing the strategy.", url: "https://www.youtube.com/watch?v=OJWsZpsP3SA" },
      { text: "Chase \"Anomaly Maps\" on the infinite Atlas. Travel out into the fog, searching for red/blue beams, path towards them and complete the maps with the respective setup for each map type below." },
      { text: "Rakiatas Flow and Garukhans Resolve are chase Lineage Gems from Jade Isle and Sacred Reservoir respectively. These are always worth a large chunk of divines, keeping this strategy relevant at all stages of the league." },
      { text: "These Lineage Gems are scaled through 1) Jados passive, Untold Histories and 2) The Atlas Tree Forest Mastery node, with the increased Lineage Gem drop rate selected - when combined with the Mastered Domain unique tablet with the Forest Biome rolled, you can turn every Jade Isle / Sacred Reservoir into a Forest Biome." },
      { text: "Visions of Paradise allows you to run the Sacred Reservoir / Jade Isle maps twice. This should always be used on Sacred Reservoir, and can be used on Jade Isle depending on prices / your preference." },
      { text: "Citadel Bosses drop valuable fragments. These fragments are scaled through waystone drop chance both through your Waystone/Tablets." },
      { text: "When running the map twice thanks to Visions of Paradise, you do not need to use another Mastered domain tablet as the node is now a forest biome." },
    ],
    steps: [
      { title: "Citadel Maps", waystone: "T15 Waystone rolled for 100%+ Waystone Drop Chance", tablets: "3x Any Tablets with % Inc chance of Waystones" },
      { title: "Sacred Reservoir", waystone: "T15 Waystone rolled for 100%+ Waystone Drop Chance", tablets: "1x Visions of Paradise + 1x Forest Mastered Domain" },
      { title: "Jade Isle", waystone: "T15 Waystone rolled for 100%+ Waystone Drop Chance", tablets: "1x Visions of Paradise + 1x Forest Mastered Domain" },
    ],
  },
  {
    id: "deli-splinter-farming",
    name: "200% Deli Splinter Farm",
    tier: "S",
    recommendedBy: "Jado",
    difficulty: 5,
    investment: 5,
    rarityNote: "Aim for atleast 100% Rarity on your gear.",
    video: { label: "Vid by Fubgun", url: "https://www.youtube.com/watch?v=MO8f64VNjzs&t" },
    guide: { label: "Maxroll guide by aer0", url: "https://maxroll.gg/poe2/resources/ritual" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/g6e3bz0h" },
    waystone: "T15 Waystone, HAS TO BE 5 MODS - Then craft with an Omen of Chaotic Rarity, Quantity and Effectiveness simultaneously. Exalt afterwards.",
    tablets: [
      "Delirium Tablet\n(need) % Inc fracturing mirrors, Inc sim splinters,\n(try) % Inc Monster rarity, % Inc rare monsters",
      "Delirium Tablet\n(need) % Inc fracturing mirrors, Inc sim splinters,\n(try) % Inc Monster rarity, % Inc rare monsters",
      "Delirium Tablet\n(need) % Inc fracturing mirrors, Inc sim splinters,\n(try) % Inc Monster rarity, % Inc rare monsters",
      "Delirium Tablet\n(need) % Inc fracturing mirrors, Inc sim splinters,\n(try) % Inc Monster rarity, % Inc rare monsters",
    ],
    notes: [
      { text: "Run this strategy on 200% Delirium City Biome Maps. If you were to run this strategy on non city maps it would be around 40% less loot." },
      { text: "This is a super high investment strategy where you will be investing nearly 10 divines per map for the juicier tablets (frac mirrors, sim splinters and increased number of rare monsters) - full clear the maps." },
      { text: "2 Mod Tablet Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/yYb7n588uR" },
      { text: "3 Mod Tablet Link (Monster Rarity)", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/4m8eW3ekh9" },
      { text: "3 Mod Tablet Link (Inc Number of Rare Monsters)", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/zbXKOk30i4" },
    ],
  },
  {
    id: "deli-abyss-farming",
    name: "200% Deli Abyss Farming",
    tier: "S",
    recommendedBy: "Hilda",
    difficulty: 5,
    investment: 4,
    rarityNote: "Rarity is mandatory. Aim for 100-120% Rarity on your gear with this strategy.",
    video: { label: "Vid by Redviles", url: "https://www.youtube.com/watch?v=1EeuumcYAHM&t" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/q819ek0h" },
    waystone: "T15 Waystone, HAS TO BE 5 MODS - Then craft with an Omen of Chaotic Rarity, Quantity and Effectiveness simultaneously. Exalt afterwards.",
    tablets: [
      "Unforeseen Consequences Abyss Tablet\nMap contains 14-18 additional Abysses",
      "Breach Tablet\nMap has 2 additional Map modifiers",
      "Overseer Tablet\nMap has 2 additional Map modifiers",
      "Irradiated Tablet\nMap has 2 additional Map modifiers",
    ],
    notes: [
      { text: "The Waystone craft on the right guarantees 103% monster rarity on your Waystones." },
      { text: "Run a Delirium Strategy to spawn Grand Mirrors. Run those Grand mirrors with a non juiced strategy as after the recent nerfs they no longer provide double tablet effect. Spread Delirium Fog onto City biomes (you cannot pick exactly where you spread the fog to, but pick the option closest to a City Biome)." },
      { text: "Run these Delirium Fog City Biomes for an Extra Tablet Slot thanks to the Atlas Tree node Industrial Improvements." },
      { text: "You run 4 different tablets to scale Hildas Ancient Inscriptions node. The best second modifier for each tablet would be \"inc number of rare monsters\" this hikes the investment greatly though." },
      { text: "Pull abyss rares out of the black void when they spawn to get high tier omens, or wait for the void to temporarily despawn before killing them." },
      { text: "Breach Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/02zvzgb8Ig" },
      { text: "Overseer Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/YpYDZpnbIY" },
      { text: "Irradiated Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/aL2rZWMjte" },
    ],
  },
  {
    id: "doryani-deli-farming",
    name: "200% Doryani Deli Farming",
    tier: "S",
    recommendedBy: "Doryani",
    difficulty: 5,
    investment: 3,
    rarityNote: "Aim for atleast 100% Rarity on your gear.",
    guide: { label: "Maxroll guide by aer0", url: "https://maxroll.gg/poe2/resources/ritual" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/g6e3bz0h" },
    waystone: "T15 Waystone, HAS TO BE 5 MODS - Then craft with an Omen of Chaotic Rarity, Quantity and Effectiveness simultaneously. Exalt afterwards.",
    tablets: [
      "Delirium Tablet\nDelirium spawns % increased fracturing mirrors\n% Inc Monster rarity, % Inc rare monsters",
      "Delirium Tablet\nDelirium spawns % increased fracturing mirrors\n% Inc Monster rarity, % Inc rare monsters",
      "Delirium Tablet\nDelirium spawns % increased fracturing mirrors\n% Inc Monster rarity, % Inc rare monsters",
      "Delirium Tablet\nDelirium spawns % increased fracturing mirrors\n% Inc Monster rarity, % Inc rare monsters",
    ],
    notes: [
      { text: "Run this strategy on 200% Delirium City Biome Maps. If you were to run this strategy on non city maps it would be around 40% less loot." },
      { text: "Desert biomes atlas passives decreases the amount of rare monsters you get per map, so its better to spec into mountain for this specific strategy." },
      { text: "Verisium Remnants and Strongboxes benefit greatly from increased monster rarity, so complete every encounter of these that you find." },
      { text: "Make sure to run into EVERY mirror shard that spawns in your maps, as the rare monsters spawned from these are incredibly lucrative." },
      { text: "If the tablets are too expensive, you can substitute inc monster rarity for another generic juicing modifier." },
      { text: "Loot from my testing", url: "https://docs.google.com/spreadsheets/d/1Mm5X0CzXL2uBRfpBkWyN09hqrmDy5qXQkGxExzviuyY/edit?gid=541232277" },
      { text: "Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/rP7pBRrMfQ" },
    ],
  },
  {
    id: "jackpot-ritual",
    name: "Jackpot Ritual",
    subtitle: "\"Infinite\" Reroll Ritual",
    tier: "S",
    recommendedBy: "Jado",
    difficulty: 5,
    investment: 5,
    rarityNote: "Rarity is not mandatory as this is not a ground loot focused farm.",
    video: { label: "Vid by aer0", url: "https://www.youtube.com/watch?v=bFSqtGmLgIM" },
    guide: { label: "Maxroll guide by aer0", url: "https://maxroll.gg/poe2/resources/ritual" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/0i1b3c0h" },
    waystone: "T15 Waystone, 6 Modded and Corrupted",
    tablets: [
      "Freedom of Faith Ritual Tablet\nAs low of an increased tribute roll as you can afford",
      "Ritual Tablet\nRitual altars allow rerolling favours 3 additional times",
      "Ritual Tablet\nRitual altars allow rerolling favours 3 additional times",
      "Ritual Tablet\nDeferring favours costs % reduced tribute\nRerolling favours costs % reduced tribute",
    ],
    notes: [
      { text: "This strategy is best ran on city biomes to add a fourth tablet slot. There are budget alternatives that opt out of using city biomes / ritual altars allow rerolling favours additional times to reduce the investment greatly." },
      { text: "This strategy is for jackpot hunting and is feast or famine. A more consistent ritual hunting strategy with less swings is the other one listed in S tier." },
      { text: "Use the Head of the King. This item is used at Caer Tarth, the ritual area on the atlas. Select a city map if possible. This item allows you to make a chain of 6 juiced ritual maps, which will then be modified to buff your ritual encounters." },
      { text: "On your Head of the King modified maps, look for the best modifiers and complete that map first, so it spreads to future maps in the chain. The best modifier you can get and spread is \"ritual altars offer % increased number of favours.\"" },
      { text: "Try and get a modifier that helps with your tribute gain/cost on your reroll tablets. These will likely come at a premium, but you may have some tribute issues without a sufficient amount of these modifiers." },
      { text: "3 Reroll Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/eRKZk9bnhL" },
      { text: "Reduced Tribute Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/YpKd22QksY" },
      { text: "Giga 3 Reroll Tablet Trade Link (Optional, Extreme Investment)", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/opDD8eXqsl" },
    ],
  },
  {
    id: "ritual",
    name: "Ritual",
    tier: "S",
    recommendedBy: "Jado",
    difficulty: 5,
    investment: 5,
    rarityNote: "Rarity is not mandatory as this is not a ground loot focused farm.",
    video: { label: "Vid by Ronarray", url: "https://www.youtube.com/watch?v=C2elk9YSOBM" },
    guide: { label: "Maxroll guide by aer0", url: "https://maxroll.gg/poe2/resources/ritual" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/0i1b3c0h" },
    waystone: "T15 Waystone, 6 Modded and Corrupted",
    tablets: [
      "Freedom of Faith Ritual Tablet\nAs low of an increased tribute roll as you can afford",
      "Ritual Tablet\nRitual altars allow rerolling favours 3 additional times",
      "Ritual Tablet\n% Inc chance for favours to be Omens\nRerolling favours costs % reduced tribute",
      "Ritual Tablet\n% Inc chance for favours to be Omens\nRerolling favours costs % reduced tribute",
    ],
    notes: [
      { text: "This strategy is ran on city biomes to add a fourth tablet slot." },
      { text: "Expensive Omens start dropping at Area level 79, aka T15 maps (previously level 80, which has been changed in a recent patch)." },
      { text: "Use the Head of the King. This item is used at Caer Tarth, the ritual area on the atlas. Select a city map if possible. This item allows you to make a chain of 6 juiced ritual maps, which will then be modified to buff your ritual encounters." },
      { text: "On your Head of the King modified maps, look for the best modifiers and complete that map first, so it spreads to future maps in the chain. The best modifier you can get and spread is \"ritual altars offer % increased number of favours.\"" },
      { text: "Try and get a modifier that helps with your tribute gain/cost on your reroll tablets. These will likely come at a premium, but you may have some tribute issues without a sufficient amount of these modifiers." },
      { text: "3 Reroll Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/eRKZk9bnhL" },
      { text: "Reduced Tribute Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/pJ6zLLMJH0" },
      { text: "Increased Tribute Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/lgKgk7G2CV" },
    ],
  },
  {
    id: "aldurs-saga-hunting",
    name: "Aldurs Saga / Rumour Hunting",
    tier: "A",
    recommendedBy: "Jado",
    difficulty: 2,
    investment: 3,
    recommendationNote: "With logbooks having their drop rates directly buffed through the new expedition tree, and with aldurs saga becoming more popular, this strategy is cheaper than ever before and more profitable than ever before.",
    video: { label: "Vid by BawLoch", url: "https://www.youtube.com/watch?v=7nKw1NUrv2s&t=4s" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/eza4hh06" },
    waystone: "T15 Waystone. Any rarity.",
    tablets: ["Not Needed", "Not Needed", "Not Needed"],
    notes: [
      { text: "In the ocean biome at the bottom right of the atlas, the unique map \"Moor of the Fallen Skies\" may spawn. Chain all of the X's to the final Verisium encounter, then select Aldurs Saga as your reward." },
      { text: "The rumour \"Fallen Stars\" means that Moor of the Fallen Skies spawns. Keep an eye out for this rumour, and as soon as you see it use a logbook and collect your Aldurs Saga." },
      { text: "When using a logbook, path towards the outside of the area to unlock the ability to use more logbooks. Try and path through grand expeditions to increase your odds at getting good Verisium Runes." },
      { text: "Aldurs Saga modifies grand expeditions. Modifiers include: Every Verisium Remnant has at least (5/6/7) slots. You can either use it yourself, or sell it for a lot of money." },
      { text: "I recommend selling your Aldurs Sagas as they are priced around people hunting for permanent stats to min-max their characters. You likely will lose money using them yourself." },
      { text: "The loot explosions from Remnants are directly scaled by 1) How many rune slots a remnant has and 2) which rune slots it has. For example, a 7/8/9 slot Remnant may spawn with \"increased monster rarity\" \"monsters transfer mods on death\" \"slain monsters may respawn as a higher rarity.\" These greatly increase the loot dropped." },
    ],
  },
  {
    id: "abyssal-chests",
    name: "Abyssal Chests",
    subtitle: "Abyssal Boxes",
    tier: "A",
    recommendedBy: "Jado",
    difficulty: 1,
    investment: 2,
    recommendationNote: "To take the investment up a little bit, try and get increased rarity on your tablets. This is not necessary though.",
    video: { label: "Vid by Fubgun", url: "https://www.youtube.com/watch?v=E1Lhf0nt9Bw&t" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/zm4flg0w" },
    waystone: "T15 6 Mod Corrupted.",
    tablets: [
      "Abyss Tablet\nAbyss pits in maps are twice as likely to have rewards",
      "Abyss Tablet\nChance to contain additional abysses",
      "Abyss Tablet\nChance to contain additional abysses",
    ],
    notes: [
      { text: "Easy + Budget strategy. Complete the map normally, clearing the abyss and opening abyssal chests when you see them." },
      { text: "Take every rogue exile node + strongbox node on the passive tree." },
      { text: "Target water biomes for increased chest currency." },
      { text: "Abyss Pits Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/ve50vZ3MTE" },
      { text: "Four Additional Abysses Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/EBbeRPoyT5" },
    ],
  },
  {
    id: "grand-expedition-farming",
    name: "Grand Expedition Farming",
    tier: "A",
    recommendedBy: "Jado",
    difficulty: 2,
    investment: 2,
    recommendationNote: "Grand Expedition can be feast or famine, with long dry streaks being broken up by massive jackpots. Because of this, efficiency is key and its best to focus on more remnants seen than it is to juice the loot explosions from them.",
    video: { label: "Vid by BawLoch", url: "https://www.youtube.com/watch?v=7nKw1NUrv2s" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/q24a2r0w" },
    waystone: "T15 Waystone rolled for Monster Effectiveness and Rarity of Items Found",
    tablets: [
      "Irradiated Tablet\nMonster effectiveness\n+ Rarity of items found",
      "Irradiated Tablet\nMonster effectiveness\n+ Rarity of items found",
      "Irradiated Tablet\nMonster effectiveness\n+ Rarity of items found",
    ],
    notes: [
      { text: "Doryani and Jado are both good choices for this. Doryani is better for scaling loot dropped by monsters, Jado is better for specifically farming the Verisium Remnant rewards." },
      { text: "For pure loot tile efficiency, check your Map for lucrative remnants (6+ slots typically, although some 5s can be worth a good bit) and only blow up the good remnants." },
      { text: "With the most recent expedition buffs including the new atlas tree, chaining verisium remnants from the lowest rune to the highest rune can result in juicy loot explosions. Highlighted runes are added to future remnants, so prioritise the good highlighted runes early on in your chain." },
      { text: "If you get a \"dud\" grand expedition, you can place one explosive and blow it up to complete the map and move on." },
      { text: "League mechanic specific tablets, and overseer tablets do not apply to Grand Expeditions. Irradiated does." },
    ],
  },
  {
    id: "liquid-emotion-farming",
    name: "Liquid Emotion Farming",
    tier: "A",
    recommendedBy: "Jado",
    difficulty: 3,
    investment: 2,
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/y01dcj0h" },
    waystone: "T15 6 Mod Corrupted Waystone.",
    tablets: [
      "Temple Tablet\n20%+ chance to add a Vaal Beacon Unique monster to the map",
      "Delirium Tablet\nDelirium encounters are 20%+ more likely to spawn unique bosses.",
      "Delirium Tablet\nDelirium Fog in Maps spawns % increased Mirror Shards.",
    ],
    notes: [
      { text: "Whilst crafting on any temple tablets that you drop, look out for \"inc chance of vaal uniques\" combined with \"uniques have +1 additional modifiers\" as this is an expensive tablet due to companion hunting." },
      { text: "Unique bosses spawned through the temple tablet/tree appear randomly on the map, not just at the end of the incursion encounters." },
      { text: "Unique vaal bosses found in your maps may drop vaal currency + they count as construct/beasts to drop expensive liquid emotions." },
      { text: "You do not need to run the temple for this strategy, however it pairs well with Atziri boss rushing." },
      { text: "Temple Boss Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/ky69MB4Qh5" },
      { text: "Deli Boss Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/ve5KV9dMFE" },
      { text: "Mirror Shard Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/JBQ0dRLJsl" },
    ],
  },
  {
    id: "unstable-hiveblood-farming",
    name: "Unstable Hiveblood farming",
    subtitle: "Breach Hiveblood Farm",
    tier: "A",
    recommendedBy: "Jado",
    difficulty: 2,
    investment: 3,
    recommendationNote: "Always keep an eye on catalyst prices. If significant time has passed and the market has shifted, the tree setup may be outdated and farming for jewel catalysts may be better.",
    video: { label: "Vid by BawLoch", url: "https://www.youtube.com/watch?v=EqF8dSumiMQ" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/eq4e1w0w" },
    waystone: "T15 Waystone, 6 Mod.",
    tablets: [
      "Breach Tablet\nInc quantity of Hiveblood",
      "Breach Tablet\nInc quantity of Hiveblood",
      "Breach Tablet\nInc quantity of Hiveblood",
    ],
    notes: [
      { text: "This strategy is focused purely on farming hiveblood to craft either catalysts, rings or amulets with on your tree. All of the profit comes from spending the hiveblood." },
      { text: "Catalyst Tree Link / Amulet Tree Link (ring crafting untested).", url: "https://prnt.sc/8tx3nn6Sfn3f" },
      { text: "For amulet farming, you are trying to drop Absent amulets which can roll a number of different spirit skills. A lot are around a divine, a couple are around 2-3 divines (cast on dodge/crit) and trinity is hovering around 10 divines." },
      { text: "Ilvl 82 ring/amulet wombgifts enable T1 Ele resist / attributes rolls. I do not think the extra premium is worth it in the case of crafting amulets, since you're focused on crafting the base." },
      { text: "Jados reworked partial transitions node is a nice buff to this strategy. It went from 20% chance to double the effect of your tablets, to a guaranteed 0-40% inc effect every map. This has greatly increased the consistency of farming hiveblood." },
      { text: "If you can, try and pair Monster effectiveness / rare monster effectiveness alongside your tablets. A much more expensive option would be the additional rare monsters when stabilised modifier." },
    ],
  },
  {
    id: "deli-boss-rush",
    name: "Deli Boss Rush",
    tier: "A",
    recommendedBy: "Doryani",
    difficulty: 3,
    investment: 2,
    video: { label: "Vid by BawLoch", url: "https://www.youtube.com/watch?v=R3q2GaQxcH4" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/rkh6iz06" },
    waystone: "T15 Waystone, 6 Mod Corrupted.",
    tablets: [
      "Delirium Tablet\nDeli is % more likely to spawn unique bosses.\nDelirium spawns % increased.",
      "Delirium Tablet\nDeli is % more likely to spawn unique bosses.\nDelirium spawns % increased Mirror shards.",
      "Delirium Tablet\nDeli is % more likely to spawn unique bosses.\nDelirium spawns % increased Mirror shards.",
    ],
    notes: [
      { text: "Whilst this strategy isnt a consistent currency printer and is a little feast or famine, it is a fantastic strategy for setting up your atlas for future juicing strategies. Rush the boss of every map, activating any Delirium shard encounters that spawn along the way and repeat." },
      { text: "You will spawn occasionally Grand Mirrors on random maps. Run those maps and use the Grand Mirror on a map near a city biome if possible." },
      { text: "Once you have set up an area on your Atlas with Delirium Fog, you can either do normal Delirium Mapping on those 200% Maps, or 200% Delirious Breach/Abyss Mapping." },
      { text: "Non exhaustive Construct/Beast Boss Map List.", url: "https://prnt.sc/_tev9eXwl7tB" },
      { text: "As of 14/06 there is an interaction where if you rush the boss without activating your delirium mirror, kill the boss, go back and activate your delirium mirror and teleport to the boss checkpoint all of your mirrors spawn in one place at the checkpoint." },
      { text: "Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/Ogor3qwlcE" },
    ],
  },
  {
    id: "hilda-logbook-farming",
    name: "Hilda Logbook Farming",
    tier: "B",
    recommendedBy: "Hilda",
    difficulty: 3,
    investment: 3,
    recommendationNote: "Hilda is far and away the best master for farming logbooks. If logbook prices crash, then you could burn them yourself to hunt for Aldurs Saga. Its a loop that will always keep Expedition worth running.",
    video: { label: "Vid by BawLoch", url: "https://www.youtube.com/watch?v=-T1HwZbsxz0" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/q24a2r0w" },
    waystone: "6 Modded T15 Corrupted with 90%+ Waystone Chance. Ran on regular Map nodes (not Grand Expedition)",
    tablets: [
      "Irradiated Tablet\n% Inc quantity of waystones",
      "Irradiated Tablet\n% Inc quantity of waystones",
      "Irradiated Tablet\n% Inc quantity of waystones",
    ],
    notes: [
      { text: "Logbooks drop from Verisium Remnants + Expedition Markers/Flags in normal maps. They are rare. It is theorized that waystone chance increases logbook drop rates." },
      { text: "Verisium Remnants apply an extra rune to future Remnants. For example, if you chain a 5 slot Verisium remnant to a 6 slot remnant, the final wave of that encounter will have 7 runes applied." },
      { text: "The loot explosions from Remnants are directly scaled by 1) How many rune slots a remnant has and 2) which rune slots it has. For example, a 7/8/9 slot Remnant may spawn with \"increased monster rarity\" \"monsters transfer mods on death\" \"slain monsters may respawn as a higher rarity.\" These greatly increase the loot dropped." },
      { text: "Hilda is used to add more rare monsters to your expedition encounters, increasing the odds that you drop logbooks." },
      { text: "When running your expedition encounters, target high value remnants and as many monster markers / flags as you can fit in your expedition explosions." },
    ],
  },
  {
    id: "simulacrum",
    name: "Simulacrum",
    tier: "B",
    difficulty: 5,
    investment: 5,
    video: { label: "Vid by Furunduk", url: "https://www.youtube.com/watch?v=Ea01EF3TFdw" },
    waystone: "T15 Waystone",
    tablets: ["N/A", "N/A", "N/A"],
    notes: [
      { text: "Simulacrum encounters can be spawned with a grand mirror, and require atleast 100% delirium fog to run. You can also spawn simulacrums ontop of delirium fog with the fragment." },
      { text: "You cannot use tablets with simulacrums." },
      { text: "Simulacrum is a jackpot hunting strat, hunting for the unique Voices jewel." },
    ],
  },
  {
    id: "atziri-boss-rush",
    name: "Atziri Boss Rush",
    tier: "B",
    recommendedBy: "Jado",
    difficulty: 2,
    investment: 3,
    recommendationNote: "Pairing Atziri Boss Rushing with Liquid Emotion Farming is a good choice.",
    video: { label: "Vid by Zen_M", url: "https://www.youtube.com/watch?v=LGR9HEIj0BU&t" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/x04fwi0w" },
    waystone: "T15 6 Mod Corrupted Waystone.",
    tablets: [
      "Temple Tablet\n% chance to gain an additional crystal from vaal beacons",
      "Temple Tablet\n% chance to gain an additional crystal from vaal beacons",
      "Temple Tablet\n% chance to gain an additional crystal from vaal beacons",
    ],
    notes: [
      { text: "When building your temple, you want to create a path towards Atziri whilst protecting it by throwing random rooms at the sides of the path to decrease the odds that your path gets destabilised." },
      { text: "You can use non path tiles to connect to Atziri/other nodes if you are one tile away and did not get a pathing tile." },
      { text: "Temple Tablet Trade Link", url: "https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur/2KyJGrpVuk" },
    ],
  },
  {
    id: "big-boom-expedition",
    name: "Big Boom Expedition",
    tier: "C",
    recommendedBy: "Doryani",
    difficulty: 3,
    investment: 2,
    recommendationNote: "This strategy is kind of completely outdone by Hilda logbook farming, and i wouldnt recommend doing it unless you literally want to turn off your brain and place one big bomba.",
    video: { label: "Vid by BawLoch", url: "https://www.youtube.com/watch?v=-T1HwZbsxz0" },
    atlasTree: { label: "Atlas Tree", url: "https://maxroll.gg/poe2/atlas-tree/q24a2r0w" },
    waystone: "6 Modded T15 Corrupted with 90%+ Waystone Chance. Ran on regular Map nodes (not Grand Expedition)",
    tablets: [
      "Irradiated Tablet\n% Inc quantity of waystones",
      "Irradiated Tablet\n% Inc quantity of waystones",
      "Irradiated Tablet\n% Inc quantity of waystones",
    ],
    notes: [
      { text: "Logbooks drop from Verisium Remnants + Expedition Markers/Flags in normal maps. They are rare. It is theorized that waystone chance increases logbook drop rates." },
      { text: "Verisium Remnants apply an extra rune to future Remnants. For example, if you chain a 5 slot Verisium remnant to a 6 slot remnant, the final wave of that encounter will have 7 runes applied." },
      { text: "With Big Boom expedition, every Verisium Remnant in the one explosion applies that rune to the other remnants. For example, if you have 3 Verisium Remnants with 5 rune slots, the final wave for all of those encounters has 7 runes." },
      { text: "Big Boom Expedition activates every Remnant at the same time, rather than one at a time. This saves a lot of time and is the main reason to run Big Boom Expedition in regular Maps." },
      { text: "The loot explosions from Remnants are directly scaled by 1) How many rune slots a remnant has and 2) which rune slots it has. For example, a 7/8/9 slot Remnant may spawn with \"increased monster rarity\" \"monsters transfer mods on death\" \"slain monsters may respawn as a higher rarity.\" These greatly increase the loot dropped." },
      { text: "The Big Boom Master passive applies to Grand Expeditions, essentially bricking them as you only have one explosive. Do not run that Master passive with Grand Expeditions." },
    ],
  },
  { id: "essences", name: "Essences", tier: "F" },
  { id: "breach-hives", name: "Breach Hives", tier: "F" },
];

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(s: string): string {
  return esc(s).replace(/'/g, "&#39;");
}

function nl2br(s: string): string {
  return esc(s).split("\n").map((line) => line).join("<br>");
}

function starRating(n: number, filled: string, empty: string): string {
  return filled.repeat(n) + empty.repeat(Math.max(0, 5 - n));
}

function dedupeCounted(items: string[]): { text: string; count: number }[] {
  const out: { text: string; count: number }[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.text === item) {
      last.count++;
    } else {
      out.push({ text: item, count: 1 });
    }
  }
  return out;
}

function renderNote(note: StrategyNote): string {
  const body = nl2br(note.text);
  if (note.url) {
    return `<li class="afs-note"><a href="${escAttr(note.url)}" target="_blank" rel="noopener">${body}</a></li>`;
  }
  return `<li class="afs-note">${body}</li>`;
}

function renderLinkRow(links: (StrategyLink | undefined)[]): string {
  const items = links.filter((l): l is StrategyLink => !!l && !!l.url);
  if (items.length === 0) return "";
  return (
    `<div class="afs-linkrow">` +
    items
      .map((l) => `<a class="afs-linkchip" href="${escAttr(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
      .join("") +
    `</div>`
  );
}

function renderRatings(s: Strategy): string {
  const parts: string[] = [];
  if (s.difficulty) {
    parts.push(
      `<div class="afs-rating"><span class="afs-rating__label">Difficulty</span><span class="afs-rating__stars">${starRating(s.difficulty, "★", "☆")}</span></div>`
    );
  }
  if (s.investment) {
    parts.push(
      `<div class="afs-rating afs-rating--investment"><span class="afs-rating__label">Investment</span><span class="afs-rating__stars">${starRating(s.investment, "✦", "✧")}</span></div>`
    );
  }
  if (parts.length === 0) return "";
  return `<div class="afs-ratings">${parts.join("")}</div>`;
}

function renderTablets(tablets: string[] | undefined): string {
  if (!tablets || tablets.length === 0) return "";
  const counted = dedupeCounted(tablets);
  const cards = counted
    .map(
      (t) =>
        `<div class="afs-tablet">${t.count > 1 ? `<span class="afs-tablet__count">×${t.count}</span>` : ""}<span class="afs-tablet__text">${nl2br(t.text)}</span></div>`
    )
    .join("");
  return (
    `<div class="afs-block"><h4 class="afs-block__title">Tablets</h4><div class="afs-tablets">${cards}</div></div>`
  );
}

function renderSteps(steps: StrategyStep[] | undefined): string {
  if (!steps || steps.length === 0) return "";
  const items = steps
    .map(
      (step) =>
        `<div class="afs-step">` +
        `<div class="afs-step__title">${esc(step.title)}</div>` +
        (step.waystone ? `<div class="afs-step__row"><span class="afs-step__label">Waystone</span>${esc(step.waystone)}</div>` : "") +
        (step.tablets ? `<div class="afs-step__row"><span class="afs-step__label">Tablets</span>${esc(step.tablets)}</div>` : "") +
        `</div>`
    )
    .join("");
  return `<div class="afs-block"><h4 class="afs-block__title">Map Targets</h4><div class="afs-steps">${items}</div></div>`;
}

function renderAtlasTreeImage(s: Strategy): string {
  if (!ATLAS_TREE_SCREENSHOT_IDS.has(s.id)) return "";
  const caption = s.recommendedBy ? `${s.recommendedBy}'s Atlas Tree setup` : "Atlas Tree setup";
  const src = `/atlas-trees/${s.id}.webp`;
  const img = `<img src="${escAttr(src)}" alt="${escAttr(caption)}" loading="lazy">`;
  const inner = s.atlasTree
    ? `<a href="${escAttr(s.atlasTree.url)}" target="_blank" rel="noopener">${img}</a>`
    : img;
  return (
    `<div class="afs-block--tree"><div class="afs-treecard">` +
    `<div class="afs-treecard__label">${esc(caption)}</div>` +
    `<div class="afs-treeimg">${inner}</div>` +
    `</div></div>`
  );
}

function renderStrategyBody(s: Strategy): string {
  if (s.tier === "F" && !s.notes && !s.waystone && !s.tablets && !s.steps) {
    return `<div class="afs-empty">No detailed strategy guide has been published for this yet. Check back later.</div>`;
  }

  const linkRow = renderLinkRow([s.video, s.guide, s.atlasTree]);
  const ratings = renderRatings(s);
  const waystoneBlock = s.waystone
    ? `<div class="afs-block"><h4 class="afs-block__title">Waystone</h4><p class="afs-waystone">${nl2br(s.waystone)}</p></div>`
    : "";
  const tabletsBlock = renderTablets(s.tablets);
  const stepsBlock = renderSteps(s.steps);
  const treeImageBlock = renderAtlasTreeImage(s);
  const notesBlock =
    s.notes && s.notes.length > 0
      ? `<div class="afs-block"><h4 class="afs-block__title">Notes</h4><ul class="afs-notes">${s.notes.map(renderNote).join("")}</ul></div>`
      : "";
  const calloutsBlock =
    s.recommendationNote || s.rarityNote
      ? `<div class="afs-callouts">` +
        (s.recommendationNote ? `<div class="ui-callout afs-callout"><span class="afs-callout__label">Recommendation</span>${esc(s.recommendationNote)}</div>` : "") +
        (s.rarityNote ? `<div class="ui-callout afs-callout afs-callout--rarity"><span class="afs-callout__label">Rarity</span>${esc(s.rarityNote)}</div>` : "") +
        `</div>`
      : "";

  const mainCol = `${calloutsBlock}${waystoneBlock}${tabletsBlock}${stepsBlock}${notesBlock}`;
  const detail = treeImageBlock
    ? `<div class="afs-detail-grid"><div class="afs-detail-main">${mainCol}</div>${treeImageBlock}</div>`
    : mainCol;

  return (
    `<div class="afs-body-inner">` +
    (linkRow || ratings ? `<div class="afs-top-row">${linkRow}${ratings}</div>` : "") +
    detail +
    `</div>`
  );
}

function renderAccordionItem(s: Strategy): string {
  const hasContent = !!(s.notes || s.waystone || s.tablets || s.steps || s.recommendationNote || s.rarityNote);
  const bodyId = `afs-body-${s.id}`;
  return (
    `<div class="afs-item" id="afs-item-${s.id}" data-tier="${s.tier}">` +
    `<button type="button" class="afs-item__summary" aria-expanded="false" aria-controls="${bodyId}">` +
    `<span class="afs-item__tier" data-tier="${s.tier}">${s.tier}</span>` +
    `<span class="afs-item__titles"><span class="afs-item__name">${esc(s.name)}</span>` +
    (s.subtitle ? `<span class="afs-item__subtitle">${esc(s.subtitle)}</span>` : "") +
    `</span>` +
    (s.recommendedBy ? `<span class="afs-item__by" title="Atlas Master used for this strategy">${esc(s.recommendedBy)}</span>` : "") +
    (s.difficulty
      ? `<span class="afs-item__mini" title="Difficulty: ${s.difficulty}/5, how tricky the strategy is to execute"><span class="afs-item__mini-label">Diff</span>${starRating(s.difficulty, "★", "☆")}</span>`
      : "") +
    (s.investment
      ? `<span class="afs-item__mini afs-item__mini--investment" title="Investment: ${s.investment}/5, how much currency it costs to run"><span class="afs-item__mini-label">Inv</span>${starRating(s.investment, "✦", "✧")}</span>`
      : "") +
    (!hasContent ? `<span class="afs-item__soon">No guide yet</span>` : "") +
    `<span class="afs-item__chevron" aria-hidden="true">▾</span>` +
    `</button>` +
    `<div class="afs-item__body" id="${bodyId}" hidden>${renderStrategyBody(s)}</div>` +
    `</div>`
  );
}

function renderTierRow(tier: Tier): string {
  const meta = TIER_META[tier];
  const items = STRATEGIES.filter((s) => s.tier === tier);
  const chips = items
    .map(
      (s) =>
        `<button type="button" class="afs-chip" data-target="afs-item-${s.id}" data-tier="${s.tier}">${esc(s.name)}</button>`
    )
    .join("");
  return (
    `<div class="afs-tierrow">` +
    `<div class="afs-tierrow__label" data-tier="${tier}">${meta.label}</div>` +
    `<div class="afs-tierrow__chips">${chips}</div>` +
    `</div>`
  );
}

export function generateAtlasFarmingStrategies(_attrs: Record<string, string>, nonce?: string): string {
  const tierRows = TIER_ORDER.map(renderTierRow).join("");
  const accordionItems = STRATEGIES.map(renderAccordionItem).join("");

  const css = `
${TIER_ORDER.map(tier => { const meta = TIER_META[tier]; return `#afs-root [data-tier="${tier}"]{--tier-bg:${meta.bg};--tier-border:${meta.border};--tier-color:${meta.text};}`; }).join("\n")}
#afs-root{font-family:inherit;margin:0;}
#afs-root *{box-sizing:border-box;}
#afs-root h2{margin:0 0 1rem;font-family:var(--font-display);font-size:clamp(1.3rem,2.2vw,1.7rem);font-weight:600;line-height:1.2;}

#afs-root .afs-tierlist{display:flex;flex-direction:column;gap:.5rem;margin-bottom:1.5rem;}
#afs-root .afs-tierrow{display:flex;align-items:stretch;gap:.6rem;border:1px solid var(--line,#1d2442);border-radius:var(--r-lg,16px);overflow:hidden;background:var(--surface,#0f1326);}
#afs-root .afs-tierrow__label{background:var(--tier-border);flex:0 0 4.5rem;display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:600;font-size:.85rem;color:#fff;text-align:center;padding:.5rem .25rem;}
#afs-root .afs-tierrow__chips{flex:1;display:flex;flex-wrap:wrap;gap:.4rem;padding:.6rem;align-content:center;}

#afs-root .afs-chip{background:var(--tier-bg);border:1px solid var(--tier-border);color:var(--tier-color);border-radius:var(--r-sm,6px);padding:.4rem .7rem;font:inherit;font-size:.82rem;font-weight:600;cursor:pointer;transition:border-color var(--transition-fast);line-height:1.2;}
#afs-root .afs-chip:hover{border-color:var(--accent);}

#afs-root .afs-legend{display:flex;flex-wrap:wrap;gap:.6rem 1.5rem;margin-bottom:.6rem;padding:.65rem .9rem;background:rgba(255,255,255,.03);border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);}
#afs-root .afs-legend__item{display:flex;align-items:center;gap:.6rem;font-size:.85rem;color:var(--muted,#a3aec9);}
#afs-root .afs-legend__icon{font-size:1.1rem;letter-spacing:.1rem;flex-shrink:0;}
#afs-root .afs-legend__item:nth-child(1) .afs-legend__icon{color:var(--accent,#70d0ff);}
#afs-root .afs-legend__item:nth-child(2) .afs-legend__icon{color:var(--accent-2,#ff3fb8);}
#afs-root .afs-legend__text strong{color:var(--text,#e9eef9);}

#afs-root .afs-toolbar{display:flex;justify-content:flex-end;gap:.5rem;margin-bottom:.6rem;}
#afs-root .afs-toolbtn{color:var(--muted,#a3aec9);padding:.35rem .7rem;cursor:pointer;font-size:.78rem;transition:color .12s,border-color .12s;}
#afs-root .afs-toolbtn:hover{color:var(--text,#e9eef9);border-color:var(--muted,#a3aec9);}

#afs-root .afs-list{display:flex;flex-direction:column;gap:.5rem;}
#afs-root .afs-item{border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);background:var(--surface,#0f1326);overflow:hidden;scroll-margin-top:1rem;}
#afs-root .afs-item:has(.afs-item__summary[aria-expanded="true"]){border-color:var(--accent,#70d0ff);}
#afs-root .afs-item__summary{width:100%;background:none;border:none;margin:0;font:inherit;color:inherit;text-align:left;list-style:none;cursor:pointer;display:flex;align-items:center;gap:.6rem;padding:.65rem .8rem;flex-wrap:wrap;}
#afs-root .afs-item__tier{flex:0 0 auto;width:1.9rem;height:1.9rem;display:flex;align-items:center;justify-content:center;border:1px solid;border-radius:var(--r-sm,6px);font-weight:800;font-size:.85rem;}
#afs-root .afs-item__titles{display:flex;flex-direction:column;flex:1;min-width:8rem;}
#afs-root .afs-item__name{font-weight:700;font-size:.98rem;color:var(--text,#e9eef9);}
#afs-root .afs-item__subtitle{font-size:.72rem;color:var(--muted,#a3aec9);}
#afs-root .afs-item__by{font-size:.72rem;color:var(--muted,#a3aec9);border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);padding:.1rem .4rem;white-space:nowrap;}
#afs-root .afs-item__mini{display:inline-flex;align-items:center;gap:.4rem;font-size:1.05rem;line-height:1;color:var(--accent,#70d0ff);white-space:nowrap;letter-spacing:.1rem;background:rgba(255,255,255,.04);border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);padding:.3rem .6rem;}
#afs-root .afs-item__mini--investment{color:var(--accent-2,#ff3fb8);}
#afs-root .afs-item__mini-label{font-size:.8rem;color:var(--muted,#a3aec9);font-weight:700;}
#afs-root .afs-item__soon{font-size:.72rem;color:var(--muted,#a3aec9);font-style:italic;}
#afs-root .afs-item__chevron{margin-left:auto;color:var(--muted,#a3aec9);transition:transform .15s;flex:0 0 auto;}
#afs-root .afs-item__summary[aria-expanded="true"] .afs-item__chevron{transform:rotate(180deg);}

#afs-root .afs-item__body{border-top:1px solid var(--line,#1d2442);padding:.8rem;}
#afs-root .afs-body-inner{display:flex;flex-direction:column;gap:.75rem;}

#afs-root .afs-top-row{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem .9rem;}
#afs-root .afs-linkrow{display:flex;flex-wrap:wrap;gap:.4rem;}
#afs-root .afs-linkchip{font-size:.75rem;color:var(--accent,#70d0ff);border:1px solid rgb(from var(--accent) r g b / .35);border-radius:var(--r-sm,6px);padding:.25rem .55rem;text-decoration:none;transition:background .12s;}
#afs-root .afs-linkchip:hover{background:rgb(from var(--accent) r g b / .08);}
#afs-root .afs-ratings{display:flex;gap:.9rem;flex-wrap:wrap;}
#afs-root .afs-rating{display:flex;align-items:center;gap:.45rem;font-size:.8rem;color:var(--muted,#a3aec9);}
#afs-root .afs-rating__stars{font-size:1.1rem;line-height:1;letter-spacing:.1rem;color:var(--accent,#70d0ff);}
#afs-root .afs-rating--investment .afs-rating__stars{color:var(--accent-2,#ff3fb8);}

#afs-root .afs-detail-grid{display:grid;grid-template-columns:1fr 26rem;gap:1.5rem;align-items:start;}
#afs-root .afs-detail-main{display:flex;flex-direction:column;gap:.75rem;min-width:0;}
#afs-root .afs-block--tree{margin:0;padding-left:1.5rem;border-left:1px solid var(--line,#1d2442);}
#afs-root .afs-treecard{border:1px solid var(--line,#1d2442);border-radius:var(--r-md,10px);overflow:hidden;background:rgba(255,255,255,.03);}
#afs-root .afs-treecard__label{font-size:.85rem;font-weight:700;color:var(--text-soft,#c3cbe0);padding:.5rem .6rem .35rem;}
#afs-root .afs-treeimg{line-height:0;}
#afs-root .afs-treeimg img{display:block;width:100%;height:auto;transition:opacity .12s;}
#afs-root .afs-treeimg a{display:block;}
#afs-root .afs-treeimg a:hover img{opacity:.85;}
@media(max-width:760px){
  #afs-root .afs-detail-grid{grid-template-columns:1fr;}
  #afs-root .afs-block--tree{order:-1;max-width:26rem;padding-left:0;padding-bottom:1.25rem;border-left:none;border-bottom:1px solid var(--line,#1d2442);}
}

#afs-root .afs-callouts{display:flex;flex-direction:column;gap:.5rem;}
#afs-root .afs-callout{padding:.55rem .7rem;font-size:.82rem;line-height:1.45;color:var(--text,#e9eef9);}
#afs-root .afs-callout__label{display:block;font-size:.85rem;font-weight:700;color:var(--accent,#70d0ff);margin-bottom:.2rem;}
#afs-root .afs-callout--rarity{background:rgba(168,255,96,.06);border-color:rgba(168,255,96,.3);}
#afs-root .afs-callout--rarity .afs-callout__label{color:#a8ff60;}

#afs-root .afs-block__title{margin:0 0 .5rem;font-size:.85rem;font-weight:700;color:var(--text-soft,#c3cbe0);}
#afs-root .afs-waystone{margin:0;font-size:.85rem;line-height:1.5;color:var(--text,#e9eef9);background:rgba(255,255,255,.03);border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);padding:.55rem .7rem;}

#afs-root .afs-tablets{display:grid;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));gap:.4rem;}
#afs-root .afs-tablet{position:relative;background:rgba(255,255,255,.03);border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);padding:.5rem .6rem;font-size:.78rem;line-height:1.4;color:var(--text,#e9eef9);}
#afs-root .afs-tablet__count{position:absolute;top:.35rem;right:.5rem;font-size:.7rem;font-weight:700;color:var(--accent,#70d0ff);}

#afs-root .afs-steps{display:flex;flex-direction:column;gap:.5rem;}
#afs-root .afs-step{background:rgba(255,255,255,.03);border:1px solid var(--line,#1d2442);border-radius:var(--r-sm,6px);padding:.55rem .7rem;}
#afs-root .afs-step__title{font-weight:600;font-size:.85rem;color:var(--text,#e9eef9);margin-bottom:.2rem;}
#afs-root .afs-step__row{font-size:.8rem;color:var(--muted,#a3aec9);}
#afs-root .afs-step__label{color:var(--text,#e9eef9);font-weight:600;margin-right:.4rem;}

#afs-root .afs-notes{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:.4rem;}
#afs-root .afs-note{font-size:.83rem;line-height:1.5;color:var(--text,#e9eef9);padding-left:1rem;position:relative;}
#afs-root .afs-note::before{content:"•";position:absolute;left:0;color:var(--accent,#70d0ff);}
#afs-root .afs-note a{color:var(--accent,#70d0ff);}

#afs-root .afs-empty{font-size:.85rem;color:var(--muted,#a3aec9);font-style:italic;padding:.4rem 0;}

#afs-root .afs-meta{display:flex;justify-content:space-between;align-items:center;margin:1rem 0 0;font-size:.75rem;gap:1rem;flex-wrap:wrap;}
#afs-root .afs-credit{color:var(--muted,#a3aec9);}
#afs-root .afs-credit a{color:var(--muted,#a3aec9);text-decoration:none;}
#afs-root .afs-credit a:hover{color:var(--accent,#70d0ff);}

@media(max-width:640px){
  .afs-tierrow{flex-direction:column;}
  .afs-tierrow__label{flex:none;padding:.35rem;}
}
  `.trim();

  const js = `
(function(){
  function setOpen(item,open){
    if(!item)return;
    var btn=item.querySelector('.afs-item__summary');
    var body=item.querySelector('.afs-item__body');
    if(!btn||!body)return;
    btn.setAttribute('aria-expanded',open?'true':'false');
    body.hidden=!open;
  }
  function init(){
    var root=document.getElementById('afs-root');
    if(!root||root.dataset.afsInit)return;
    root.dataset.afsInit='1';
    root.querySelectorAll('.afs-item__summary').forEach(function(btn){
      btn.addEventListener('click',function(){
        var item=btn.closest('.afs-item');
        var expanded=btn.getAttribute('aria-expanded')==='true';
        setOpen(item,!expanded);
      });
    });
    root.querySelectorAll('.afs-chip').forEach(function(chip){
      chip.addEventListener('click',function(){
        var target=document.getElementById(this.dataset.target);
        if(!target)return;
        setOpen(target,true);
        target.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
    var expandBtn=document.getElementById('afs-expand-all');
    var collapseBtn=document.getElementById('afs-collapse-all');
    if(expandBtn){expandBtn.addEventListener('click',function(){
      root.querySelectorAll('.afs-item').forEach(function(item){setOpen(item,true);});
    });}
    if(collapseBtn){collapseBtn.addEventListener('click',function(){
      root.querySelectorAll('.afs-item').forEach(function(item){setOpen(item,false);});
    });}
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init);
  } else {
    init();
  }
  document.addEventListener('astro:page-load',init);
})();
  `.trim();

  return (
    `<div id="afs-root">` +
    `<style${nonceAttr(nonce)}>${css}</style>` +
    `<h2>Path of Exile 2 0.5 Currency Making Tier List</h2>` +
    `<p>A tier list of the best currency farming strategies for Path of Exile 2's 0.5 update, ranked S to F. Click a strategy below to see its waystone setup, tablets, Atlas Tree, and notes.</p>` +
    `<div class="afs-tierlist">${tierRows}</div>` +
    `<div class="afs-legend">` +
    `<span class="afs-legend__item"><span class="afs-legend__icon">★★★☆☆</span><span class="afs-legend__text"><strong>Difficulty</strong>: more stars = trickier to execute</span></span>` +
    `<span class="afs-legend__item"><span class="afs-legend__icon">✦✦✦✧✧</span><span class="afs-legend__text"><strong>Investment</strong>: more diamonds = more currency to run</span></span>` +
    `</div>` +
    `<div class="afs-toolbar">` +
    `<button type="button" class="ui-action afs-toolbtn" id="afs-expand-all">Expand all</button>` +
    `<button type="button" class="ui-action afs-toolbtn" id="afs-collapse-all">Collapse all</button>` +
    `</div>` +
    `<div class="afs-list">${accordionItems}</div>` +
    `<script${nonceAttr(nonce)}>${js}<\/script>` +
    `<div class="afs-meta">` +
    `<span class="afs-credit">Tier list &amp; strategies by <a href="https://maxroll.gg/@bawloch" target="_blank" rel="noopener">BawLoch</a> · <a href="https://discord.gg/xq6FtCVRse" target="_blank" rel="noopener">Discord</a> · <a href="https://www.youtube.com/@BawLoch" target="_blank" rel="noopener">YouTube</a> · <a href="https://www.twitch.tv/bawlochs" target="_blank" rel="noopener">Twitch</a></span>` +
    `</div>` +
    `</div>`
  );
}
