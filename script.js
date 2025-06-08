// script.js (Cải tiến và sửa lỗi cho ICA)

// --- Canvas Setup ---
const optimizationCanvas = document.getElementById('optimizationCanvas');
const optCtx = optimizationCanvas.getContext('2d');
const convergencePlotCanvas = document.getElementById('convergencePlotCanvas');
const convCtx = convergencePlotCanvas.getContext('2d');

// --- DOM Elements for Info and Controls ---
const numCountriesInput = document.getElementById('numCountries');
const numImperialistsInput = document.getElementById('numImperialists');
const maxIterationsInput = document.getElementById('maxIterations');
const dimensionsInput = document.getElementById('dimensions');
const searchRangeMinInput = document.getElementById('searchRangeMin');
const searchRangeMaxInput = document.getElementById('searchRangeMax');
const assimilationCoefficientInput = document.getElementById('assimilationCoefficient');
const revolutionRateInput = document.getElementById('revolutionRate');
const revolutionAmountInput = document.getElementById('revolutionAmount'); // New input
const imperialistDecayRateInput = document.getElementById('imperialistDecayRate'); // New input
const unificationThresholdInput = document.getElementById('unificationThreshold'); // New input
const startButton = document.getElementById('startButton');
const resetButton = document.getElementById('resetButton');
const currentIterationSpan = document.getElementById('currentIteration');
const bestCostSpan = document.getElementById('bestCost');
const bestPositionSpan = document.getElementById('bestPosition');
const numActiveImperialistsSpan = document.getElementById('numActiveImperialists');

// --- Global Simulation Variables ---
let imperialists = []; // Array of imperialist objects {leader: Country, colonies: Country[]}
let globalBestCountry = null;
let currentIteration = 0;
let animationFrameId = null; // To control the animation loop
let convergenceHistory = []; // To store best costs over iterations

// --- Simulation Parameters (Default values from your document or typical ICA) ---
let NUM_COUNTRIES = 50;
let NUM_IMPERIALISTS = 5;
let MAX_ITERATIONS = 1000;
let DIMENSIONS = 2; // For visual representation, we'll mostly use 2D
let SEARCH_RANGE_MIN = -5.12;
let SEARCH_RANGE_MAX = 5.12;

// ICA specific parameters
let ASSIMILATION_COEFFICIENT = 1.5; // beta (assimilation factor)
let REVOLUTION_RATE = 0.1; // Probability of a colony undergoing revolution
let REVOLUTION_AMOUNT = 0.1; // Zeta (percentage of search range for revolution)
let IMPERIALIST_DECAY_RATE = 0.02; // Power decay rate for imperialists
let UNIFICATION_THRESHOLD = 0.05; // Threshold for imperialists to unify based on distance

// --- Benchmark Function: Rastrigin ---
const benchmarkFunction = {
    func: (position) => {
        const A = 10;
        return A * position.length + position.reduce((sum, val) => sum + (val * val - A * Math.cos(2 * Math.PI * val)), 0);
    },
    min: 0, // Global minimum for Rastrigin
    minPos: (dim) => Array(dim).fill(0) // Position of global minimum
};

// --- Helper Functions ---

