//conceptual shell for now

import { Animation } from "./animation.js";

export class Character {
    constructor(/* ... */) {
        // position, movement, animations, etc.
    }

    update(dt) {
        this.animation.update(dt);
    }

    draw(ctx) {
        this.animation.draw(ctx, this.x, this.y);
    }
}