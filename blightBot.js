// For blightBuildNumber = 1052;
// Works on the Ironwood River Human Campaign.
// 1. Start the campaign.
// 2. Copy this and paste it into the console
// 3. Type in main()
// 4. Enjoy!

var game = window.Blight.game;
var galaxy = window.galaxy;
var hexes = galaxy.map.hexes;

function getOwnLocations() {
  return galaxy.placeList.filter(place => place.player)
}

function getPlayer() {
  return galaxy.playerList[0];
}

async function trainAllMilitia() {
  for (const place of getOwnLocations()) {
    if (place.militiaEta === 0 && getPlayer().gold > place.militiaCost) {
      game.trigger('train_militia', place);
      await delay();
    }
  }
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
    .sort((unit1, unit2) => getArmyMight(unit1) - getArmyMight(unit2))
    .reverse()
}


function delay (delay=1000) {
  return new Promise(resolve => {
    setTimeout(function() {
      return resolve();
    }, delay)
  });
}

async function goToHex(unit, hexIndex) {
  game.trigger('select_unit', unit);
  game.trigger('mover_order_auto', hexes[hexIndex]);
  await delay()
}

async function nextTurn() {
  game.trigger('next_turn');
  await delay(1500);
}

function getArmyMight(unit) {
  return unit.getArmy().map(unit => unit.might).reduce((a, b) => a + b, 0)
}

function getIndependentUnitsOnBoard() {
  return getPlayer().getUnits()
    .filter(unit => unit.x > 0 && !unit.getFollowing())
    .sort((unit1, unit2) => getArmyMight(unit1) - getArmyMight(unit2))
    .reverse();
}

function primaryUnit() {
  return getIndependentUnitsOnBoard()[0]
}

function secondaryUnit() {
  return getIndependentUnitsOnBoard()[1];
}

async function gatherAll(unit) {
  if (unit.hex.units.length > 1) {
    game.trigger("gather_all", unit);
    await delay();
  }
}

async function spendAllValourOnGold() {
  game.trigger("bazaar_buy_gold", Math.floor(getPlayer().valour / 10) * 10);
  await delay();
}

function findClosestUnblightedHexFromIndex(hexIndex) {
  if (hexes[hexIndex].place && !hexes[hexIndex].place.blighted) {
    return hexIndex;
  } else {
    let queue = [hexIndex];
    let visited = new Set();
    while (queue.length) {
      let currentHex = queue.shift();
      if (hexes[currentHex].place && !hexes[currentHex].place.blighted) {
        return currentHex
      } else {
        var validNeighbors = hexes[currentHex].neighbors.filter(hex =>
          !visited.has(hex) && !hexes[currentHex].rivers.includes(hex)
        );
        visited.add(currentHex);
        queue = queue.concat(validNeighbors);
      }

    }

    return null;
  }
}

async function gatherAllUnits() {
  for (const unit of getIndependentUnitsOnBoard()) {
    await gatherAll(unit);
  }
}

async function buyPlace(place) {
  game.trigger('buy_place', place);
  await delay();
}

async function performTurn() {
  await spendAllValourOnGold();
  await trainAllMilitia();
  await gatherAll(primaryUnit());
  await gatherAll(secondaryUnit());

  var enemyDestinations = findEnemyUnits().map(unit => unit.hexTarget !== -1 ? unit.hexTarget : unit.hexIndex).filter(hex => hex !== -1).map(hex => findClosestUnblightedHexFromIndex(hex));
  var graveLocations = galaxy.graveList.map(grave => grave.hexIndex);
  var zombieHexes = [...new Set(enemyDestinations.concat(graveLocations))];

  if (zombieHexes) {
    for (const [index, unit] of getIndependentUnitsOnBoard().entries()) {
      await goToHex(unit, zombieHexes[Math.min(zombieHexes.length - 1, index)])
    }
  }

  await nextTurn();
  console.log('Turn finished!')
}

async function init() {
  await trainAllMilitia();
  await deployStrongestUnit();
  await gatherAllUnits()

  var placeToBuy = findPlaceWithUnclaimedUnit()
  await goToHex(primaryUnit(), placeToBuy.hex.index);
  await nextTurn();

  await trainAllMilitia();
  await nextTurn();

  await buyPlace(placeToBuy);
  await deployStrongestUnit();
  await trainAllMilitia();
  await gatherAllUnits();
}

async function main() {
  await init();

  while(!galaxy.gameOver) {
    await performTurn();
  }
}
