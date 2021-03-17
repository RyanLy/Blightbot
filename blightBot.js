// For blightBuildNumber = 1052;
// Works on the Ironwood River Human Campaign.
// 1. On the main page, paste this entire file in the chrome console
// 2. Type in main()
// 3. Enjoy!

// Other commands
// pause() to pause the game after the init phase
// resume() to pause the game after the init phase
// restart() to abandon current game and start again


var game = window.Blight.game;
var galaxy = window.galaxy;
var hexes = galaxy?.map.hexes;
var isPaused = false;

// Utils
function printUnits(units) {
  return units.map(u => u.might);
}

function getOwnLocations() {
  return galaxy.placeList.filter((place) => place.player);
}

function getPlayer() {
  return galaxy.playerList[0];
}

async function trainAllMilitia() {
  for (const place of getOwnLocations()) {
    if (place.militiaEta === 0 && getPlayer().gold > place.militiaCost) {
      game.trigger('train_militia', place);
      await delay(1500);
    }
  }
}

async function deployStrongestUnit() {
  const eligibleUnits = getPlayer()
    .getUnits()
    .filter((unit) => unit.x < 1 && getPlayer().gold > unit.cost);

  if (eligibleUnits.length) {
    var strongest = eligibleUnits.reduce((max, unit) =>
      max.might > unit.might ? max : unit
    );

    game.trigger('select_drawn_unit', strongest);
    game.trigger('pre_deploy_drawn_unit', strongest, getPlayer());
    await delay();

    const ownLocations = getOwnLocations();
    game.trigger(
      'target_select_hex',
      ownLocations.reduce((max, unit) => (max.y < unit.y ? max : unit)).hex
    );
    await delay();
  }
}

function findPlacesWithUnclaimedUnit() {
  var startLocation = getPlayer().getStartPlaces()[0];

  var militiaKind = startLocation.militiaKind;
  var placesWithUnclaimedUnits = galaxy.placeList.filter(
    (place) =>
      place.blighted === 0 &&
      !place.player &&
      place.getHex().getUnits().length > 0 &&
      place.militiaKind === militiaKind
  );

  return placesWithUnclaimedUnits.sort((place1, place2) => {
    return distanceTo(startLocation, place1.hexIndex) - distanceTo(startLocation, place2.hexIndex);
  });
}

function findEnemyUnits() {
  return galaxy.unitList
    .filter((unit) => unit.undead === 1 && !unit.getFollowing())
    .sort((unit1, unit2) => {
      return distanceTo(
        unit1,
        findClosestUnblightedHexFromIndex(
          unit1.hexTarget === -1 ? unit1.hexIndex  : unit1.hexTarget
        )
      ) -
        distanceTo(
          unit2,
          findClosestUnblightedHexFromIndex(
            unit2.hexTarget === -1 ?  unit2.hexIndex : unit2.hexTarget
          )
        );
    });
}

function delay(delay = 500) {
  return new Promise((resolve) => {
    setTimeout(function () {
      return resolve();
    }, delay);
  });
}

async function goToHex(unit, hexIndex) {
  if (!unit.isFleeing) {
    game.trigger('select_unit', unit);
    game.trigger('mover_order_auto', hexes[hexIndex]);
    await delay(100);
    game.trigger('select_none');
  }
}

async function nextTurn(delayms = 1250) {
  game.trigger('next_turn');
  await delay(delayms);
}

function getArmyMight(unit) {
  return unit
    .getArmy()
    .map((unit) => unit.might)
    .reduce((a, b) => a + b, 0);
}

function getIndependentUnitsOnBoard() {
  return getPlayer()
    .getUnits()
    .filter((unit) => unit.x > 0 && !unit.getFollowing())
    .sort((unit1, unit2) => getArmyMight(unit1) - getArmyMight(unit2))
    .reverse();
}

function primaryUnit() {
  return getIndependentUnitsOnBoard()[0];
}

function secondaryUnit() {
  return getIndependentUnitsOnBoard()[1];
}

async function gatherAll(unit) {
  if (unit.hex.units.length > 1) {
    game.trigger('gather_all', unit);
    await delay();
  }
}

