const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

class Country {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.cost = this.evaluate();
  }

  evaluate() {
    return (this.x * 2 + this.y * 2);
  }
}

class Empire {
  constructor(imperialist) {
    this.imperialist = imperialist;
    this.colonies = [];
  }

  assimilate() {
    this.colonies = this.colonies.map(colony => {
      let dx = this.imperialist.x - colony.x;
      let dy = this.imperialist.y - colony.y;
      colony.x += dx * 0.1 * Math.random();
      colony.y += dy * 0.1 * Math.random();
      colony.cost = colony.evaluate();
      return colony;
    });
  }
}

let countries = [], empires = [], iter = 0, maxIter = 100;

function startICA() {
  const numCountries = +document.getElementById('numCountries').value;
  const numEmpires = +document.getElementById('numEmpires').value;
  maxIter = +document.getElementById('iterations').value;

  countries = [];
  empires = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < numCountries; i++) {
    countries.push(new Country(Math.random() * 800 - 400, Math.random() * 600 - 300));
  }

  countries.sort((a, b) => a.cost - b.cost);

  for (let i = 0; i < numEmpires; i++) {
    empires.push(new Empire(countries[i]));
  }

  let colonies = countries.slice(numEmpires);
  colonies.forEach((colony, i) => {
    empires[i % numEmpires].colonies.push(colony);
  });

  iter = 0;
  requestAnimationFrame(runICA);
}

function runICA() {
  if (iter >= maxIter) return;
  empires.forEach(empire => empire.assimilate());

  empires.sort((a, b) => a.imperialist.cost - b.imperialist.cost);

  let weakest = empires[empires.length - 1];
  let strongest = empires[0];

  if (weakest.colonies.length > 0) {
    let lostColony = weakest.colonies.pop();
    strongest.colonies.push(lostColony);
  } else {
    empires.pop();
  }

  drawAll();
  iter++;
  requestAnimationFrame(runICA);
}

function drawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  empires.forEach((empire, i) => {
    ctx.fillStyle = `hsl(${i * 60}, 70%, 50%)`;
    ctx.beginPath();
    ctx.arc(empire.imperialist.x + 400, empire.imperialist.y + 300, 12, 0, 2 * Math.PI);
    ctx.fill();

    empire.colonies.forEach(colony => {
      ctx.beginPath();
      ctx.arc(colony.x + 400, colony.y + 300, 7, 0, 2 * Math.PI);
      ctx.fill();
    });
  });
}