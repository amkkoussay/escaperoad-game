// --- Game Setup ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 400;

// --- 1. Advanced Physics & Math Helpers ---
// دالة تصادم رياضية دقيقة (دائرة مقابل مستطيل) بدلاً من AABB البسيط
function circleRectCollision(circle, rect) {
    let testX = circle.x + circle.radius;
    let testY = circle.y + circle.radius;
    if (circle.x + circle.radius < rect.x) testX = rect.x;
    else if (circle.x + circle.radius > rect.x + rect.width) testX = rect.x + rect.width;
    if (circle.y + circle.radius < rect.y) testY = rect.y;
    else if (circle.y + circle.radius > rect.y + rect.height) testY = rect.y + rect.height;
    
    let distX = (circle.x + circle.radius) - testX;
    let distY = (circle.y + circle.radius) - testY;
    return (distX * distX + distY * distY) <= (circle.radius * circle.radius);
}

// --- Game Classes ---
class Player {
    constructor(game) {
        this.game = game;
        this.width = 30;
        this.height = 30;
        this.radius = this.width / 2; // فيزياء دائرية
        this.x = 50;
        this.y = this.game.groundLevel - this.height;
        
        // --- فيزياء أعمق: زخم (Momentum) وقصور ذاتي ---
        this.vx = 0; 
        this.vy = 0;
        this.mass = 1.2; // الكتلة تؤثر على الجاذبية والارتداد
        this.friction = 0.85; // احتكاك الهواء/الأرض
        this.bounceFactor = 0.4; // معامل الارتداد
        
        this.color = "#4db8ff";
        this.isGrounded = true;
        
        // --- تقنيات فيزياء الألعاب (Game Feel) ---
        this.coyoteTime = 0; // يسمح بالقفز بعد مغادرة الأرض بجزء من الثانية
        this.jumpBuffer = 0; // يسجل ضغطة الزر قبل الهبوط لتنفذ فوراً
    }

    draw() {
        // رسم دائري بدلاً من مربع ليعكس الفيزياء الدقيقة
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + this.radius, this.y + this.radius, this.radius, 0, 2 * Math.PI);
        ctx.fill();

        if (this.game.shieldActive) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.radius, this.y + this.radius, this.radius + 8, 0, 2 * Math.PI);
            ctx.stroke();
        }
    }

    update() {
        // تطبيق الجاذبية بناءً على الكتلة (F = ma -> a = F/m)
        if (!this.isGrounded) {
            this.vy += (this.game.physics.gravity * this.mass);
        }
        
        // تطبيق الاحتكاك (Friction)
        this.vx *= this.friction;
        
        this.x += this.vx;
        this.y += this.vy;

        // تحديث مؤقت Coyote Time و Jump Buffer
        if (this.isGrounded) this.coyoteTime = 6; // 6 frames
        else this.coyoteTime--;
        
        if (this.jumpBuffer > 0) this.jumpBuffer--;

        // تنفيذ القفز المؤجل (Jump Buffering)
        if (this.jumpBuffer > 0 && this.coyoteTime > 0) {
            this.jump();
            this.coyoteTime = 0;
            this.jumpBuffer = 0;
        }

        // تصادم الأرض مع ارتداد (Bounce) إذا كانت السرعة عالية
        if (this.y >= this.game.groundLevel - this.height) {
            this.y = this.game.groundLevel - this.height;
            if (Math.abs(this.vy) > 5) {
                this.vy = -this.vy * this.bounceFactor; // ارتداد حقيقي
            } else {
                this.vy = 0;
                this.isGrounded = true;
            }
        }
    }

    jump() {
        if (this.coyoteTime > 0 || this.isGrounded) {
            this.isGrounded = false;
            // قوة القفز تتأثر بالكتلة
            this.vy = this.game.physics.jumpForce * Math.sqrt(this.mass); 
        }
    }
    
    bufferJump() {
        this.jumpBuffer = 8; // 8 frames buffer
    }
}

class Obstacle {
    constructor(game, type = 'low') {
        this.game = game;
        this.type = type;
        
        // --- توليد إجرائي: أشكال مختلفة ---
        if (type === 'low') {
            this.width = 30; this.height = 30;
            this.y = this.game.groundLevel - this.height;
        } else if (type === 'high') {
            this.width = 40; this.height = 20;
            this.y = this.game.groundLevel - this.height - 50; // عقبة طائرة
        } else if (type === 'wide') {
            this.width = 60; this.height = 25;
            this.y = this.game.groundLevel - this.height;
        }
        
        this.x = canvas.width;
        this.color = type === 'high' ? "#ff9900" : "#ff4d4d";
    }

