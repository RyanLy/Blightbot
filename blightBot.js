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
    .filter(unit => unit.undead === 1 && !unit.getFollowing())
    // .sort((unit1, unit2) => getArmyMight(unit1) - getArmyMight(unit2))
    // .reverse()
    .sort((unit1, unit2) => {
      distanceTo(unit1, findClosestUnblightedHexFromIndex(unit1.hexTarget !== -1 ? unit1.hexTarget : unit1.hexIndex)) -
      distanceTo(unit2, findClosestUnblightedHexFromIndex(unit2.hexTarget !== -1 ? unit2.hexTarget : unit2.hexIndex))
    })
}

function delay(delay=500) {
  return new Promise(resolve => {
    setTimeout(function() {
      return resolve();
    }, delay)
  });
}

async function goToHex(unit, hexIndex) {
  game.trigger('select_unit', unit);
  game.trigger('mover_order_auto', hexes[hexIndex]);
  await delay(100)
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
        const unpassableRivers = hexes[currentHex].rivers.filter(river => !hexes[currentHex].roads.includes(river))
        var validNeighbors = hexes[currentHex].neighbors.filter(hex =>
          !visited.has(hex) && !unpassableRivers.includes(hex)
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

function distanceTo(unit, destinationHex) {
  let queue = [{ hexIndex: unit.hex.index, distance: 0 }];
  let visited = new Set();
  while (queue.length) {
    let currentNode = queue.shift();
    let currentHex = currentNode.hexIndex;
    let distance = currentNode.distance;

    if (currentHex === destinationHex) {
      return distance;
    } else {
      const unpassableRivers = hexes[currentHex].rivers.filter(river => !hexes[currentHex].roads.includes(river))
      var validNeighbors = hexes[currentHex].neighbors.filter(hex =>
        !visited.has(hex) && !unpassableRivers.includes(hex)
      );
      visited.add(currentHex);
      queue = queue.concat(validNeighbors.map(neighbor => ({ hexIndex: neighbor, distance: distance + 1 })));
    }
  }
}

async function performTurn() {
  await spendAllValourOnGold();
  await trainAllMilitia();
  await gatherAll(primaryUnit());
  await gatherAll(secondaryUnit());

  var graveLocations = [...new Set(galaxy.graveList.map(grave => grave.hexIndex))];
  var freeUnits = [...getIndependentUnitsOnBoard()];
  var enemyDestinations = new Set();

  var highPriorityGraves = graveLocations.filter(graveLocation => {
    const unpassableRivers = hexes[graveLocation].rivers.filter(river => !hexes[graveLocation].roads.includes(river))
    var validNeighbors = hexes[graveLocation].neighbors.filter(hex => !unpassableRivers.includes(hex));

    return validNeighbors.find(neighbor => {
      return freeUnits.find(unit => unit.hexIndex === neighbor || unit.hexTarget === neighbor)
    });
  })
  var lowPriorityGraves = graveLocations.filter(graveLocation => !highPriorityGraves.includes(graveLocation))

  for (var graveLocation of highPriorityGraves) {
    if (freeUnits.length) {
      var chosenUnit = freeUnits.reduce((minUnit, unit) => distanceTo(unit, graveLocation) < distanceTo(minUnit, graveLocation) ? unit : minUnit);
      freeUnits.splice(freeUnits.indexOf(chosenUnit), 1);
      await goToHex(chosenUnit, graveLocation)
    }
  }

  for (var enemyUnit of findEnemyUnits()) {
    var availableUnits = freeUnits.filter(unit => getArmyMight(unit) >= getArmyMight(enemyUnit));
    var availableUnits = availableUnits.length === 0 && freeUnits.length > 0 ? [freeUnits[0]] : availableUnits;
    var targetHex = enemyUnit.hexTarget !== -1 ? enemyUnit.hexTarget : enemyUnit.hexIndex;
    if (targetHex !== -1 && availableUnits.length > 0) {
      var enemyDestination = findClosestUnblightedHexFromIndex(enemyUnit.hexTarget !== -1 ? enemyUnit.hexTarget : enemyUnit.hexIndex);

      if (!enemyDestinations.has(enemyDestination)) {
        var chosenUnit = availableUnits.reduce((minUnit, unit) => distanceTo(unit, enemyDestination) < distanceTo(minUnit, enemyDestination) ? unit : minUnit);

        freeUnits.splice(freeUnits.indexOf(chosenUnit), 1);
        enemyDestinations.add(enemyDestination);
        await goToHex(chosenUnit, enemyDestination)
      }
    }
  }

  for (var graveLocation of lowPriorityGraves) {
    if (freeUnits.length) {
      var chosenUnit = freeUnits.reduce((minUnit, unit) => distanceTo(unit, graveLocation) < distanceTo(minUnit, graveLocation) ? unit : minUnit);
      freeUnits.splice(freeUnits.indexOf(chosenUnit), 1);
      await goToHex(chosenUnit, graveLocation)
    }
  }

  if (graveLocations.length) {
    for (var unit of freeUnits) {
      var chosenGraveLocation = graveLocations.reduce((minGraveLocation, graveLocation) => distanceTo(unit, graveLocation) < distanceTo(unit, minGraveLocation) ? minGraveLocation : graveLocation);
      freeUnits.splice(freeUnits.indexOf(unit), 1);
      await goToHex(unit, chosenGraveLocation)
    }
  }

  if (freeUnits.length) {
    var enemyUnits = findEnemyUnits();
    for (var [index, unit] of freeUnits.entries()) {
      var enemyUnit = enemyUnits[Math.min(enemyUnits.length -1, index)]
      freeUnits.splice(freeUnits.indexOf(unit), 1);
      var enemyDestination = findClosestUnblightedHexFromIndex(enemyUnit.hexTarget !== -1 ? enemyUnit.hexTarget : enemyUnit.hexIndex);
      await goToHex(unit, enemyDestination)
    }
  }

  await nextTurn();
  game.trigger("hide_screen")
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
  game.trigger("hide_screen")

}

async function main() {
  await init();

  while(!galaxy.gameOver) {
    await performTurn();
  }
}
