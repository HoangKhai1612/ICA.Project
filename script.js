// Get canvas elements and their contexts
const icaCanvas = document.getElementById('icaCanvas');
const icaCtx = icaCanvas.getContext('2d');
const convergencePlotCanvas = document.getElementById('convergencePlotCanvas');
const plotCtx = convergencePlotCanvas.getContext('2d');
const messageBox = document.getElementById('messageBox');
const currentPhaseSpan = document.getElementById('currentPhase');

// Global variables for the simulation state
let countries = []; // Array to hold all country objects (imperialists + colonies)
let imperialists = []; // Array to hold Imperialist objects
let globalBestCountry = null; // Stores the best country found across all iterations
let currentIteration = 0; // Current iteration count
let maxIterations = 200; // Maximum number of iterations for the simulation
let animationFrameId = null; // To store the ID of the animation frame for cancellation
let bestCostsHistory = []; // To store best cost at each iteration for the plot

// Objective function selection
let selectedObjectiveFunction = 'sphere'; // Default

// Parameters for ICA algorithm
let numCountries = 100;
let numImperialists = 10;
let assimilationCoefficient = 1.5; // Beta in ICA
let revolutionRate = 0.05; // Probability of revolution
let revolutionMagnitude = 0.1; // Magnitude of revolution
const maxVelocity = 10; // Max velocity for countries

// Define objective functions
const objectiveFunctions = {
    sphere: {
        func: (x, y) => x * x + y * y,
        minima: { x: 0, y: 0, z: 0 },
        range: { x: [-400, 400], y: [-300, 300] }
    },
    rastrigin: {
        func: (x, y) => {
            const A = 10;
            return A * 2 + (x * x - A * Math.cos(2 * Math.PI * x)) + (y * y - A * Math.cos(2 * Math.PI * y));
        },
        minima: { x: 0, y: 0, z: 0 },
        range: { x: [-200, 200], y: [-150, 150] } // Adjusted range for visualization
    },
    rosenbrock: {
        func: (x, y) => 100 * Math.pow((y - x * x), 2) + Math.pow((1 - x), 2),
        minima: { x: 1, y: 1, z: 0 },
        range: { x: [-200, 200], y: [-150, 150] } // Adjusted range for visualization
    }
};

// Set canvas dimensions dynamically for responsiveness
function resizeCanvases() {
    // ICA Canvas
    icaCanvas.width = Math.min(window.innerWidth * 0.8, 800);
    icaCanvas.height = Math.min(window.innerHeight * 0.7, 600);
    // Convergence Plot Canvas
    convergencePlotCanvas.width = Math.min(window.innerWidth * 0.8, 800);
    convergencePlotCanvas.height = Math.min(window.innerHeight * 0.3, 300);

    if (countries.length > 0) {
        drawCountries();
        drawConvergencePlot();
    }
}

// Call resizeCanvases initially and on window resize
window.addEventListener('resize', resizeCanvases);
resizeCanvases(); // Initial call

/**
 * Class representing a single Country (solution) in the ICA algorithm.
 */
class Country {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.cost = this.evaluate();
        this.velocity_x = Math.random() * 6 - 3; // For assimilation movement
        this.velocity_y = Math.random() * 6 - 3;
    }

    /**
     * Evaluates the objective function for the country's current position.
     * @returns {number} The cost (fitness) value.
     */
    evaluate() {
        return objectiveFunctions[selectedObjectiveFunction].func(this.x, this.y);
    }

    /**
     * Moves the country based on its current velocity.
     * Enforces boundary conditions.
     */
    move() {
        this.x += this.velocity_x;
        this.y += this.velocity_y;

        const currentRange = objectiveFunctions[selectedObjectiveFunction].range;
        const xMin = currentRange.x[0];
        const xMax = currentRange.x[1];
        const yMin = currentRange.y[0];
        const yMax = currentRange.y[1];

        if (this.x < xMin) {
            this.x = xMin;
            this.velocity_x *= -0.8; // Reflect with some damping
        } else if (this.x > xMax) {
            this.x = xMax;
            this.velocity_x *= -0.8;
        }

        if (this.y < yMin) {
            this.y = yMin;
            this.velocity_y *= -0.8;
        } else if (this.y > yMax) {
            this.y = yMax;
            this.velocity_y *= -0.8;
        }

        this.cost = this.evaluate();
    }
}

