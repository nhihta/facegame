const config = {
    type: Phaser.AUTO,
    width: 360,
    height: 640,
    pixelArt: true,
    scene: { preload, create }
};

new Phaser.Game(config);

// ================= CONFIG =================
const ROWS = 6;
const COLS = 5;
const CELL = 56;
const GAP = 6;
const OFFSET_X = (360 - COLS * (CELL + GAP)) / 2;
const OFFSET_Y = 110;

const TOTAL_TIME = 120;
const BAR_WIDTH = 240;
const BAR_X = 60;
const BAR_Y = 50;
const MAX_HINT = 3;

// ================= STATE =================
let first = null;
let second = null;
let lock = false;

let matchedPairs = 0;
let score = 0;
let scoreText;

let timeLeft = TOTAL_TIME;
let timerEvent;
let timeBarGfx;

let hintLeft = MAX_HINT;
let hintText;

let bgm, sfxMatch, sfxWrong;

// ================= UTILS =================
function fitToCell(img, size) {
    const scale = Math.floor((size / img.width) * 100) / 100;
    img.setScale(scale);
}

// ================= PHASER =================
function preload() {
    this.load.image('back', 'assets/back.png');
    for (let i = 1; i <= 20; i++) {
        this.load.image(`food${i}`, `assets/food${i}.jpeg`);
    }

    this.load.audio('bgm', 'assets/bgm.mp3');
    this.load.audio('match', 'assets/match.mp3');
    this.load.audio('wrong', 'assets/wrong.mp3');
}

function create() {
    // ===== SCORE =====
    scoreText = this.add.text(16, 18, 'Score: 0', {
        fontSize: '18px',
        fill: '#fff'
    });

    // ===== HINT =====
    hintText = this.add.text(260, 18, `Hint: ${hintLeft}`, {
        fontSize: '18px',
        fill: '#00ffff'
    }).setInteractive();

    hintText.on('pointerdown', () => useHint.call(this));

    // ===== TIME BAR BACKGROUND =====
    this.add.rectangle(BAR_X, BAR_Y, BAR_WIDTH, 12, 0x222222).setOrigin(0);

    // ===== TIME BAR GRAPHICS =====
    timeBarGfx = this.add.graphics();
    drawTimeBar(this);

    // ===== TIMER =====
    timerEvent = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: updateTime,
        callbackScope: this
    });

    // ===== SOUND =====
    bgm = this.sound.add('bgm', { loop: true, volume: 0.4 });
    sfxMatch = this.sound.add('match', { volume: 0.8 });
    sfxWrong = this.sound.add('wrong', { volume: 0.8 });
    bgm.play();

    // ===== CARD VALUES (16 PAIRS = 32 CARDS) =====
    const values = [];
    for (let i = 1; i <= 16; i++) {
        values.push(`food${i}`, `food${i}`);
    }
    Phaser.Utils.Array.Shuffle(values);

    let idx = 0;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const x = OFFSET_X + c * (CELL + GAP) + CELL / 2;
            const y = OFFSET_Y + r * (CELL + GAP) + CELL / 2;

            const card = this.add.image(x, y, 'back')
                .setInteractive()
                .setData({
                    value: values[idx],
                    flipped: false,
                    removed: false
                });

            fitToCell(card, CELL);
            card.on('pointerdown', () => flipCard.call(this, card));
            idx++;
        }
    }
}

// ================= TIME BAR =================
function drawTimeBar(scene) {
    const percent = Phaser.Math.Clamp(timeLeft / TOTAL_TIME, 0, 1);
    const width = BAR_WIDTH * percent;

    let color;
    if (percent > 0.66) {
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
            new Phaser.Display.Color(0, 255, 0),
            new Phaser.Display.Color(255, 255, 0),
            1,
            (1 - percent) / 0.34
        );
    } else if (percent > 0.33) {
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
            new Phaser.Display.Color(255, 255, 0),
            new Phaser.Display.Color(255, 165, 0),
            1,
            (0.66 - percent) / 0.33
        );
    } else {
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
            new Phaser.Display.Color(255, 165, 0),
            new Phaser.Display.Color(255, 0, 0),
            1,
            (0.33 - percent) / 0.33
        );
    }

    const hex = Phaser.Display.Color.GetColor(color.r, color.g, color.b);

    timeBarGfx.clear();
    timeBarGfx.fillStyle(hex, 1);
    timeBarGfx.fillRect(BAR_X, BAR_Y, width, 12);

    // viền trắng kiểu Pokémon
    timeBarGfx.lineStyle(1, 0xffffff);
    timeBarGfx.strokeRect(BAR_X, BAR_Y, BAR_WIDTH, 12);

    // nhấp nháy khi sắp hết giờ
    if (timeLeft <= 10) {
        timeBarGfx.alpha = Math.sin(scene.time.now / 100) * 0.5 + 0.5;
    } else {
        timeBarGfx.alpha = 1;
    }
}

