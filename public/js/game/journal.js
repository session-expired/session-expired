const categoryLabels = {
    murderer: "Murderer",
    victim: "Victim",
    room: "Room",
    method: "Method"
};

export function renderJournal(elements, state, currentUserId) {
    if (!elements.journalEntries) return;
    const player = state?.players.find(candidate => String(candidate.id) === String(currentUserId));
    const hints = player?.discoveredHints || [];
    elements.journalCount.textContent = String(hints.length);

    if (!hints.length) {
        const empty = document.createElement("li");
        empty.className = "journal-empty";
        empty.textContent = "No clues recorded yet.";
        elements.journalEntries.replaceChildren(empty);
        return;
    }

    elements.journalEntries.replaceChildren(...hints.map((hint, index) => {
        const entry = document.createElement("li");
        entry.className = "journal-entry";
        const heading = document.createElement("span");
        heading.className = "journal-entry-heading";
        heading.textContent = `${index + 1}. ${categoryLabels[hint.category] || hint.category}`;
        const text = document.createElement("p");
        text.textContent = hint.text;
        entry.append(heading, text);
        return entry;
    }));
}