    draw() {
        ctx.fillStyle = this.color;
        // رسم بزوايا دائرية بسيطة (Rounded Rect) لمظهر أفضل
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 5);
        ctx.fill();
    }

    update() {
        let speed = this.game.obstacleSpeed;
        if (this.game.timeSlowed) speed /= 2;
        this.x -= speed;
    }
}

class PowerUp {
    constructor(game) {
        this.game = game;
        this.width = 20; this.height = 20;
        this.x = canvas.width;
        this.y = this.game.groundLevel - this.height - Math.random() * 80 - 40;
        this.duration = 5000;
        this.type = this.getRandomType();
        this.color = this.getColorForType();
        this.bobOffset = 0; // حركة طفو (Bobbing)
    }
    getRandomType() {
        const types = ["scoreMultiplier", "shield", "highJump", "slowTime"];
        return types[Math.floor(Math.random() * types.length)];
    }
    getColorForType() {
        switch (this.type) {
            case "scoreMultiplier": return "#ffd700";
            case "shield": return "#00bfff";
            case "highJump": return "#32cd32";
            case "slowTime": return "#8a2be2";
            default: return "#cccccc";
        }
    }
    draw() {
        this.bobOffset += 0.1;
        const drawY = this.y + Math.sin(this.bobOffset) * 5;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, drawY + this.height/2, this.width/2, 0, 2 * Math.PI);
        ctx.fill();
    }
    update() {
        let speed = this.game.obstacleSpeed;
        if (this.game.timeSlowed) speed /= 2;
        this.x -= speed;
    }
}

// --- 4. Adaptive AI Director (الذكاء التكيّفي) ---
class AIDirector {
    constructor(game) {
        this.game = game;
        this.playerStress = 0; // مستوى توتر اللاعب (0 - 100)
        this.threatLevel = 1; // مستوى التهديد (يؤثر على التوليد الإجرائي)
        this.timeSinceLastHit = 0;
    }

    update() {
        this.timeSinceLastHit++;
        
        // إذا اللاعب عايش من فترة، نرفع التهديد (اللعبة تصير أصعب)
        if (this.timeSinceLastHit > 600) { // ~10 seconds
            this.threatLevel = Math.min(this.threatLevel + 0.005, 5);
            this.playerStress = Math.min(this.playerStress + 0.1, 100);
        }
        
        // نخفض التهديد تدريجياً إذا كان عالياً جداً (لعدم إحباط اللاعب)
        if (this.threatLevel > 3) {
            this.threatLevel -= 0.001; 
        }
    }

    onPlayerDeath() {
        // إذا مات، نرجع التهديد لـ 1 (نعطيه فرصة)
        this.threatLevel = 1;
        this.playerStress = 0;
        this.timeSinceLastHit = 0;
    }
}

// --- 3. Leaderboard & Backend Mock ---
class LeaderboardManager {
    constructor() {
        this.localScores = JSON.parse(localStorage.getItem('globalLeaderboard') || '[]');
    }

    async saveScore(name, score) {
        const newScore = { name, score, date: Date.now() };
        
        // هنا تضع رابط الـ Backend الحقيقي (Node.js/Express أو Firebase)
        /* 
        try {
            const response = await fetch('https://your-backend-api.com/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newScore)
            });
            if(response.ok) console.log("Saved to server!");
        } catch (e) { console.error("Backend error", e); }
        */

        // محاكاة الحفظ المحلي كـ fallback
        this.localScores.push(newScore);
        this.localScores.sort((a, b) => b.score - a.score);
        this.localScores = this.localScores.slice(0, 10); // Top 10
        localStorage.setItem('globalLeaderboard', JSON.stringify(this.localScores));
    }

    getTopScores() {
        return this.localScores;
    }
}

