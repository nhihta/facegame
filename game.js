// ================= PHASER CONFIG =================
const config = {
    type: Phaser.WEBGL,
    width: 360,
    height: 640,
    parent: document.body,
    backgroundColor: '#2d2d2d',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: { preload, create }
};

const game = new Phaser.Game(config);

// ================= CONSTANTS =================
const ROWS = 6;
const COLS = 5;
const CELL = 56;
const GAP = 6;

// Tính toán offset
const BOARD_WIDTH = COLS * CELL + (COLS - 1) * GAP;
const OFFSET_X = (360 - BOARD_WIDTH) / 2 + CELL / 2;
const OFFSET_Y = 130 + CELL / 2;

const TOTAL_TIME = 120;
const BAR_WIDTH = 240;
const BAR_X = 60;
const BAR_Y = 60;
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

// ================= PRELOAD =================
function preload() {
    // 1. Load Hình ảnh
    this.load.image('backBig', 'assets/back.png');
    for (let i = 1; i <= 16; i++) {
        this.load.image(`food${i}`, `assets/food${i}.png`);
    }

    // 2. Load Âm thanh (Audio)
    this.load.audio('bgm', 'assets/bgm.mp3');
    this.load.audio('match', 'assets/match.mp3');
    this.load.audio('wrong', 'assets/wrong.mp3');
}

// ================= HELPERS: XỬ LÝ ẢNH =================
function prepareBackFrames(scene) {
    if (!scene.textures.exists('backBig')) {
        createFallbackTexture(scene);
        return;
    }

    const texture = scene.textures.get('backBig');
    const source = texture.getSourceImage();

    if (!source || source.width === 0) {
        createFallbackTexture(scene);
        return;
    }

    const imgW = source.width;
    const imgH = source.height;
    const stepX = imgW / COLS;
    const stepY = imgH / ROWS;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            texture.add(
                `piece_${r}_${c}`,
                0,
                c * stepX, r * stepY,
                stepX, stepY
            );
        }
    }
}

function createFallbackTexture(scene) {
    if (!scene.textures.exists('fallback_bg')) {
        const graphics = scene.make.graphics({ add: false });
        graphics.fillStyle(0x2ecc71);
        graphics.fillRect(0, 0, CELL, CELL);
        graphics.lineStyle(2, 0xffffff);
        graphics.strokeRect(0, 0, CELL, CELL);
        graphics.generateTexture('fallback_bg', CELL, CELL);
    }
}

// ================= CREATE =================
function create() {
    resetGameState();

    // --- ÂM THANH: Phát nhạc nền ---
    // Kiểm tra để tránh lỗi trình duyệt chặn autoplay
    if (!this.sound.get('bgm')) {
        this.sound.play('bgm', {
            loop: true,
            volume: 0.5 // Âm lượng 50%
        });
    } else if (!this.sound.get('bgm').isPlaying) {
        this.sound.play('bgm', { loop: true, volume: 0.5 });
    }

    createUI.call(this);
    prepareBackFrames(this);
    createBoard.call(this);

    if (timerEvent) timerEvent.remove();
    timerEvent = this.time.addEvent({
        delay: 1000,
        callback: updateTime,
        callbackScope: this,
        loop: true
    });
}

function resetGameState() {
    first = null;
    second = null;
    lock = false;
    matchedPairs = 0;
    score = 0;
    timeLeft = TOTAL_TIME;
    hintLeft = MAX_HINT;
}

function createUI() {
    scoreText = this.add.text(20, 20, 'Score: 0', { fontSize: '24px', fill: '#fff', fontStyle: 'bold' });

    hintText = this.add.text(340, 20, 'Hint: ' + MAX_HINT, { fontSize: '24px', fill: '#fff', fontStyle: 'bold' })
        .setOrigin(1, 0).setInteractive();
    hintText.on('pointerdown', () => useHint.call(this));

    timeBarGfx = this.add.graphics();
    drawTimeBar(this);
}

function createBoard() {
    const values = [];
    for (let i = 1; i <= 15; i++) {
        values.push(`food${i}`, `food${i}`);
    }
    Phaser.Utils.Array.Shuffle(values);

    let idx = 0;
    const texture = this.textures.get('backBig');
    const hasFrames = texture && texture.has('piece_0_0');

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const x = OFFSET_X + c * (CELL + GAP);
            const y = OFFSET_Y + r * (CELL + GAP);

            let textureKey = hasFrames ? 'backBig' : 'fallback_bg';
            let frameKey = hasFrames ? `piece_${r}_${c}` : null;

            const card = this.add.image(x, y, textureKey, frameKey)
                .setDisplaySize(CELL, CELL)
                .setInteractive()
                .setData({
                    value: values[idx],
                    flipped: false,
                    removed: false,
                    baseTexture: textureKey,
                    baseFrame: frameKey
                });

            card.on('pointerdown', () => flipCard.call(this, card));
            idx++;
        }
    }
}

