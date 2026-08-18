const music = new Audio("../assets/audio/game_loop.mp3");

music.loop = true;
music.volume = 0.4;

export function playMusic() {
    music.play();
}

export function pauseMusic() {
    music.pause();
}

export function setVolume(volume) {
    music.volume = volume;
}

export function toggleMute() {
    music.muted = !music.muted;
    return music.muted;
}