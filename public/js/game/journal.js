const categories = [
    ["method", "Method"],
    ["murderer", "Murderer"],
    ["room", "Room"],
    ["victim", "Victim"]
];

export function renderJournal(elements, state, currentUserId) {
    if (!elements.journalEntries) return;
    const player = state?.players.find(candidate => String(candidate.id) === String(currentUserId));
    const hints = player?.discoveredHints || [];
    elements.journalCount.textContent = String(hints.length);

    const sections = categories.map(([category, label]) => {
        const section = document.createElement("section");
        section.className = "journal-category";
        section.dataset.category = category;
        const heading = document.createElement("h3");
        heading.textContent = label;
        const list = document.createElement("ul");
        const categoryHints = hints.filter(hint => hint.category === category);

        if (!categoryHints.length) {
            const empty = document.createElement("li");
            empty.className = "journal-empty";
            empty.textContent = "No clues recorded.";
            list.appendChild(empty);
        } else {
            list.append(...categoryHints.map(hint => {
                const entry = document.createElement("li");
                entry.className = "journal-entry";
                const text = document.createElement("p");
                text.textContent = hint.text;
                entry.appendChild(text);
                return entry;
            }));
        }

        section.append(heading, list);
        return section;
    });

    elements.journalEntries.replaceChildren(...sections);
}