// Maps a value from one range to another for canvas drawing
function mapRange(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

// Generates a random number within a given range
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

// Clamps a value within a min/max range
function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

// Calculates the cost of a position using the selected benchmark function
function calculateCost(position) {
    return benchmarkFunction.func(position);
}

// Calculates Euclidean distance between two positions
function euclideanDistance(pos1, pos2) {
    let sumSq = 0;
    for (let i = 0; i < pos1.length; i++) {
        sumSq += Math.pow(pos1[i] - pos2[i], 2);
    }
    return Math.sqrt(sumSq);
}

// --- ICA Algorithm Logic ---

class Country {
    constructor(dimensions, searchRangeMin, searchRangeMax) {
        this.position = Array(dimensions).fill(0).map(() => getRandomArbitrary(searchRangeMin, searchRangeMax));
        this.cost = calculateCost(this.position);
    }
}

function initializeICA() {
    imperialists = [];
    globalBestCountry = null;
    convergenceHistory = [];

    let allCountries = [];
    for (let i = 0; i < NUM_COUNTRIES; i++) {
        allCountries.push(new Country(DIMENSIONS, SEARCH_RANGE_MIN, SEARCH_RANGE_MAX));
    }

    // Sort all countries by cost (lower cost is better)
    allCountries.sort((a, b) => a.cost - b.cost);

    // Select imperialists from the best countries
    for (let i = 0; i < NUM_IMPERIALISTS; i++) {
        imperialists.push({
            leader: allCountries[i],
            colonies: [],
            normalizedPower: 0 // Will be calculated dynamically
        });
    }

    // Assign remaining countries as colonies
    const coloniesToAssign = allCountries.slice(NUM_IMPERIALISTS);

    // Calculate initial imperialist power for colony assignment
    const imperialistCosts = imperialists.map(imp => imp.leader.cost);
    const maxImpCost = Math.max(...imperialistCosts);
    const minImpCost = Math.min(...imperialistCosts);
    let totalNormalizedPower = 0;

    imperialists.forEach(imp => {
        // Power is inversely proportional to cost (lower cost = higher power)
        // Normalize power: (MaxCost - CurrentCost) / (MaxCost - MinCost)
        // Add a small epsilon to denominator to avoid division by zero if all costs are same
        imp.normalizedPower = (maxImpCost - imp.leader.cost) / (maxImpCost - minImpCost + 1e-9);
        totalNormalizedPower += imp.normalizedPower;
    });

    // Distribute colonies based on normalized power
    let currentColonyIndex = 0;
    if (totalNormalizedPower > 0) { // Avoid division by zero
        imperialists.forEach(imp => {
            const numColonies = Math.round(imp.normalizedPower / totalNormalizedPower * coloniesToAssign.length);
            for (let j = 0; j < numColonies && currentColonyIndex < coloniesToAssign.length; j++) {
                imp.colonies.push(coloniesToAssign[currentColonyIndex]);
                currentColonyIndex++;
            }
        });
    }

    // Assign any remaining colonies due to rounding to the strongest imperialist
    while (currentColonyIndex < coloniesToAssign.length) {
        let strongestImp = imperialists.reduce((prev, current) =>
            (prev.leader.cost < current.leader.cost) ? prev : current
        );
        strongestImp.colonies.push(coloniesToAssign[currentColonyIndex]);
        currentColonyIndex++;
    }

    // Initialize global best
    updateGlobalBest();
}

function updateGlobalBest() {
    let currentGlobalBestCost = Infinity;
    let currentGlobalBestPosition = [];

    imperialists.forEach(imp => {
        if (imp.leader.cost < currentGlobalBestCost) {
            currentGlobalBestCost = imp.leader.cost;
            currentGlobalBestPosition = [...imp.leader.position];
        }
        imp.colonies.forEach(col => {
            if (col.cost < currentGlobalBestCost) {
                currentGlobalBestCost = col.cost;
                currentGlobalBestPosition = [...col.position];
            }
        });
    });

    if (globalBestCountry === null || currentGlobalBestCost < globalBestCountry.cost) {
        globalBestCountry = {
            position: currentGlobalBestPosition,
            cost: currentGlobalBestCost
        };
    }
}

function updateICA() {
    // 1. Assimilation: Colonies move towards their Imperialist
    imperialists.forEach(imp => {
        imp.colonies.forEach(colony => {
            for (let d = 0; d < DIMENSIONS; d++) {
                // Direction vector from colony to imperialist
                const direction = imp.leader.position[d] - colony.position[d];
                // Update position: current + random * beta * direction
                colony.position[d] += getRandomArbitrary(0, 1) * ASSIMILATION_COEFFICIENT * direction;
                colony.position[d] = clamp(colony.position[d], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX);
            }
            colony.cost = calculateCost(colony.position);
        });
    });

    // 2. Revolution: A random colony might undergo revolution
    imperialists.forEach(imp => {
        imp.colonies.forEach(colony => {
            if (Math.random() < REVOLUTION_RATE) {
                // Revolution: random jump within a percentage of the search range
                const rangeWidth = SEARCH_RANGE_MAX - SEARCH_RANGE_MIN;
                for (let d = 0; d < DIMENSIONS; d++) {
                    colony.position[d] += getRandomArbitrary(-REVOLUTION_AMOUNT * rangeWidth, REVOLUTION_AMOUNT * rangeWidth);
                    colony.position[d] = clamp(colony.position[d], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX);
                }
                colony.cost = calculateCost(colony.position);
            }
        });
    });

    // 3. Exchange positions of Imperialist and Colony
    imperialists.forEach(imp => {
        if (imp.colonies.length > 0) { // Ensure there are colonies to compare
            const bestColony = imp.colonies.reduce((best, current) =>
                (current.cost < best.cost) ? current : best
            );

            if (bestColony.cost < imp.leader.cost) {
                // Colony becomes new Imperialist, old Imperialist becomes a colony
                const tempLeader = imp.leader;
                imp.leader = bestColony;
                imp.colonies = imp.colonies.filter(c => c !== bestColony); // Remove new leader from colonies
                imp.colonies.push(tempLeader); // Add old leader as a colony
            }
        }
    });

    // Update global best after potential exchanges
    updateGlobalBest();

    // 4. Imperialistic Competition
    if (imperialists.length > 1) {
        // Calculate total cost for each imperialist (leader cost + mean colony cost)
        // Lower total cost means stronger imperialist
        imperialists.forEach(imp => {
            let totalColonyCost = imp.colonies.reduce((sum, col) => sum + col.cost, 0);
            let meanColonyCost = imp.colonies.length > 0 ? totalColonyCost / imp.colonies.length : 0;
            // The power of an empire is inversely related to its total cost.
            // Decay rate determines how much colony cost contributes to overall empire cost.
            imp.empireCost = imp.leader.cost + (meanColonyCost * IMPERIALIST_DECAY_RATE);
        });

        // Sort imperialists by their empire cost (lower cost is stronger)
        imperialists.sort((a, b) => a.empireCost - b.empireCost);

        const weakestImperialist = imperialists[imperialists.length - 1]; // The last one after sorting (weakest)
        const strongestImperialist = imperialists[0]; // The first one after sorting (strongest)

        // Transfer colonies from the weakest imperialist to others
        if (weakestImperialist.colonies.length > 0) {
            weakestImperialist.colonies.forEach(colony => {
                // Calculate power for distribution amongst *all remaining* imperialists
                const currentImperialistCosts = imperialists.map(imp => imp.leader.cost);
                const currentMaxImpCost = Math.max(...currentImperialistCosts);
                const currentMinImpCost = Math.min(...currentImperialistCosts);
                let currentTotalNormalizedPower = 0;

                imperialists.forEach(imp => {
                    imp.normalizedPower = (currentMaxImpCost - imp.leader.cost) / (currentMaxImpCost - currentMinImpCost + 1e-9);
                    currentTotalNormalizedPower += imp.normalizedPower;
                });

                if (currentTotalNormalizedPower > 0) {
                    let randomVal = getRandomArbitrary(0, currentTotalNormalizedPower);
                    let sumProb = 0;
                    let targetImp = null;

                    for (let i = 0; i < imperialists.length; i++) {
                        sumProb += imperialists[i].normalizedPower;
                        if (randomVal <= sumProb) {
                            targetImp = imperialists[i];
                            break;
                        }
                    }
                    if (targetImp) {
                        targetImp.colonies.push(colony);
                    } else { // Fallback, assign to strongest if random didn't pick for some reason
                        strongestImperialist.colonies.push(colony);
                    }
                } else { // If only one imperialist or all have same power, assign to strongest
                    strongestImperialist.colonies.push(colony);
                }
            });
            weakestImperialist.colonies = []; // Clear colonies of the weakest
        }

        // If weakest imperialist has no colonies and is not the last remaining imperialist, it collapses
        if (weakestImperialist.colonies.length === 0 && imperialists.length > 1) {
            strongestImperialist.colonies.push(weakestImperialist.leader); // Absorbed as a colony
            imperialists = imperialists.filter(imp => imp !== weakestImperialist); // Remove the collapsed imperialist
        }
    }

    // 5. Empire Unification (simplified)
    // If two imperialists are too close, the weaker one collapses into the stronger one.
    if (imperialists.length > 1) {
        for (let i = 0; i < imperialists.length; i++) {
            for (let j = i + 1; j < imperialists.length; j++) {
                const imp1 = imperialists[i];
                const imp2 = imperialists[j];
                const searchRangeLength = SEARCH_RANGE_MAX - SEARCH_RANGE_MIN;
                const distance = euclideanDistance(imp1.leader.position, imp2.leader.position);

                if (distance < UNIFICATION_THRESHOLD * searchRangeLength) {
                    // Decide which one is stronger based on leader cost (lower is stronger)
                    let strongerImp = imp1.leader.cost < imp2.leader.cost ? imp1 : imp2;
                    let weakerImp = strongerImp === imp1 ? imp2 : imp1;

                    // Transfer all colonies (including the weaker leader) to the stronger empire
                    strongerImp.colonies = strongerImp.colonies.concat(weakerImp.colonies);
                    strongerImp.colonies.push(weakerImp.leader);

                    // Remove the weaker empire from the list
                    imperialists = imperialists.filter(imp => imp !== weakerImp);
                    break; // Break inner loop, as the list of imperialists has changed
                }
            }
        }
    }
}


// --- Drawing Functions ---

function resizeCanvases() {
    optimizationCanvas.width = optimizationCanvas.parentElement.clientWidth;
    optimizationCanvas.height = 400; // Keep height fixed
    convergencePlotCanvas.width = convergencePlotCanvas.parentElement.clientWidth;
    convergencePlotCanvas.height = 400; // Keep height fixed
    drawOptimizationSpace(); // Redraw immediately after resize
    drawConvergencePlot();
}

function drawOptimizationSpace() {
    if (DIMENSIONS !== 2) {
        optCtx.clearRect(0, 0, optimizationCanvas.width, optimizationCanvas.height);
        optCtx.fillStyle = '#f0f0f0';
        optCtx.fillRect(0, 0, optimizationCanvas.width, optimizationCanvas.height);
        optCtx.font = '20px Arial';
        optCtx.fillStyle = '#555';
        optCtx.textAlign = 'center';
        optCtx.fillText('Trực quan hóa chỉ khả dụng cho 2D', optimizationCanvas.width / 2, optimizationCanvas.height / 2);
        return;
    }

    optCtx.clearRect(0, 0, optimizationCanvas.width, optimizationCanvas.height);

    // Draw background based on function cost (Rastrigin)
    const gridSize = 50; // Smaller value = more detail, slower rendering
    const cellWidth = optimizationCanvas.width / gridSize;
    const cellHeight = optimizationCanvas.height / gridSize;

    // Determine min/max cost for visualization color mapping
    const vizMaxCost = benchmarkFunction.func(Array(DIMENSIONS).fill(SEARCH_RANGE_MAX)); // Rough estimate for Rastrigin's max in range
    const vizMinCost = benchmarkFunction.min;

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const x = mapRange(i, 0, gridSize, SEARCH_RANGE_MIN, SEARCH_RANGE_MAX);
            const y = mapRange(j, 0, gridSize, SEARCH_RANGE_MIN, SEARCH_RANGE_MAX);
            const cost = calculateCost([x, y]);

            const normalizedCost = clamp(cost, vizMinCost, vizMaxCost) / (vizMaxCost - vizMinCost + 1e-9); // Add epsilon
            const colorVal = Math.floor(normalizedCost * 255);
            // Using a purple scale for ICA
            optCtx.fillStyle = `rgb(${255 - colorVal}, ${200 - colorVal * 0.5}, ${255 - colorVal})`; // Lighter for lower cost
            optCtx.fillRect(i * cellWidth, optimizationCanvas.height - (j * cellHeight) - cellHeight, cellWidth, cellHeight);
        }
    }

    // Draw colonies (chấm tím nhạt)
    imperialists.forEach(imp => {
        imp.colonies.forEach(colony => {
            const drawX = mapRange(colony.position[0], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, 0, optimizationCanvas.width);
            const drawY = mapRange(colony.position[1], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, optimizationCanvas.height, 0);

            optCtx.beginPath();
            optCtx.arc(drawX, drawY, 4, 0, Math.PI * 2);
            optCtx.fillStyle = '#A020F0'; // Light purple
            optCtx.fill();
            optCtx.strokeStyle = '#800080'; // Darker purple
            optCtx.lineWidth = 1;
            optCtx.stroke();
        });
    });

    // Draw imperialists (chấm tím đậm hơn, lớn hơn)
    imperialists.forEach(imp => {
        const drawX = mapRange(imp.leader.position[0], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, 0, optimizationCanvas.width);
        const drawY = mapRange(imp.leader.position[1], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, optimizationCanvas.height, 0);

        optCtx.beginPath();
        optCtx.arc(drawX, drawY, 7, 0, Math.PI * 2);
        optCtx.fillStyle = '#800080'; // Dark purple
        optCtx.fill();
        optCtx.strokeStyle = '#4B0082'; // Indigo
        optCtx.lineWidth = 2;
        optCtx.stroke();
    });

    // Draw global best country (chấm vàng sáng nhất, lớn nhất)
    if (globalBestCountry && globalBestCountry.position.length === 2) {
        const drawX = mapRange(globalBestCountry.position[0], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, 0, optimizationCanvas.width);
        const drawY = mapRange(globalBestCountry.position[1], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, optimizationCanvas.height, 0);

        optCtx.beginPath();
        optCtx.arc(drawX, drawY, 10, 0, Math.PI * 2);
        optCtx.fillStyle = '#FFD700'; // Gold
        optCtx.fill();
        optCtx.strokeStyle = '#DAA520'; // Goldenrod
        optCtx.lineWidth = 3;
        optCtx.stroke();
        optCtx.closePath();

        // Draw a small cross for target
        optCtx.beginPath();
        optCtx.moveTo(drawX - 12, drawY);
        optCtx.lineTo(drawX + 12, drawY);
        optCtx.moveTo(drawX, drawY - 12);
        optCtx.lineTo(drawX, drawY + 12);
        optCtx.strokeStyle = 'black';
        optCtx.lineWidth = 1;
        optCtx.stroke();
    }
}