/**
 * Class representing an Imperialist country.
 */
class Imperialist extends Country {
    constructor(country) {
        super(country.x, country.y); // Inherit position and cost from a Country
        this.colonies = []; // Array to hold Colony objects (Country instances)
        this.totalPower = this.cost; // Initial power is its own cost
    }

    /**
     * Adds a colony to this imperialist.
     * @param {Country} colony - The colony to add.
     */
    addColony(colony) {
        this.colonies.push(colony);
        this.updateTotalPower();
    }

    /**
     * Removes a colony from this imperialist.
     * @param {Country} colony - The colony to remove.
     */
    removeColony(colony) {
        this.colonies = this.colonies.filter(c => c !== colony);
        this.updateTotalPower();
    }

    /**
     * Updates the total power of the imperialist based on its own cost and its colonies' costs.
     * Lower cost means higher power.
     */
    updateTotalPower() {
        // A common way to calculate total power: Imperialist's cost + mean cost of colonies
        // Or simply sum of costs, and then invert for power (lower cost = higher power)
        // Here, we use the inverse of cost for power, so lower cost -> higher power
        let colonyCostsSum = this.colonies.reduce((sum, c) => sum + c.cost, 0);
        let meanColonyCost = this.colonies.length > 0 ? colonyCostsSum / this.colonies.length : 0;
        
        // Total power is often defined as Imperialist's cost + a fraction of colonies' mean cost
        // We'll use a simple sum of inverse costs for power (lower cost = higher power)
        // Or, more simply, just the imperialist's own cost for ranking, as in some ICA variants.
        // For simplicity in this visualization, let's just use the imperialist's cost for ranking.
        // The competition phase will implicitly handle this.
        // For power calculation, we'll use a normalized cost (lower is better)
        this.totalPower = this.cost; // The imperialist's own cost determines its strength
    }
}

/**
 * Initializes and starts the ICA simulation.
 */