async function spendAllValourOnGold() {
  const valor = Math.floor(getPlayer().valour / 10) * 10;
  if (valor >= 10) {
    game.trigger('bazaar_buy_gold', valor);
    await delay(1000);
  }
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
        return currentHex;
      } else {
        const unpassableRivers = hexes[currentHex].rivers.filter(
          (river) => !hexes[currentHex].roads.includes(river)
        );
        var validNeighbors = hexes[currentHex].neighbors.filter(
          (hex) => !visited.has(hex) && !unpassableRivers.includes(hex)
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
  game.trigger("show_place", place);
  game.trigger('buy_place', place);
  await delay(2000);
}

function distanceTo(unit, destinationHex) {
  let queue = [{hexIndex: unit.hexIndex, distance: 0}];
  let visited = new Set();
  while (queue.length) {
    let currentNode = queue.shift();
    let currentHex = currentNode.hexIndex;
    let distance = currentNode.distance;

    if (currentHex === destinationHex) {
      return distance;
    } else {
      const unpassableRivers = hexes[currentHex].rivers.filter(
        (river) => !hexes[currentHex].roads.includes(river)
      );
      var validNeighbors = hexes[currentHex].neighbors.filter(
        (hex) => !visited.has(hex) && !unpassableRivers.includes(hex)
      );
      visited.add(currentHex);
      queue = queue.concat(
        validNeighbors.map((neighbor) => ({
          hexIndex: neighbor,
          distance: distance + 1,
        }))
      );
    }
  }
}

async function assignUnitsToEnemies(freeUnits, enemies, enemyDestinations) {
  for (var enemyUnit of enemies) {
    var availableUnits = freeUnits.filter(
      (unit) => getArmyMight(unit) >= getArmyMight(enemyUnit)
    );
    var availableUnits =
      availableUnits.length === 0 && freeUnits.length > 0
        ? freeUnits
        : availableUnits;
    var targetHex =
      enemyUnit.hexTarget === -1 ? enemyUnit.hexIndex : enemyUnit.hexTarget;
    if (targetHex !== -1 && availableUnits.length > 0) {
      var enemyDestination = findClosestUnblightedHexFromIndex(
        enemyUnit.hexTarget === -1 ? enemyUnit.hexIndex : enemyUnit.hexTarget
      );

      if (!enemyDestinations.has(enemyDestination)) {
        var chosenUnit = availableUnits.reduce((minUnit, unit) =>
          distanceTo(unit, enemyDestination) <
          distanceTo(minUnit, enemyDestination)
            ? unit
            : minUnit
        );

        freeUnits.splice(freeUnits.indexOf(chosenUnit), 1);
        enemyDestinations.add(enemyDestination);
        await goToHex(chosenUnit, enemyDestination);
      }
    }
  }
}

async function assignPaths() {
  var graveLocations = [
    ...new Set(galaxy.graveList.map((grave) => (grave.hexTarget !== -1 || !grave.hexTarget) ? [grave.hexTarget,grave.hexIndex][Math.floor(Math.random()*2)] : grave.hexIndex)),
  ];
  var enemyDestinations = new Set();
  var freeUnits = [...getIndependentUnitsOnBoard()];
  var highPriorityUnits = findEnemyUnits().filter(unit => unit.might > 500);
  var lowPriorityUnits = findEnemyUnits().filter(unit => unit.might <= 500);

  await assignUnitsToEnemies(freeUnits, highPriorityUnits, enemyDestinations);

  var highPriorityGraves = graveLocations.filter((graveLocation) => {
    const unpassableRivers = hexes[graveLocation].rivers.filter(
      (river) => !hexes[graveLocation].roads.includes(river)
    );
    var validNeighbors = hexes[graveLocation].neighbors.filter(
      (hex) => !unpassableRivers.includes(hex)
    );

    return validNeighbors.find((neighbor) => {
      return freeUnits.find(
        (unit) => unit.hexIndex === neighbor
      );
    });
  });
  var lowPriorityGraves = graveLocations.filter((graveLocation) => !highPriorityGraves.includes(graveLocation));

  for (var graveLocation of highPriorityGraves) {
    if (freeUnits.length) {
      var chosenUnit = freeUnits.reduce((minUnit, unit) =>
        distanceTo(unit, graveLocation) < distanceTo(minUnit, graveLocation)
          ? unit
          : minUnit
      );
      freeUnits.splice(freeUnits.indexOf(chosenUnit), 1);
      enemyDestinations.add(graveLocation);
      await goToHex(chosenUnit, graveLocation);
    }
  }

  await assignUnitsToEnemies(freeUnits, lowPriorityUnits, enemyDestinations);

  for (var graveLocation of lowPriorityGraves) {
    if (freeUnits.length) {
      var chosenUnit = freeUnits.reduce((minUnit, unit) =>
        distanceTo(unit, graveLocation) < distanceTo(minUnit, graveLocation)
          ? unit
          : minUnit
      );
      freeUnits.splice(freeUnits.indexOf(chosenUnit), 1);
      enemyDestinations.add(graveLocation);
      await goToHex(chosenUnit, graveLocation);
    }
  }

  if (graveLocations.length) {
    for (var unit of freeUnits) {
      var chosenGraveLocation = graveLocations.reduce(
        (minGraveLocation, graveLocation) =>
          distanceTo(unit, graveLocation) < distanceTo(unit, minGraveLocation)
            ? minGraveLocation
            : graveLocation
      );
      freeUnits.splice(freeUnits.indexOf(unit), 1);
      await goToHex(unit, chosenGraveLocation);
    }
  }

  var enemyUnits = findEnemyUnits().length;
  if (freeUnits.length && !galaxy.gameOver && enemyUnits > 0) {
    var enemyUnits = findEnemyUnits()
      .sort((unit1, unit2) => getArmyMight(unit1) - getArmyMight(unit2))
      .reverse();

    for (var [index, unit] of freeUnits.entries()) {
      var enemyUnit = enemyUnits[Math.min(enemyUnits.length - 1, index)];
      freeUnits.splice(freeUnits.indexOf(unit), 1);
      var enemyDestination = findClosestUnblightedHexFromIndex(
        enemyUnit.hexTarget === -1 ? enemyUnit.hexIndex : enemyUnit.hexTarget
      );
      await goToHex(unit, enemyDestination);
    }
  }
}

async function performTurn(commit = true) {
  await spendAllValourOnGold();
  await trainAllMilitia();
  await gatherAll(primaryUnit());
  await gatherAll(secondaryUnit());

  await assignPaths();

  if (commit) {
    await nextTurn();
    console.info('Turn complete');
  }
}

async function init() {
  await trainAllMilitia();
  await deployStrongestUnit();
  await gatherAllUnits();

  var placeToBuy = findPlacesWithUnclaimedUnit()[0];
  while(placeToBuy && !placeToBuy.player) {
    if (placeToBuy.canBuy()) {
      await buyPlace(placeToBuy);
      break;
    } else{
      await trainAllMilitia();
      await gatherAll(primaryUnit());
      await assignPaths();
      await goToHex(primaryUnit(), placeToBuy.hexIndex);
      await nextTurn(1750);
    }
  }
  console.log('bought!');

  await deployStrongestUnit();
  await trainAllMilitia();
  await gatherAllUnits();

  console.info('Init complete');
}

async function confirmDeck() {
  game.trigger('deck_built');
  await delay(2000);
  console.info('Game started');
}

function pause() {
  isPaused = true;
}

function resume() {
  isPaused = false;
}

async function restart() {
  galaxy.gameOver = true;
  game.trigger('launch_menu', 'main_menu');
  await delay(3000);

  await main();
}

async function main(loop = false) {
  console.info('Starting');

  window.Blight.menu.trigger('create_sp_game', {
    kind: 'ironwood',
    difficulty: '1',
  });
  await delay(5000);

  game = window.Blight.game;
  galaxy = window.galaxy;
  hexes = galaxy.map.hexes;
  isPaused = false;

  await confirmDeck();
  await init();

  while (!galaxy.gameOver) {
    if (!isPaused) {
      await performTurn();
    } else {
      await delay();
    }
  }

  console.info('Game done!');

  if (loop) {
    restart();
  }
}
