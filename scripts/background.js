// Interactive background using p5.js
// Replicates the "blue squares" effect from osint.industries

let canvas;
const gridSize = 40; // Size of each square
let cols, rows;

function setup() {
  // Create canvas that fills the window
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1'); // Behind everything
  canvas.style('position', 'fixed'); // Fixed position
  
  // Calculate columns and rows
  cols = ceil(width / gridSize);
  rows = ceil(height / gridSize);
  
  noStroke();
}

function draw() {
  clear(); // Clear background to transparent

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      let x = i * gridSize;
      let y = j * gridSize;
      
      // Calculate distance to mouse
      let d = dist(mouseX, mouseY, x + gridSize/2, y + gridSize/2);
      
      // Interaction threshold
      let threshold = 200;
      
      if (d < threshold) {
        // Calculate intensity based on distance (closer = stronger)
        let intensity = map(d, 0, threshold, 1, 0);
        
        // Color configuration (Blue-ish squares similar to OSINT example)
        // Adjust alpha based on intensity
        fill(59, 130, 246, intensity * 150); // R, G, B, Alpha
        
        rect(x, y, gridSize, gridSize);
      }
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cols = ceil(width / gridSize);
  rows = ceil(height / gridSize);
}