function startICA() {
    // Get parameters from UI inputs
    selectedObjectiveFunction = document.getElementById('objectiveFunction').value;
    numCountries = parseInt(document.getElementById('numCountries').value);
    numImperialists = parseInt(document.getElementById('numImperialists').value);
    maxIterations = parseInt(document.getElementById('iterations').value);
    assimilationCoefficient = parseFloat(document.getElementById('assimilationCoefficient').value);
    revolutionRate = parseFloat(document.getElementById('revolutionRate').value);
    revolutionMagnitude = parseFloat(document.getElementById('revolutionMagnitude').value);

    // Validate inputs
    if (isNaN(numCountries) || numCountries < 20 || numCountries > 500) {
        showMessage('Vui lòng nhập tổng số quốc gia hợp lệ (20-500).', 'bg-red-100 text-red-800');
        return;
    }
    if (isNaN(numImperialists) || numImperialists < 2 || numImperialists >= numCountries) {
        showMessage('Vui lòng nhập số lượng đế quốc hợp lệ (2 đến < tổng số quốc gia).', 'bg-red-100 text-red-800');
        return;
    }
    if (isNaN(maxIterations) || maxIterations < 50 || maxIterations > 1000) {
        showMessage('Vui lòng nhập số vòng lặp hợp lệ (50-1000).', 'bg-red-100 text-red-800');
        return;
    }
    if (isNaN(assimilationCoefficient) || assimilationCoefficient < 0.5 || assimilationCoefficient > 3.0) {
        showMessage('Hệ số Đồng hóa (Beta) phải nằm trong khoảng 0.5-3.0.', 'bg-red-100 text-red-800');
        return;
    }
    if (isNaN(revolutionRate) || revolutionRate < 0.0 || revolutionRate > 0.2) {
        showMessage('Tỷ lệ Cách mạng phải nằm trong khoảng 0.0-0.2.', 'bg-red-100 text-red-800');
        return;
    }
    if (isNaN(revolutionMagnitude) || revolutionMagnitude < 0.01 || revolutionMagnitude > 0.5) {
        showMessage('Độ lớn Cách mạng phải nằm trong khoảng 0.01-0.5.', 'bg-red-100 text-red-800');
        return;
    }

    // Clear any previous animation frame to prevent multiple loops running
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // Reset simulation state
    countries = [];
    imperialists = [];
    globalBestCountry = null;
    currentIteration = 0;
    bestCostsHistory = [];
    icaCtx.clearRect(0, 0, icaCanvas.width, icaCanvas.height);
    plotCtx.clearRect(0, 0, convergencePlotCanvas.width, convergencePlotCanvas.height);

    // 1. Initialization
    currentPhaseSpan.textContent = "Khởi tạo";
    const currentRange = objectiveFunctions[selectedObjectiveFunction].range;
    const xMin = currentRange.x[0];
    const xMax = currentRange.x[1];
    const yMin = currentRange.y[0];
    const yMax = currentRange.y[1];

    for (let i = 0; i < numCountries; i++) {
        let x = Math.random() * (xMax - xMin) + xMin;
        let y = Math.random() * (yMax - yMin) + yMin;
        countries.push(new Country(x, y));
    }

    // Sort countries by cost to select imperialists
    countries.sort((a, b) => a.cost - b.cost);

    // Select imperialists and assign colonies
    for (let i = 0; i < numImperialists; i++) {
        imperialists.push(new Imperialist(countries[i]));
    }

    let colonies = countries.slice(numImperialists); // Remaining countries are colonies

    // Assign colonies to imperialists based on power (inverse of cost)
    // Calculate normalized power for each imperialist
    let imperialistCosts = imperialists.map(imp => imp.cost);
    let maxImpCost = Math.max(...imperialistCosts);
    let minImpCost = Math.min(...imperialistCosts);

    let totalNormalizedPower = 0;
    let normalizedPowers = imperialists.map(imp => {
        // Normalize cost to be between 0 and 1 (0 is best, 1 is worst)
        let normalizedCost = (imp.cost - minImpCost) / (maxImpCost - minImpCost + 1e-9); // Add epsilon to avoid division by zero
        // Power is inverse of normalized cost (1 is best, 0 is worst)
        let power = 1 - normalizedCost;
        totalNormalizedPower += power;
        return power;
    });

    // Assign colonies probabilistically
    for (let i = 0; i < colonies.length; i++) {
        let rand = Math.random() * totalNormalizedPower;
        let cumulativePower = 0;
        for (let j = 0; j < imperialists.length; j++) {
            cumulativePower += normalizedPowers[j];
            if (rand <= cumulativePower) {
                imperialists[j].addColony(colonies[i]);
                break;
            }
        }
    }

    globalBestCountry = imperialists[0]; // Assume the first imperialist is initially the best
    imperialists.forEach(imp => {
        if (imp.cost < globalBestCountry.cost) {
            globalBestCountry = imp;
        }
        imp.colonies.forEach(col => {
            if (col.cost < globalBestCountry.cost) {
                globalBestCountry = col;
            }
        });
    });

    bestCostsHistory.push(globalBestCountry.cost); // Record initial best cost
    showMessage('Mô phỏng ICA đã bắt đầu!', 'bg-green-100 text-green-800');

    animationFrameId = requestAnimationFrame(runICA);
}

/**
 * Finds the best country (lowest cost) among all imperialists and colonies.
 * @returns {Country} The country with the lowest cost.
 */
function getBestCountryOverall() {
    let best = imperialists[0]; // Start with the first imperialist
    imperialists.forEach(imp => {
        if (imp.cost < best.cost) {
            best = imp;
        }
        imp.colonies.forEach(col => {
            if (col.cost < best.cost) {
                best = col;
            }
        });
    });
    return best;
}

/**
 * The main simulation loop for the ICA algorithm.
 */