function drawConvergencePlot() {
    convCtx.clearRect(0, 0, convergencePlotCanvas.width, convergencePlotCanvas.height);

    if (convergenceHistory.length === 0) {
        convCtx.font = '20px Arial';
        convCtx.fillStyle = '#555';
        convCtx.textAlign = 'center';
        convCtx.fillText('Chưa có dữ liệu để vẽ biểu đồ', convergencePlotCanvas.width / 2, convergencePlotCanvas.height / 2);
        return;
    }

    const padding = 40;
    const chartWidth = convergencePlotCanvas.width - 2 * padding;
    const chartHeight = convergencePlotCanvas.height - 2 * padding;

    let maxCost = Math.max(...convergenceHistory);
    let minCost = Math.min(...convergenceHistory);
    const costRange = maxCost - minCost > 1e-9 ? maxCost - minCost : 1; // Prevent division by zero if cost is constant

    // Draw axes
    convCtx.strokeStyle = '#888';
    convCtx.lineWidth = 1;
    convCtx.beginPath();
    convCtx.moveTo(padding, padding);
    convCtx.lineTo(padding, padding + chartHeight);
    convCtx.lineTo(padding + chartWidth, padding + chartHeight);
    convCtx.stroke();

    // Draw axis labels
    convCtx.fillStyle = '#555';
    convCtx.font = '12px Arial';
    convCtx.textAlign = 'center';
    convCtx.fillText('Vòng lặp', padding + chartWidth / 2, convergencePlotCanvas.height - 10);
    convCtx.save();
    convCtx.translate(15, padding + chartHeight / 2);
    convCtx.rotate(-Math.PI / 2);
    convCtx.fillText('Chi phí tốt nhất', 0, 0);
    convCtx.restore();

    // Draw tick marks and values
    // Y-axis (Cost)
    for (let i = 0; i <= 5; i++) {
        const y = padding + chartHeight - (i / 5) * chartHeight;
        const value = minCost + (i / 5) * costRange;
        convCtx.fillText(value.toExponential(2), padding - 10, y + 4); // Use scientific notation
        convCtx.beginPath();
        convCtx.moveTo(padding, y);
        convCtx.lineTo(padding - 5, y);
        convCtx.stroke();
    }

    // X-axis (Iterations)
    const numTicksX = Math.min(5, convergenceHistory.length - 1); // Max 5 ticks
    for (let i = 0; i <= numTicksX; i++) {
        const x = padding + (i / numTicksX) * chartWidth;
        const value = Math.floor((i / numTicksX) * (convergenceHistory.length - 1));
        convCtx.fillText(value, x, padding + chartHeight + 15);
        convCtx.beginPath();
        convCtx.moveTo(x, padding + chartHeight);
        convCtx.lineTo(x, padding + chartHeight + 5);
        convCtx.stroke();
    }

    // Draw the convergence line
    convCtx.beginPath();
    convCtx.strokeStyle = '#800080'; // Dark purple line for ICA
    convCtx.lineWidth = 2;

    convergenceHistory.forEach((cost, index) => {
        const x = mapRange(index, 0, MAX_ITERATIONS - 1, padding, padding + chartWidth);
        const y = mapRange(cost, minCost, maxCost, padding + chartHeight, padding); // Invert Y for canvas

        if (index === 0) {
            convCtx.moveTo(x, y);
        } else {
            convCtx.lineTo(x, y);
        }
    });
    convCtx.stroke();
}

