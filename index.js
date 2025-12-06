function init() {
  const scoreEl = document.querySelector("#scoreEl");
  const livesEl = document.querySelector("#livesEl");
  const shieldEl = document.querySelector("#shieldEl");
  const canvas = document.getElementById("gameCanvas");
  const c = canvas.getContext("2d");

  canvas.width = 1024;
  canvas.height = 576;

  canvas.tabIndex = 0;
  canvas.style.outline = "none";
  canvas.addEventListener("click", () => canvas.focus());
  canvas.focus();

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  let score = 0;
  let lives = 3;
  let frames = 0;
  let randomInterval = Math.floor(Math.random() * 500 + 500);

  let game = {
    over: false,
    active: false,
  };

  const projectiles = [];
  const grids = [];
  const invaderProjectiles = [];
  const particles = [];
  const powerUps = [];

  let rapidFire = false;
  let shield = false;
  let boss = null;
  let gridsDestroyed = 0;

  let screenShake = { x: 0, y: 0, duration: 0 };

  const keys = {
    a: { pressed: false },
    d: { pressed: false },
    space: { pressed: false },
  };

  function updateHUD() {
    if (scoreEl) scoreEl.innerText = score;
    if (livesEl) livesEl.innerText = lives;
    if (shieldEl) shieldEl.innerText = shield ? "ON" : "OFF";
  }

  class Player {
    constructor() {
      this.velocity = { x: 0, y: 0 };
      this.rotation = 0;
      this.opacity = 1;
      this.ready = false;

      this.width = 60;
      this.height = 60;

      this.position = {
        x: canvas.width / 2 - this.width / 2,
        y: canvas.height - this.height - 20,
      };

      this.image = new Image();
      this.image.src = "images/spaceship.png";
      this.image.onload = () => {
        const scale = 0.15;
        this.width = this.image.width * scale;
        this.height = this.image.height * scale;
        this.position.x = canvas.width / 2 - this.width / 2;
        this.position.y = canvas.height - this.height - 20;
        this.ready = true;
      };
    }

    draw() {
      if (!this.ready) return;
      c.save();
      c.globalAlpha = this.opacity;

      c.translate(
        this.position.x + this.width / 2,
        this.position.y + this.height / 2
      );
      c.rotate(this.rotation);
      c.translate(
        -this.position.x - this.width / 2,
        -this.position.y - this.height / 2
      );

      c.drawImage(
        this.image,
        this.position.x,
        this.position.y,
        this.width,
        this.height
      );
      c.restore();
    }

    update() {
      if (!this.ready) return;
      this.draw();
      this.position.x += this.velocity.x;

      if (this.position.x < 0) this.position.x = 0;
      if (this.position.x + this.width > canvas.width)
        this.position.x = canvas.width - this.width;
    }
  }

  class Projectile {
    constructor({ position, velocity }) {
      this.position = position;
      this.velocity = velocity;
      this.radius = 4;
    }
    draw() {
      c.beginPath();
      c.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
      c.fillStyle = "red";
      c.fill();
    }
    update() {
      this.draw();
      this.position.x += this.velocity.x;
      this.position.y += this.velocity.y;
    }
  }

  class Particle {
    constructor({ position, velocity, radius, color, fades }) {
      this.position = position;
      this.velocity = velocity;
      this.radius = radius;
      this.color = color;
      this.opacity = 1;
      this.fades = fades;
    }
    draw() {
      c.save();
      c.globalAlpha = this.opacity;
      c.beginPath();
      c.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
      c.fillStyle = this.color;
      c.fill();
      c.restore();
    }
    update() {
      this.draw();
      this.position.x += this.velocity.x;
      this.position.y += this.velocity.y;
      if (this.fades) this.opacity -= 0.02;
    }
  }

  class InvaderProjectile {
    constructor({ position, velocity }) {
      this.position = position;
      this.velocity = velocity;
      this.width = 3;
      this.height = 10;
    }
    draw() {
      c.fillStyle = "white";
      c.fillRect(this.position.x, this.position.y, this.width, this.height);
    }
    update() {
      this.draw();
      this.position.x += this.velocity.x;
      this.position.y += this.velocity.y;
    }
  }

  class Invader {
    constructor({ position, type = "normal" }) {
      this.velocity = { x: 0, y: 0 };
      this.type = type;
      this.ready = false;

      this.image = new Image();
      this.image.src = "images/invader.png";

      this.scale = type === "fast" ? 0.75 : 1;

      this.width = 30;
      this.height = 30;
      this.position = position;

      this.image.onload = () => {
        this.width = this.image.width * 0.6 * this.scale;
        this.height = this.image.height * 0.6 * this.scale;
        this.ready = true;
      };
    }

    draw() {
      if (this.ready) {
        c.drawImage(
          this.image,
          this.position.x,
          this.position.y,
          this.width,
          this.height
        );
      } else {
        c.fillStyle = "lime";
        c.fillRect(this.position.x, this.position.y, 30, 24);
      }
    }

    update({ velocity }) {
      this.draw();
      this.position.x += velocity.x;
      this.position.y += velocity.y;
    }

    shoot(invaderProjectiles) {
      invaderProjectiles.push(
        new InvaderProjectile({
          position: {
            x: this.position.x + this.width / 2,
            y: this.position.y + this.height,
          },
          velocity: { x: 0, y: 4 + (this.type === "fast" ? 2 : 0) },
        })
      );
    }
  }

  class Grid {
    constructor() {
      this.position = { x: 0, y: 0 };
      this.velocity = { x: 3, y: 0 };
      this.invaders = [];

      const cols = Math.floor(Math.random() * 8 + 5);
      const rows = Math.floor(Math.random() * 3 + 2);

      this.width = cols * 40;

      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          this.invaders.push(
            new Invader({
              position: { x: x * 40, y: y * 40 },
              type: Math.random() < 0.12 ? "fast" : "normal",
            })
          );
        }
      }
    }

    update() {
      this.position.x += this.velocity.x;
      this.position.y += this.velocity.y;
      this.velocity.y = 0;

      if (
        this.position.x + this.width >= canvas.width ||
        this.position.x <= 0
      ) {
        this.velocity.x = -this.velocity.x;
        this.velocity.y = 30;
      }
    }
  }

  class Boss {
    constructor() {
      this.ready = false;
      this.image = new Image();
      this.image.src = "images/justin.jpg";

      this.width = 500;
      this.height = 220;
      this.position = { x: canvas.width / 2 - this.width / 2, y: 20 };
      this.health = 60;
      this.frame = 0;

      this.image.onload = () => {
        const scale = Math.min(1.0, (canvas.width * 0.6) / this.image.width);
        this.width = this.image.width * scale;
        this.height = this.image.height * scale;
        this.position = { x: canvas.width / 2 - this.width / 2, y: 20 };
        this.ready = true;
      };
    }

    draw() {
      if (!this.ready) {
        c.fillStyle = "purple";
        c.fillRect(this.position.x, this.position.y, this.width, this.height);
        return;
      }
      c.drawImage(
        this.image,
        this.position.x,
        this.position.y,
        this.width,
        this.height
      );
    }

    update() {
      this.frame++;
      this.position.x =
        canvas.width / 2 - this.width / 2 + Math.sin(this.frame / 50) * 150;
      this.draw();
    }

    shoot(invaderProjectiles) {
      invaderProjectiles.push(
        new InvaderProjectile({
          position: {
            x: this.position.x + this.width / 2,
            y: this.position.y + this.height,
          },
          velocity: { x: 0, y: 7 },
        })
      );
    }
  }

  class PowerUp {
    constructor({ position, type }) {
      this.position = position;
      this.type = type;
      this.width = 20;
      this.height = 20;
      this.velocity = { x: 0, y: 2 };
    }
    draw() {
      c.fillStyle = this.type === "rapid" ? "yellow" : "cyan";
      c.fillRect(this.position.x, this.position.y, this.width, this.height);
      c.fillStyle = "black";
      c.fillText(
        this.type === "rapid" ? "R" : "S",
        this.position.x + 6,
        this.position.y + 14
      );
    }
    update() {
      this.draw();
      this.position.y += this.velocity.y;
    }
  }

  const player = new Player();
  setInterval(() => {
    if (game.active && !game.over && player.ready) {
      shootProjectile();
    }
  }, 200);

  for (let i = 0; i < 100; i++) {
    particles.push(
      new Particle({
        position: {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
        },
        velocity: { x: 0, y: 0.3 },
        radius: Math.random() * 2,
        color: "white",
      })
    );
  }

  function createParticles({
    object,
    color = "#BAA0DE",
    fades = false,
    count = 15,
  }) {
    for (let i = 0; i < count; i++) {
      particles.push(
        new Particle({
          position: {
            x: (object.position?.x || 0) + (object.width || 0) / 2,
            y: (object.position?.y || 0) + (object.height || 0) / 2,
          },
          velocity: {
            x: (Math.random() - 0.5) * 3,
            y: (Math.random() - 0.5) * 3,
          },
          radius: Math.random() * 3,
          color,
          fades,
        })
      );
    }
  }

  function applyScreenShake() {
    if (screenShake.duration > 0) {
      screenShake.duration--;
      screenShake.x = rand(-6, 6);
      screenShake.y = rand(-6, 6);
    } else {
      screenShake.x = 0;
      screenShake.y = 0;
    }
  }

  function animate() {
    if (!game.active) return;

    requestAnimationFrame(animate);

    applyScreenShake();
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.translate(screenShake.x, screenShake.y);

    c.fillStyle = "black";
    c.fillRect(0, 0, canvas.width, canvas.height);

    player.update();

    particles.forEach((p, i) => {
      p.update();

      if (p.opacity <= 0) particles.splice(i, 1);

      if (p.position.y - p.radius >= canvas.height) {
        p.position.x = Math.random() * canvas.width;
        p.position.y = -p.radius;
      }
    });

    invaderProjectiles.forEach((ip, i) => {
      ip.update();

      if (ip.position.y > canvas.height + 50) {
        invaderProjectiles.splice(i, 1);
        return;
      }

      if (
        !shield &&
        player.ready &&
        ip.position.y + ip.height >= player.position.y &&
        ip.position.x + ip.width >= player.position.x &&
        ip.position.x <= player.position.x + player.width
      ) {
        createParticles({ object: player, color: "white", fades: true });
        screenShake.duration = 10;
        invaderProjectiles.splice(i, 1);

        lives--;
        updateHUD();

        if (lives <= 0) {
          player.opacity = 0;
          game.over = true;

          setTimeout(() => {
            game.active = false;
            showGameOverScreen();
          }, 800);
        } else {
          player.position.x = canvas.width / 2 - player.width / 2;
        }
      }
    });

    projectiles.forEach((proj, i) => {
      proj.update();
      if (proj.position.y + proj.radius <= -10) projectiles.splice(i, 1);
    });

    grids.forEach((grid, gridIndex) => {
      grid.update();

      if (frames % 100 === 0 && grid.invaders.length > 0)
        grid.invaders[Math.floor(Math.random() * grid.invaders.length)].shoot(
          invaderProjectiles
        );

      grid.invaders.forEach((inv, i) => {
        inv.update({ velocity: grid.velocity });

        projectiles.forEach((proj, j) => {
          if (
            proj.position.x + proj.radius >= inv.position.x &&
            proj.position.x - proj.radius <= inv.position.x + inv.width &&
            proj.position.y - proj.radius <= inv.position.y + inv.height &&
            proj.position.y + proj.radius >= inv.position.y
          ) {
            score += inv.type === "fast" ? 200 : 100;
            updateHUD();

            createParticles({ object: inv, fades: true });

            if (Math.random() < 0.15) {
              powerUps.push(
                new PowerUp({
                  position: { x: inv.position.x, y: inv.position.y },
                  type: Math.random() < 0.5 ? "rapid" : "shield",
                })
              );
            }

            grid.invaders.splice(i, 1);
            projectiles.splice(j, 1);

            if (grid.invaders.length > 0) {
              const first = grid.invaders[0];
              const last = grid.invaders[grid.invaders.length - 1];
              grid.width = last.position.x - first.position.x + last.width;
              grid.position.x = first.position.x;
            } else {
              grids.splice(gridIndex, 1);
              gridsDestroyed++;

              if (gridsDestroyed % 3 === 0) boss = new Boss();
            }
          }
        });
      });
    });

    powerUps.forEach((p, idx) => {
      p.update();

      if (p.position.y > canvas.height) {
        powerUps.splice(idx, 1);
        return;
      }

      if (
        player.ready &&
        p.position.y + p.height >= player.position.y &&
        p.position.x + p.width >= player.position.x &&
        p.position.x <= player.position.x + player.width
      ) {
        if (p.type === "rapid") rapidFire = true;
        if (p.type === "shield") shield = true;
        updateHUD();

        createParticles({
          object: player,
          color: p.type === "rapid" ? "yellow" : "cyan",
          fades: true,
          count: 8,
        });

        powerUps.splice(idx, 1);

        setTimeout(() => {
          if (p.type === "rapid") rapidFire = false;
          if (p.type === "shield") shield = false;
          updateHUD();
        }, 6000);
      }
    });

    if (boss) {
      boss.update();

      if (frames % 50 === 0) boss.shoot(invaderProjectiles);

      projectiles.forEach((p, i) => {
        if (
          p.position.x >= boss.position.x &&
          p.position.x <= boss.position.x + boss.width &&
          p.position.y >= boss.position.y &&
          p.position.y <= boss.position.y + boss.height
        ) {
          boss.health--;
          createParticles({ object: boss, fades: true });
          projectiles.splice(i, 1);
          screenShake.duration = 6;

          if (boss.health <= 0) {
            createParticles({ object: boss, fades: true, count: 40 });
            score += 2000;
            updateHUD();
            boss = null;
          }
        }
      });
    }

    if (player.position) {
      if (keys.a.pressed && player.position.x >= 0) {
        player.velocity.x = -7;
        player.rotation = -0.15;
      } else if (
        keys.d.pressed &&
        player.position.x + player.width <= canvas.width
      ) {
        player.velocity.x = 7;
        player.rotation = 0.15;
      } else {
        player.velocity.x = 0;
        player.rotation = 0;
      }
    }

    if (frames % randomInterval === 0) {
      grids.push(new Grid());
      randomInterval = Math.floor(Math.random() * 500 + 500);
    }

    frames++;
    c.restore();
  }

  function shootProjectile() {
    if (!player.ready) return;

    if (rapidFire) {
      projectiles.push(
        new Projectile({
          position: {
            x: player.position.x + player.width / 2 - 8,
            y: player.position.y,
          },
          velocity: { x: 0, y: -10 },
        })
      );

      projectiles.push(
        new Projectile({
          position: {
            x: player.position.x + player.width / 2 + 8,
            y: player.position.y,
          },
          velocity: { x: 0, y: -10 },
        })
      );
    } else {
      projectiles.push(
        new Projectile({
          position: {
            x: player.position.x + player.width / 2,
            y: player.position.y,
          },
          velocity: { x: 0, y: -10 },
        })
      );
    }
  }

  addEventListener("keydown", ({ key }) => {
    if (game.over) return;

    switch (key) {
      case "a":
        keys.a.pressed = true;
        break;
      case "d":
        keys.d.pressed = true;
        break;
      case " ":
        if (!keys.space.pressed) shootProjectile();
        keys.space.pressed = true;
        break;
    }
  });

  addEventListener("keyup", ({ key }) => {
    switch (key) {
      case "a":
        keys.a.pressed = false;
        break;
      case "d":
        keys.d.pressed = false;
        break;
      case " ":
        keys.space.pressed = false;
        break;
    }
  });

  function showGameOverScreen() {
    if (document.getElementById("gameOverOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "gameOverOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = 0;
    overlay.style.left = 0;
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.background = "rgba(0,0,0,0.85)";
    overlay.style.color = "white";
    overlay.style.fontFamily = "sans-serif";
    overlay.style.zIndex = 9999;

    const title = document.createElement("div");
    title.style.fontSize = "48px";
    title.style.marginBottom = "20px";
    title.innerText = "GAME OVER";

    const info = document.createElement("div");
    info.style.marginBottom = "20px";
    info.innerText = `Score: ${score}`;

    const btn = document.createElement("button");
    btn.innerText = "Restart";
    btn.style.fontSize = "20px";
    btn.style.padding = "12px 24px";
    btn.style.borderRadius = "8px";

    btn.onclick = () => {
      document.body.removeChild(overlay);
      resetGame();
    };

    overlay.appendChild(title);
    overlay.appendChild(info);
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
  }

  function resetGame() {
    score = 0;
    lives = 3;
    frames = 0;
    gridsDestroyed = 0;
    boss = null;

    projectiles.length = 0;
    invaderProjectiles.length = 0;
    powerUps.length = 0;
    particles.length = 0;
    grids.length = 0;

    randomInterval = Math.floor(Math.random() * 500 + 500);

    game.active = true;
    game.over = false;

    player.opacity = 1;
    player.position = {
      x: canvas.width / 2 - player.width / 2,
      y: canvas.height - player.height - 20,
    };

    updateHUD();
    animate();
  }

  const mainMenu = document.getElementById("mainMenu");
  const startBtn = document.getElementById("startButton");

  startBtn.addEventListener("click", () => {
    mainMenu.style.display = "none";
    game.active = true;
    game.over = false;
    updateHUD();
    animate();
  });

  updateHUD();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