function runICA() {
    if (currentIteration >= maxIterations) {
        showMessage(`Mô phỏng hoàn tất! Chi phí tốt nhất: ${globalBestCountry.cost.toFixed(6)} tại (${globalBestCountry.x.toFixed(2)}, ${globalBestCountry.y.toFixed(2)})`, 'bg-purple-100 text-purple-800');
        return;
    }

    currentPhaseSpan.textContent = "Đồng hóa & Cách mạng";

    // 2. Assimilation: Colonies move towards their Imperialist
    imperialists.forEach(imp => {
        imp.colonies.forEach(col => {
            // Move colony towards imperialist
            col.velocity_x = assimilationCoefficient * Math.random() * (imp.x - col.x);
            col.velocity_y = assimilationCoefficient * Math.random() * (imp.y - col.y);
            col.move();
        });
    });

    // 3. Revolution: Randomly perturb some countries
    imperialists.forEach(imp => {
        // Revolution for imperialists
        if (Math.random() < revolutionRate) {
            const currentRange = objectiveFunctions[selectedObjectiveFunction].range;
            const xRange = currentRange.x[1] - currentRange.x[0];
            const yRange = currentRange.y[1] - currentRange.y[0];
            imp.x += (Math.random() * 2 - 1) * revolutionMagnitude * xRange;
            imp.y += (Math.random() * 2 - 1) * revolutionMagnitude * yRange;
            imp.cost = imp.evaluate();
            imp.move(); // Apply boundary checks
        }
        // Revolution for colonies
        imp.colonies.forEach(col => {
            if (Math.random() < revolutionRate) {
                const currentRange = objectiveFunctions[selectedObjectiveFunction].range;
                const xRange = currentRange.x[1] - currentRange.x[0];
                const yRange = currentRange.y[1] - currentRange.y[0];
                col.x += (Math.random() * 2 - 1) * revolutionMagnitude * xRange;
                col.y += (Math.random() * 2 - 1) * revolutionMagnitude * yRange;
                col.cost = col.evaluate();
                col.move(); // Apply boundary checks
            }
        });
    });

    currentPhaseSpan.textContent = "Trao đổi vị trí & Cạnh tranh";

    // 4. Exchange Position: Colony becomes better than its Imperialist
    imperialists.forEach(imp => {
        imp.colonies.forEach(col => {
            if (col.cost < imp.cost) {
                // Swap positions and costs
                let tempX = imp.x, tempY = imp.y, tempCost = imp.cost;
                imp.x = col.x; imp.y = col.y; imp.cost = col.cost;
                col.x = tempX; col.y = tempY; col.cost = tempCost;

                // Also update the Imperialist's total power
                imp.updateTotalPower();
            }
        });
    });

    // Update global best country after assimilation and revolution
    globalBestCountry = getBestCountryOverall();

    // 5. Imperialistic Competition: Weaker imperialists are eliminated
    // Sort imperialists by their cost (lower cost = stronger)
    imperialists.sort((a, b) => a.cost - b.cost);

    // Calculate total power of all imperialists (inverse of cost for power)
    let totalPower = imperialists.reduce((sum, imp) => sum + (1 / imp.cost), 0); // Sum of 1/cost
    if (totalPower === 0) totalPower = 1e-9; // Avoid division by zero

    let imperialistSelectionProbabilities = imperialists.map(imp => (1 / imp.cost) / totalPower);

    // If there's more than one imperialist, perform competition
    if (imperialists.length > 1) {
        let weakestImperialist = imperialists[imperialists.length - 1]; // The last one after sorting
        let weakestColonyOfWeakestImp = weakestImperialist.colonies.length > 0 ?
            weakestImperialist.colonies.reduce((a, b) => (a.cost > b.cost ? a : b)) : null;

        // If the weakest imperialist has colonies, its weakest colony might be eliminated
        // Or, a random colony from the weakest imperialist is chosen to be given to a stronger one.
        // A common ICA competition rule: strongest imperialist takes a colony from the weakest.
        // Or, the weakest imperialist loses its weakest colony.

        // Let's implement: the weakest imperialist loses its weakest colony,
        // which is then assigned to a stronger imperialist probabilistically.
        if (weakestImperialist.colonies.length > 0) {
            let colonyToRedistribute = weakestImperialist.colonies.pop(); // Remove weakest colony
            weakestImperialist.updateTotalPower();

            // Assign this colony to a new imperialist probabilistically
            let rand = Math.random();
            let cumulativeProb = 0;
            for (let i = 0; i < imperialists.length; i++) {
                cumulativeProb += imperialistSelectionProbabilities[i];
                if (rand <= cumulativeProb || i === imperialists.length - 1) { // Ensure it's assigned
                    imperialists[i].addColony(colonyToRedistribute);
                    break;
                }
            }
        } else {
            // 6. Elimination of Powerless Imperialists
            // If an imperialist has no colonies, it is eliminated.
            // Its position (as a country) might be taken by the strongest imperialist's colony.
            // For simplicity, we just remove it.
            imperialists.pop(); // Remove the powerless imperialist
        }
    }
    
    // If only one imperialist remains, the algorithm converges
    if (imperialists.length === 1 && currentIteration < maxIterations - 1) {
        currentPhaseSpan.textContent = "Hội tụ (Chỉ còn 1 Đế quốc)";
        // All other countries become colonies of this last imperialist
        let remainingCountries = [];
        imperialists[0].colonies.forEach(col => remainingCountries.push(col));
        imperialists[0].colonies = []; // Clear current colonies
        
        countries.forEach(country => {
            if (country !== imperialists[0] && !remainingCountries.includes(country)) {
                remainingCountries.push(country);
            }
        });

        remainingCountries.forEach(col => imperialists[0].addColony(col));
        
        // The last imperialist continues to assimilate its colonies
        imperialists[0].colonies.forEach(col => {
            col.velocity_x = assimilationCoefficient * Math.random() * (imperialists[0].x - col.x);
            col.velocity_y = assimilationCoefficient * Math.random() * (imperialists[0].y - col.y);
            col.move();
        });
    }


    bestCostsHistory.push(globalBestCountry.cost); // Record best cost for plot
    drawCountries();
    drawConvergencePlot();

    currentIteration++;
    animationFrameId = requestAnimationFrame(runICA);
}

