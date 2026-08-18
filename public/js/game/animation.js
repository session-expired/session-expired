export class Animation {
    constructor(image, frames) {
        this.image = image;
        this.frames = frames;

        this.currentFrame = 0;
        this.elapsed = 0;
    }

    update(dt) {
        const frame = this.frames[this.currentFrame];

        this.elapsed += dt;

        if (this.elapsed >= frame.duration) {
            this.elapsed -= frame.duration;
            this.currentFrame =
                (this.currentFrame + 1) % this.frames.length;
        }
    }

    draw(ctx, x, y) {
        const frame = this.frames[this.currentFrame].frame;

        ctx.drawImage(
            this.image,
            frame.x,
            frame.y,
            frame.w,
            frame.h,
            x,
            y,
            frame.w,
            frame.h
        );
    }
}