// --- Main Simulation Loop ---
let lastFrameTime = 0;
const frameRate = 30; // Aim for 30 frames per second
const frameInterval = 1000 / frameRate;

function animate(currentTime) {
    animationFrameId = requestAnimationFrame(animate);

    const elapsed = currentTime - lastFrameTime;

    if (elapsed > frameInterval) {
        lastFrameTime = currentTime - (elapsed % frameInterval);

        if (currentIteration < MAX_ITERATIONS && imperialists.length > 0) {
            updateICA();
            convergenceHistory.push(globalBestCountry.cost); // Store for plotting

            // Update UI
            currentIterationSpan.textContent = currentIteration;
            bestCostSpan.textContent = globalBestCountry.cost.toExponential(4);
            bestPositionSpan.textContent = `[${globalBestCountry.position.map(val => val.toFixed(4)).join(', ')}]`;
            numActiveImperialistsSpan.textContent = imperialists.length;

            drawOptimizationSpace();
            drawConvergencePlot();

            currentIteration++;
        } else {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            startButton.textContent = 'Mô phỏng hoàn tất';
            startButton.disabled = true;
        }
    }
}

function startSimulation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // Get parameters from UI and validate
    NUM_COUNTRIES = parseInt(numCountriesInput.value);
    NUM_IMPERIALISTS = parseInt(numImperialistsInput.value);
    MAX_ITERATIONS = parseInt(maxIterationsInput.value);
    DIMENSIONS = parseInt(dimensionsInput.value);
    SEARCH_RANGE_MIN = parseFloat(searchRangeMinInput.value);
    SEARCH_RANGE_MAX = parseFloat(searchRangeMaxInput.value);
    ASSIMILATION_COEFFICIENT = parseFloat(assimilationCoefficientInput.value);
    REVOLUTION_RATE = parseFloat(revolutionRateInput.value);
    REVOLUTION_AMOUNT = parseFloat(revolutionAmountInput.value);
    IMPERIALIST_DECAY_RATE = parseFloat(imperialistDecayRateInput.value);
    UNIFICATION_THRESHOLD = parseFloat(unificationThresholdInput.value);

    if (isNaN(NUM_COUNTRIES) || NUM_COUNTRIES <= 0 ||
        isNaN(NUM_IMPERIALISTS) || NUM_IMPERIALISTS <= 0 || NUM_IMPERIALISTS >= NUM_COUNTRIES ||
        isNaN(MAX_ITERATIONS) || MAX_ITERATIONS <= 0 ||
        isNaN(DIMENSIONS) || DIMENSIONS < 1 ||
        isNaN(SEARCH_RANGE_MIN) || isNaN(SEARCH_RANGE_MAX) || SEARCH_RANGE_MIN >= SEARCH_RANGE_MAX) {
        alert("Vui lòng nhập các tham số hợp lệ!");
        return;
    }

    // Reset simulation state
    currentIteration = 0;
    initializeICA(); // Re-initialize for a new run
    startButton.textContent = 'Đang chạy...';
    startButton.disabled = true;
    resetButton.disabled = false;

    animationFrameId = requestAnimationFrame(animate);
}

function resetSimulation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    currentIteration = 0;
    imperialists = [];
    globalBestCountry = null;
    convergenceHistory = [];

    currentIterationSpan.textContent = '0';
    bestCostSpan.textContent = 'N/A';
    bestPositionSpan.textContent = 'N/A';
    numActiveImperialistsSpan.textContent = 'N/A';

    startButton.textContent = 'Bắt đầu mô phỏng';
    startButton.disabled = false;
    resetButton.disabled = true;

    drawOptimizationSpace();
    drawConvergencePlot();
}

// --- Event Listeners ---
startButton.addEventListener('click', startSimulation);
resetButton.addEventListener('click', resetSimulation);
window.addEventListener('resize', resizeCanvases);

// Initial setup on page load
resizeCanvases();
resetSimulation();