/**
 * Draws all countries (imperialists and colonies) on the ICA canvas.
 */
function drawCountries() {
    icaCtx.clearRect(0, 0, icaCanvas.width, icaCanvas.height); // Clear the entire canvas

    const currentMinima = objectiveFunctions[selectedObjectiveFunction].minima;
    const currentRange = objectiveFunctions[selectedObjectiveFunction].range;

    // Map objective function coordinates to canvas coordinates
    const mapXToCanvas = (x) => {
        return (x - currentRange.x[0]) / (currentRange.x[1] - currentRange.x[0]) * icaCanvas.width;
    };
    const mapYToCanvas = (y) => {
        return (y - currentRange.y[0]) / (currentRange.y[1] - currentRange.y[0]) * icaCanvas.height;
    };

    // Draw the global minimum target
    icaCtx.fillStyle = '#FFD700'; // Gold color for the target
    icaCtx.beginPath();
    icaCtx.arc(mapXToCanvas(currentMinima.x), mapYToCanvas(currentMinima.y), 12, 0, Math.PI * 2);
    icaCtx.fill();
    icaCtx.strokeStyle = '#DAA520'; // Darker gold for border
    icaCtx.lineWidth = 2;
    icaCtx.stroke();

    // Draw connection lines from colonies to their imperialists
    imperialists.forEach(imp => {
        const impCanvasX = mapXToCanvas(imp.x);
        const impCanvasY = mapYToCanvas(imp.y);
        imp.colonies.forEach(col => {
            const colCanvasX = mapXToCanvas(col.x);
            const colCanvasY = mapYToCanvas(col.y);
            icaCtx.strokeStyle = 'rgba(128, 0, 128, 0.3)'; // Purple transparent
            icaCtx.lineWidth = 1;
            icaCtx.beginPath();
            icaCtx.moveTo(impCanvasX, impCanvasY);
            icaCtx.lineTo(colCanvasX, colCanvasY);
            icaCtx.stroke();
        });
    });

    // Draw colonies
    imperialists.forEach(imp => {
        imp.colonies.forEach(col => {
            icaCtx.fillStyle = '#8b5cf6'; // Purple-400 for colonies
            icaCtx.beginPath();
            icaCtx.arc(mapXToCanvas(col.x), mapYToCanvas(col.y), 5, 0, Math.PI * 2);
            icaCtx.fill();
            icaCtx.strokeStyle = '#6d28d9'; // Darker purple
            icaCtx.lineWidth = 1.5;
            icaCtx.stroke();
        });
    });

    // Draw imperialists (larger, distinct color)
    imperialists.forEach(imp => {
        icaCtx.fillStyle = '#7c3aed'; // Purple-600 for imperialists
        icaCtx.beginPath();
        icaCtx.arc(mapXToCanvas(imp.x), mapYToCanvas(imp.y), 8, 0, Math.PI * 2);
        icaCtx.fill();
        icaCtx.strokeStyle = '#5b21b6'; // Darker purple
        icaCtx.lineWidth = 2;
        icaCtx.stroke();
    });

    // Highlight the global best country (largest, brightest color)
    if (globalBestCountry) {
        icaCtx.fillStyle = '#facc15'; // Yellow-400 for global best
        icaCtx.beginPath();
        icaCtx.arc(mapXToCanvas(globalBestCountry.x), mapYToCanvas(globalBestCountry.y), 10, 0, Math.PI * 2);
        icaCtx.fill();
        icaCtx.strokeStyle = '#eab308'; // Darker yellow
        icaCtx.lineWidth = 2.5;
        icaCtx.stroke();
    }


    // Display current iteration and best cost
    icaCtx.fillStyle = '#333'; // Dark grey text
    icaCtx.font = '18px Inter, sans-serif';
    icaCtx.fillText(`Vòng lặp: ${currentIteration} / ${maxIterations}`, 10, 25);
    if (globalBestCountry) {
        icaCtx.fillText(`Chi phí tốt nhất: ${globalBestCountry.cost.toFixed(6)}`, 10, 50);
        icaCtx.fillText(`Vị trí tốt nhất: (${globalBestCountry.x.toFixed(2)}, ${globalBestCountry.y.toFixed(2)})`, 10, 75);
    }
}