function updateTime() {
    timeLeft--;
    drawTimeBar(this);

    if (timeLeft <= 0) {
        gameOver.call(this);
    }
}

// ================= GAME LOGIC =================
function flipCard(card) {
    if (lock || card.getData('flipped') || card.getData('removed') || timeLeft <= 0) return;

    lock = true;
    card.setData('flipped', true);

    flipAnimation(this, card, card.getData('value'), () => {
        if (!first) {
            first = card;
            lock = false;
            return;
        }

        second = card;

        if (first.getData('value') === second.getData('value')) {
            score += 10;
            matchedPairs++;
            scoreText.setText('Score: ' + score);
            sfxMatch.play();

            removePair.call(this, first, second);
            resetTurn();

            if (matchedPairs === 20) {
                winGame.call(this);
            }
        } else {
            sfxWrong.play();
            this.time.delayedCall(600, () => {
                flipBack.call(this, first);
                flipBack.call(this, second);
                resetTurn();
            });
        }
    });
}

function flipBack(card) {
    flipAnimation(this, card, 'back', () => {
        card.setData('flipped', false);
    });
}

function removePair(c1, c2) {
    c1.setData('removed', true);
    c2.setData('removed', true);

    this.tweens.add({
        targets: [c1, c2],
        alpha: 0,
        duration: 300,
        onComplete: () => {
            c1.destroy();
            c2.destroy();
        }
    });
}

function resetTurn() {
    first = null;
    second = null;
    lock = false;
}

// ================= HINT =================
function useHint() {
    if (hintLeft <= 0 || lock) return;

    const cards = this.children.list.filter(c =>
        c instanceof Phaser.GameObjects.Image &&
        c.getData &&
        c.getData('value') &&
        !c.getData('removed') &&
        !c.getData('flipped')
    );


    for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            if (cards[i].getData('value') === cards[j].getData('value')) {
                hintLeft--;
                hintText.setText(`Hint: ${hintLeft}`);

                flipAnimation(this, cards[i], cards[i].getData('value'));
                flipAnimation(this, cards[j], cards[j].getData('value'));

                this.time.delayedCall(800, () => {
                    flipBack.call(this, cards[i]);
                    flipBack.call(this, cards[j]);
                });
                return;
            }
        }
    }
}

// ================= FLIP ANIMATION =================
function flipAnimation(scene, card, newTexture, onComplete) {
    scene.tweens.add({
        targets: card,
        scaleX: 0,
        duration: 150,
        onComplete: () => {
            card.setTexture(newTexture);
            fitToCell(card, CELL);
            scene.tweens.add({
                targets: card,
                scaleX: card.scale,
                duration: 150,
                onComplete
            });
        }
    });
}

// ================= END =================
function winGame() {
    timerEvent.remove();
    bgm.stop();

    this.add.rectangle(180, 320, 360, 640, 0x000000, 0.75);
    this.add.text(180, 280, 'BẠN THẮNG 🎉', {
        fontSize: '22px',
        fill: '#00ffcc'
    }).setOrigin(0.5);
}

function gameOver() {
    timerEvent.remove();
    bgm.stop();

    this.add.rectangle(180, 320, 360, 640, 0x000000, 0.75);
    this.add.text(180, 280, 'HẾT GIỜ ⏰', {
        fontSize: '22px',
        fill: '#ff5555'
    }).setOrigin(0.5);
}
