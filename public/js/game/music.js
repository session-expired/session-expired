const music = new Audio("/assets/audio/music/game_loop_1.mp3");
const toggleButton = document.getElementById("music-toggle");
const volumeControl = document.getElementById("music-volume");

music.loop = true;
music.volume = Number(volumeControl.value);

function updateToggleButton() {
    const isPaused = music.paused;
    toggleButton.textContent = isPaused ? "Play music" : "Pause music";
    toggleButton.setAttribute("aria-label", isPaused ? "Play music" : "Pause music");
    toggleButton.setAttribute("aria-pressed", String(!isPaused));
}

async function playMusic() {
    try {
        await music.play();
    } catch (error) {
        // Browsers may require a user gesture before audio can begin.
    }
    updateToggleButton();
}

toggleButton.addEventListener("click", () => {
    if (music.paused) {
        playMusic();
    } else {
        music.pause();
        updateToggleButton();
    }
});

volumeControl.addEventListener("input", event => {
    music.volume = Number(event.target.value);
});

// Try on page load, then retry once after the first interaction if autoplay is blocked.
playMusic();
document.addEventListener("pointerdown", event => {
    if (event.target !== toggleButton) playMusic();
}, { once: true });
document.addEventListener("keydown", event => {
    if (event.target !== toggleButton) playMusic();
}, { once: true });