/**
 * Draws the convergence plot.
 */
function drawConvergencePlot() {
    plotCtx.clearRect(0, 0, convergencePlotCanvas.width, convergencePlotCanvas.height);

    if (bestCostsHistory.length < 2) return;

    // Find min/max cost for scaling
    const maxCost = Math.max(...bestCostsHistory);
    const minCost = Math.min(...bestCostsHistory);

    // Padding for the plot
    const padding = 30;
    const plotWidth = convergencePlotCanvas.width - 2 * padding;
    const plotHeight = convergencePlotCanvas.height - 2 * padding;

    // Draw axes
    plotCtx.strokeStyle = '#ccc';
    plotCtx.lineWidth = 1;
    plotCtx.beginPath();
    plotCtx.moveTo(padding, padding); // Y-axis top
    plotCtx.lineTo(padding, padding + plotHeight); // Y-axis bottom
    plotCtx.lineTo(padding + plotWidth, padding + plotHeight); // X-axis right
    plotCtx.stroke();

    // Draw labels
    plotCtx.fillStyle = '#333';
    plotCtx.font = '12px Inter, sans-serif';
    plotCtx.fillText('Chi phí', padding - 25, padding + plotHeight / 2);
    plotCtx.fillText('Vòng lặp', padding + plotWidth / 2 - 30, padding + plotHeight + 20);

    // Draw cost values on Y-axis
    plotCtx.fillText(minCost.toFixed(2), padding - 30, padding + plotHeight + 5);
    plotCtx.fillText(maxCost.toFixed(2), padding - 30, padding + 5);

    // Draw iteration values on X-axis
    plotCtx.fillText('0', padding - 5, padding + plotHeight + 20);
    plotCtx.fillText(maxIterations.toString(), padding + plotWidth - 10, padding + plotHeight + 20);


    // Draw the convergence line
    plotCtx.strokeStyle = '#7e22ce'; // Purple-700
    plotCtx.lineWidth = 2;
    plotCtx.beginPath();

    bestCostsHistory.forEach((cost, index) => {
        const x = padding + (index / (maxIterations - 1)) * plotWidth;
        // Scale cost to plot height (invert y-axis for drawing)
        const y = padding + plotHeight - ((cost - minCost) / (maxCost - minCost)) * plotHeight;

        if (index === 0) {
            plotCtx.moveTo(x, y);
        } else {
            plotCtx.lineTo(x, y);
        }
    });
    plotCtx.stroke();
}

/**
 * Displays a message in the message box.
 * @param {string} message - The message to display.
 * @param {string} className - Tailwind CSS classes for styling the message box.
 */
function showMessage(message, className) {
    messageBox.textContent = message;
    messageBox.className = `mt-4 p-3 rounded-lg ${className}`; // Apply provided classes
    messageBox.classList.remove('hidden'); // Make it visible
}

// Ensure the animation loop starts only after the window has loaded
window.onload = function() {
    // Initial draw to show an empty canvas or initial state
    drawCountries();
    drawConvergencePlot(); // Draw empty plot initially
    showMessage('Nhập các tham số và nhấp "Bắt đầu Mô phỏng ICA".', 'bg-purple-100 text-purple-800');
};