// ================= TIME =================
function drawTimeBar(scene) {
    if (!timeBarGfx) return;
    const percent = Phaser.Math.Clamp(timeLeft / TOTAL_TIME, 0, 1);
    timeBarGfx.clear();
    timeBarGfx.lineStyle(2, 0xffffff);
    timeBarGfx.strokeRect(BAR_X, BAR_Y, BAR_WIDTH, 14);

    if (percent > 0.5) timeBarGfx.fillStyle(0x00ff00);
    else if (percent > 0.2) timeBarGfx.fillStyle(0xffff00);
    else timeBarGfx.fillStyle(0xff0000);

    timeBarGfx.fillRect(BAR_X, BAR_Y, BAR_WIDTH * percent, 14);
}

function updateTime() {
    if (timeLeft > 0) {
        timeLeft--;
        drawTimeBar(this);
    } else {
        timerEvent.remove();
        lock = true;
        this.add.text(180, 320, 'GAME OVER', { fontSize: '40px', color: '#f00', backgroundColor: '#000', padding: { x: 10, y: 10 } })
            .setOrigin(0.5).setDepth(100);

        // Dừng nhạc khi thua (tùy chọn)
        this.sound.stopAll();
    }
}

// ================= GAME LOGIC =================
function flipCard(card) {
    if (lock || card.getData('flipped') || card.getData('removed')) return;
    if (first && second) return;

    card.setData('flipped', true);

    flipAnimation(this, card, card.getData('value'), null, () => {
        if (!first) {
            first = card;
            return;
        }
        second = card;
        lock = true;

        if (first.getData('value') === second.getData('value')) {
            // --- MATCH: Đúng cặp ---
            this.sound.play('match');

            score += 10;
            matchedPairs++;
            scoreText.setText('Score: ' + score);
            removePair(first, second);
            if (matchedPairs === 15) {
                this.add.text(180, 320, 'YOU WIN!', { fontSize: '40px', color: '#0f0', backgroundColor: '#000', padding: { x: 10, y: 10 } })
                    .setOrigin(0.5).setDepth(100);
                timerEvent.remove();

                // Dừng nhạc khi thắng
                this.sound.stopAll();
                // Nếu muốn có nhạc win thì thêm: this.sound.play('win');
            }
            resetTurn();
        } else {
            // --- WRONG: Sai cặp ---
            this.sound.play('wrong');

            this.time.delayedCall(800, () => {
                flipBack(first);
                flipBack(second);
                resetTurn();
            });
        }
    });
}

function flipBack(card) {
    if (!card.scene) return;
    flipAnimation(
        card.scene,
        card,
        card.getData('baseTexture'),
        card.getData('baseFrame'),
        () => card.setData('flipped', false)
    );
}

function flipAnimation(scene, card, texture, frame, onComplete) {
    scene.tweens.add({
        targets: card,
        scaleX: 0,
        duration: 150,
        onComplete: () => {
            if (card.active) {
                card.setTexture(texture, frame);
                card.setDisplaySize(CELL, CELL);

                const targetScaleX = card.scaleX;
                card.scaleX = 0;

                scene.tweens.add({
                    targets: card,
                    scaleX: targetScaleX,
                    duration: 150,
                    onComplete: onComplete
                });
            }
        }
    });
}

function removePair(a, b) {
    a.setData('removed', true);
    b.setData('removed', true);
    a.scene.tweens.add({
        targets: [a, b], alpha: 0, scale: 0.1, duration: 300,
        onComplete: () => { a.destroy(); b.destroy(); }
    });
}

function resetTurn() {
    first = null; second = null; lock = false;
}

// ================= HINT =================
function useHint() {
    if (hintLeft <= 0 || lock || first) return;
    const cards = this.children.list.filter(c => c.type === 'Image' && c.getData && !c.getData('removed') && !c.getData('flipped'));

    for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
            if (cards[i].getData('value') === cards[j].getData('value')) {
                hintLeft--;
                hintText.setText(`Hint: ${hintLeft}`);
                lock = true;

                // Gợi ý cũng phát tiếng lật thẻ (nếu có), tạm thời chưa thêm
                flipAnimation(this, cards[i], cards[i].getData('value'), null);
                flipAnimation(this, cards[j], cards[j].getData('value'), null);

                this.time.delayedCall(1000, () => {
                    flipBack(cards[i]);
                    flipBack(cards[j]);
                    lock = false;
                });
                return;
            }
        }
    }
}