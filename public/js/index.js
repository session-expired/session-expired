const button = document.getElementById("joinGame");

button.addEventListener("click", ()=>{
   window.location.href='./pages/lobbyPage.html'
});

const playHook = document.getElementById("play-hook");
const warden = document.getElementById("wandering-warden");
const patientLayer = document.getElementById("wandering-patients");
const patientNames = ["brahe", "crowley", "curie", "lovelace", "mallon", "rasputin"];
const characters = [];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function createPatient(name, index) {
  const patient = document.createElement("div");
  patient.className = "hook-character hook-patient";
  patient.dataset.character = name;
  patient.style.backgroundImage = `url("/assets/images/chars/${name}/${name}.png")`;
  patient.dataset.phase = String(index * 83);
  patientLayer.appendChild(patient);
  characters.push(patient);
  return patient;
}

function place(character, x, y, facing = 1) {
  character.style.left = `${x}px`;
  character.style.top = `${y}px`;
  character.dataset.facing = String(facing);
}

function wander(character) {
  if (reducedMotion) return;
  const maxX = Math.max(0, playHook.clientWidth - 38);
  const x = 8 + Math.random() * Math.max(0, maxX - 16);
  const y = 158 + Math.random() * Math.max(0, playHook.clientHeight - 220);
  const currentX = Number.parseFloat(character.style.left) || 0;
  const distance = Math.abs(x - currentX);
  const duration = 1800 + distance * 13 + Math.random() * 1800;

  character.dataset.walking = "true";
  character.dataset.facing = x < currentX ? "-1" : "1";
  character.style.transition = `left ${duration}ms linear, top ${duration}ms ease-in-out`;
  place(character, x, y, character.dataset.facing);
  window.setTimeout(() => {
    character.dataset.walking = "false";
    window.setTimeout(() => wander(character), 350 + Math.random() * 1300);
  }, duration);
}

function patrolWarden() {
  if (reducedMotion) return;
  const currentX = Number.parseFloat(warden.style.left) || 12;
  const targetX = currentX < playHook.clientWidth / 2 ? playHook.clientWidth - 52 : 12;
  const duration = Math.max(2400, Math.abs(targetX - currentX) * 10);
  warden.dataset.walking = "true";
  warden.dataset.facing = targetX < currentX ? "-1" : "1";
  warden.style.transition = `left ${duration}ms linear`;
  warden.style.left = `${targetX}px`;
  window.setTimeout(patrolWarden, duration);
}

function animateSprites(time) {
  [warden, ...characters].forEach((character) => {
    const phase = Number(character.dataset.phase) || 0;
    const frame = character.dataset.walking === "true" ? 1 + Math.floor((time + phase) / 100) % 6 : 0;
    const facing = Number(character.dataset.facing) || 1;
    character.style.backgroundPosition = `${frame * -32}px 0`;
    character.style.transform = `scale(${facing * 1.65}, 1.65) scale(var(--character-scale))`;
  });
  window.requestAnimationFrame(animateSprites);
}

warden.dataset.character = "bonaparte";
place(warden, 12, 128, 1);
warden.dataset.walking = reducedMotion ? "false" : "true";
patientNames.forEach((name, index) => {
  const patient = createPatient(name, index);
  place(patient, 35 + index * Math.max(45, (playHook.clientWidth - 100) / patientNames.length), 165 + (index % 3) * 12, index % 2 ? -1 : 1);
  if (!reducedMotion) window.setTimeout(() => wander(patient), index * 240);
});

if (!reducedMotion) window.setTimeout(patrolWarden, 80);
window.requestAnimationFrame(animateSprites);
