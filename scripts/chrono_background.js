// Chrono Trigger Mouse Trail
// Replaces the blue squares with "Time Gate" particles (Cyan/White)

let particles = [];

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '9999'); // Top layer for cursor trail
  canvas.style('pointer-events', 'none'); // Allow clicks to pass through
  canvas.style('position', 'fixed');
  noStroke();
}

function draw() {
  clear();

  // Add new particles at mouse position
  if (movedX != 0 || movedY != 0) {
      for (let i = 0; i < 2; i++) {
        particles.push(new Particle(mouseX, mouseY));
      }
  }

  // Update and display particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].display();
    if (particles[i].finished()) {
      particles.splice(i, 1);
    }
  }
}

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = random(-1, 1);
    this.vy = random(-1, 1);
    this.alpha = 255;
    // Chrono Colors: Cyan (Epoch) or White (Magic)
    this.color = random() > 0.5 ? color(77, 238, 234) : color(255, 255, 255); 
    this.size = random(4, 8); // Pixel size
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 5;
  }

  finished() {
    return this.alpha < 0;
  }

  display() {
    fill(this.color.levels[0], this.color.levels[1], this.color.levels[2], this.alpha);
    rect(this.x, this.y, this.size, this.size); // Draw as square pixels
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
