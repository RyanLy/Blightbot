// For blightBuildNumber = 1052;
// Works on the Ironwood River Human Campaign.
// Copy this and paste it into the console

var game = window.Blight.game
var galaxy = window.galaxy

var blightedLocation = galaxy.placeList.find(place => {
  return place.blighted
})

function getOwnLocations() {
  return galaxy.placeList.filter(place => {
    return place.player
  })
}

function getPlayer() {
  return galaxy.playerList[0];
}

async function trainAllMilitia() {
  await getOwnLocations().map(async (place) => {
    if (place.militiaEta === 0 && getPlayer().gold > place.militiaCost) {
      game.trigger('train_militia', place);
      await delay();
    }
  })
}

async function deployStrongestUnit() {
  const eligibleUnits = getPlayer().getUnits()
    .filter(unit => unit.x < 1 && getPlayer().gold > unit.cost)

  if (eligibleUnits.length) {
    var strongest = eligibleUnits.reduce((max, unit) =>  max.might > unit.might ? max : unit)

    game.trigger('select_drawn_unit', strongest)
    game.trigger('pre_deploy_drawn_unit', strongest, getPlayer());
    await delay();

    const ownLocations = getOwnLocations();
    game.trigger('target_select_hex', ownLocations.reduce((max, unit) =>  max.y < unit.y ? max : unit).hex);
    await delay();
  }
}

function findPlaceWithUnclaimedUnit(militiaKind = 'human_standard') {
  return galaxy.placeList.filter(place => place.blighted === 0 && !place.player && place.getHex().getUnits().length > 0 && place.militiaKind === militiaKind)[0]
}

function findEnemyUnits() {
  return galaxy.unitList
    .filter(unit => unit.undead === 1)
    .sort((unit1, unit2) => unit1.might - unit2.might)
    .reverse()
}

function findStrongestEnemyHex() {
  const strongest = findEnemyUnits()[0];
  return strongest.path[strongest.path.length - 1] || strongest.hexIndex;
}

function delay (delay=500) {
  return new Promise(resolve => {
    setTimeout(function() {
      return resolve();
    }, delay)
  });
}

async function goToHex(unit, hexIndex) {
  game.trigger('select_unit', unit);
  game.trigger('mover_order_auto', galaxy.map.hexes[hexIndex]);
  await delay()
}

async function nextTurn() {
  game.trigger('next_turn');
  await delay(1500);
}

function primaryUnit() {
  return getPlayer().getUnits().filter(unit => unit.x > 0 && !unit.getFollowing())[0]
}

function secondaryUnit() {
  return getPlayer().getUnits().filter(unit => unit.x > 0 && !unit.getFollowing())[1];
}

async function gatherAll(unit) {
  game.trigger("gather_all", unit);
  await delay();
}

async function performTurn() {
  game.trigger("bazaar_buy_gold", Math.floor(getPlayer().valour / 10) * 10);
  await delay();

  await trainAllMilitia();
  game.trigger("gather_all", primaryUnit());
  await delay();

  var strongestEnemyHex = findStrongestEnemyHex();
  if (strongestEnemyHex) {
    await goToHex(primaryUnit(), strongestEnemyHex);
  }

  var enemyUnits = findEnemyUnits().slice(1)
  var enemyHexes = enemyUnits.map(unit => unit.path[unit.path.length - 1] || unit.hexIndex);

  var zombieHexes = enemyHexes.concat(galaxy.graveList.map(grave => grave.hexIndex));
  getPlayer().getUnits().filter(unit => unit.x > 0 && !unit.getFollowing()).filter(unit => unit !== primaryUnit() && unit !== secondaryUnit()).forEach(async (unit, index) => {
    if (zombieHexes) {
      await goToHex(unit, zombieHexes[Math.min(zombieHexes.length - 1, index)])
    } else {
      await goToHex(primaryUnit(), strongestEnemyHex);
    }
  })
  await goToHex(secondaryUnit(), galaxy.placeList.find(place => place.kind === 'mana_source' && place.name === 'Kings Muck').hex.index);

  await nextTurn();
  console.log('Turn finished!')
}

async function init() {
  await trainAllMilitia();
  await deployStrongestUnit();
  await gatherAll(primaryUnit());

  var placeToBuy = findPlaceWithUnclaimedUnit()
  await goToHex(primaryUnit(), placeToBuy.hex.index);

  await nextTurn();

  await trainAllMilitia();

  await nextTurn();

  game.trigger('buy_place', placeToBuy);
  await delay();

  await deployStrongestUnit();
  await trainAllMilitia();
  await gatherAll(primaryUnit());
  await gatherAll(secondaryUnit());
}

await init();

while(!galaxy.gameOver) {
  await performTurn();
}
