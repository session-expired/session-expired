//This javascript serves the purpose of shuffling the options in the game, and puttin them into
//4 containers which will be used to auto fill in each players inventory

const methods =[
    "Electrocuted",
    "Lobotomized",
    "Defenestrated",
    "Eviscerated",
    "Poisoned",
    "Suffocated",
];

const rooms = [
    "Warden's Office",
    "Hydrotherapy",
    "Operating Theater",
    "Padded Cells",
    "Solitary Confinement",
    "Electrotherapy",
    "Showers",
    "Cafeteria",
    "Rec Room",
];

const characters = [
  "Tycho Brahe",
  "Ada Lovelace",
  "Marie Curie",
  "Grigori Rasputin",
  "Aleister Crowley",
  "Typhoid Mary",
];

const numContainers = 4;

//This function shuffles the array randomly to gurantee no two will be alike
function shuffle(array){
    const result = [...array];
    for(let i = result.length-1; i> 0 ; i--){
        const j = Math.floor(Math.random() * (i+1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

//This function builds the containers
function buildContainers(){
    const shuffledMethods = shuffle(methods).slice(0, numContainers);
     const shuffledRooms = shuffle(rooms).slice(0, numContainers);
    const shuffledCharacters = shuffle(characters).slice(0, numContainers);
    
    const containers = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push({
        container: i + 1,
        method: shuffledMethods[i],
        room: shuffledRooms[i],
        character: shuffledCharacters[i],
        });
    }
    return containers;
}

const containers = buildContainers();

containers.forEach((c) => {
    console.log(`Container ${c.container}:`);
    console.log(`  Method:    ${c.method}`);
    console.log(`  Room:      ${c.room}`);
    console.log(`  Character: ${c.character}`);
    console.log("");
});