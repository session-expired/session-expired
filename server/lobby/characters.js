const characters = [
  { id: "curie", name: "Marie Curie", image: "/assets/images/chars/curie/curie.png" },
  { id: "rasputin", name: "Grigori Rasputin", image: "/assets/images/chars/rasputin/rasputin.png" },
  { id: "brahe", name: "Tycho Brahe", image: "/assets/images/chars/brahe/brahe.png" },
  { id: "lovelace", name: "Ada Lovelace", image: "/assets/images/chars/lovelace/lovelace.png" },
  { id: "crowley", name: "Aleister Crowley", image: "/assets/images/chars/crowley/crowley.png" },
  { id: "mallon", name: "Mary Mallon", image: "/assets/images/chars/mallon/mallon.png" }
];

const characterIds = new Set(characters.map((character) => character.id));

module.exports = { characters, characterIds };