class Game {
    constructor() {
        this.player = new Player(this);
        this.physics = { gravity: 0.6, jumpForce: -13 };
        this.obstacles = [];
        this.powerUps = [];
        this.obstacleSpeed = 5;
        this.powerUpInterval = 5000;
        this.lastPowerUpTime = Date.now();
        this.gameOver = false;
        this.score = 0;
        this.highScore = localStorage.getItem("highScore") || 0;
        this.scoreMultiplier = 1;
        this.groundLevel = canvas.height - 30;
        this.lastUpdateTime = 0;
        this.parallaxBackground = { x: 0, y: 0, speed: 1 };
        this.shieldActive = false;
        this.timeSlowed = false;
        
        // --- توظيف الأنظمة الجديدة ---
        this.aiDirector = new AIDirector(this);
        this.leaderboard = new LeaderboardManager();
        
        // --- 2. Procedural Generation Weights ---
        this.obstaclePatterns = [
            { type: 'low', weight: 50 },
            { type: 'high', weight: 30 },
            { type: 'wide', weight: 20 }
        ];
        this.nextObstacleDistance = 300;
    }

    // دالة اختيار نمط عقبة بناءً على أوزان احتمالية (Weighted Random)
    getWeightedObstacleType() {
        let totalWeight = this.obstaclePatterns.reduce((sum, p) => sum + p.weight, 0);
        // الذكاء التكيّفي يغير الأوزان بناءً على threatLevel
        if (this.aiDirector.threatLevel > 2) {
            totalWeight += 20; // زيادة وزن العقبات الطائرة
        }
        
        let random = Math.random() * totalWeight;
        for (let pattern of this.obstaclePatterns) {
            random -= pattern.weight;
            if (random <= 0) return pattern.type;
        }
        return 'low';
    }

    drawParallaxBackground() {
        ctx.fillStyle = "#6b5e54";
        ctx.fillRect(0, this.groundLevel, canvas.width, canvas.height - this.groundLevel);
        ctx.fillStyle = "#87ceeb";
        ctx.fillRect(0, 0, canvas.width, this.groundLevel);
        ctx.fillStyle = "#cccccc";
        for (let i = 0; i < 50; i++) {
            const starX = (i * 50 + this.parallaxBackground.x) % canvas.width;
            ctx.beginPath();
            ctx.arc(starX, (i * 20) % this.groundLevel, 1, 0, 2 * Math.PI);
            ctx.fill();
        }
        this.parallaxBackground.x -= this.parallaxBackground.speed;
    }

    drawUI() {
        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.textAlign = "left";
        ctx.fillText(`Score: ${this.score}`, 10, 25);
        ctx.textAlign = "right";
        ctx.fillText(`High Score: ${this.highScore}`, canvas.width - 10, 25);
        
        // عرض مستوى التهديد (للمطور/المقابلة)
        ctx.textAlign = "left";
        ctx.fillStyle = `rgb(255, ${255 - this.aiDirector.threatLevel * 40}, 0)`;
        ctx.font = "14px Arial";
        ctx.fillText(`Threat: ${this.aiDirector.threatLevel.toFixed(1)}`, 10, 45);

        ctx.textAlign = "center";
        ctx.font = "20px Arial";
        if (this.scoreMultiplier > 1) {
            ctx.fillStyle = "#ffd700";
            ctx.fillText(`Multiplier: x${this.scoreMultiplier}`, canvas.width / 2, 25);
        }
        if (this.shieldActive) {
            ctx.fillStyle = "#00bfff";
            ctx.fillText("Shield Active!", canvas.width / 2, 50);
        }
        if (this.timeSlowed) {
            ctx.fillStyle = "#8a2be2";
            ctx.fillText("Time Slowed!", canvas.width / 2, 75);
        }
    }

    generateObstacle() {
        // توليد إجرائي يعتمد على المسافة بدلاً من الوقت فقط
        if (this.nextObstacleDistance <= 0) {
            const type = this.getWeightedObstacleType();
            this.obstacles.push(new Obstacle(this, type));
            
            // حساب المسافة للعقبة القادمة بناءً على السرعة ومستوى التهديد
            const minDist = 200 + (this.aiDirector.threatLevel * 20);
            const maxDist = 400;
            this.nextObstacleDistance = Math.random() * (maxDist - minDist) + minDist;
        }
        this.nextObstacleDistance -= this.obstacleSpeed;
    }

    generatePowerUp() {
        const currentTime = Date.now();
        const interval = this.timeSlowed ? this.powerUpInterval * 2 : this.powerUpInterval;
        if (currentTime - this.lastPowerUpTime > interval) {
            this.powerUps.push(new PowerUp(this));
            this.lastPowerUpTime = currentTime;
        }
    }

    checkCollision() {
        // --- تصادم دقيق (دائرة اللاعب مقابل مستطيل العقبة) ---
        this.obstacles.forEach((obstacle, index) => {
            if (circleRectCollision(this.player, obstacle)) {
                if (this.shieldActive) {
                    this.shieldActive = false;
                    this.obstacles.splice(index, 1);
                    // تأثير فيزيائي: ارتداد عند كسر الدرع
                    this.player.vy = -8; 
                } else {
                    this.endGame();
                }
            }
        });

        this.powerUps.forEach((powerUp, index) => {
            if (circleRectCollision(this.player, powerUp)) {
                this.powerUps.splice(index, 1);
                this.activatePowerUp(powerUp);
            }
        });
    }

    activatePowerUp(powerUp) {
        switch (powerUp.type) {
            case "scoreMultiplier":
                this.scoreMultiplier = 2;
                setTimeout(() => { this.scoreMultiplier = 1; }, powerUp.duration);
                break;
            case "shield":
                this.shieldActive = true;
                setTimeout(() => { this.shieldActive = false; }, powerUp.duration);
                break;
            case "highJump":
                this.player.mass = 0.6; // تقليل الكتلة لقفز أعلى
                setTimeout(() => { this.player.mass = 1.2; }, powerUp.duration);
                break;
            case "slowTime":
                this.timeSlowed = true;
                setTimeout(() => { this.timeSlowed = false; }, powerUp.duration);
                break;
        }
    }

    updateDifficulty() {
        const speedMultiplier = this.timeSlowed ? 0.5 : 1;
        this.obstacleSpeed += 0.001 * speedMultiplier;
    }

    endGame() {
        this.gameOver = true;
        this.aiDirector.onPlayerDeath(); // إبلاغ الذكاء التكيّفي بالموت
        this.updateHighScore();
        
        // حفظ في الـ Leaderboard
        this.leaderboard.saveScore("Player1", this.score);

        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "white";
        ctx.font = "40px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 40);
        ctx.font = "24px Arial";
        ctx.fillText(`Your score: ${this.score}`, canvas.width / 2, canvas.height / 2);
        
        // عرض الـ Leaderboard
        ctx.font = "16px Arial";
        ctx.fillStyle = "#ffd700";
        ctx.fillText("Top Scores:", canvas.width / 2, canvas.height / 2 + 40);
        const topScores = this.leaderboard.getTopScores();
        topScores.slice(0, 3).forEach((s, i) => {
            ctx.fillText(`${i + 1}. ${s.name}: ${s.score}`, canvas.width / 2, canvas.height / 2 + 65 + (i * 20));
        });

        ctx.fillStyle = "white";
        ctx.fillText("Press SPACE to restart", canvas.width / 2, canvas.height / 2 + 140);
    }

    updateHighScore() {
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem("highScore", this.highScore);
        }
    }

    restart() {
        this.player = new Player(this);
        this.obstacles = [];
        this.powerUps = [];
        this.obstacleSpeed = 5;
        this.score = 0;
        this.scoreMultiplier = 1;
        this.gameOver = false;
        this.lastPowerUpTime = Date.now();
        this.shieldActive = false;
        this.timeSlowed = false;
        this.nextObstacleDistance = 300;
        this.gameLoop(0);
    }

    gameLoop(timestamp) {
        if (this.gameOver) return;
        
        this.lastUpdateTime = timestamp;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        this.drawParallaxBackground();
        
        this.aiDirector.update(); // تحديث الذكاء التكيّفي
        this.player.update();
        this.obstacles.forEach(o => o.update());
        this.powerUps.forEach(p => p.update());
        
        this.generateObstacle();
        this.generatePowerUp();
        this.checkCollision();
        this.updateDifficulty();
        
        this.score += this.scoreMultiplier;
        
        this.obstacles = this.obstacles.filter(o => o.x + o.width > 0);
        this.powerUps = this.powerUps.filter(p => p.x + p.width > 0);
        
        this.player.draw();
        this.obstacles.forEach(o => o.draw());
        this.powerUps.forEach(p => p.draw());
        this.drawUI();
        
        requestAnimationFrame(this.gameLoop.bind(this));
    }
}

// --- Event Listeners ---
document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
        if (myGame.gameOver) {
            myGame.restart();
        } else {
            myGame.player.jump();
            myGame.player.bufferJump(); // تفعيل الـ Buffering
        }
    }
});

// --- Start the game ---
const myGame = new Game();
myGame.gameLoop(0);