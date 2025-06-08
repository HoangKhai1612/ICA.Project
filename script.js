// script.js (Cải tiến và sửa lỗi cho ICA)

// --- Thiết lập Canvas ---
const optimizationCanvas = document.getElementById('optimizationCanvas');
const optCtx = optimizationCanvas.getContext('2d'); // Context 2D cho canvas không gian tối ưu
const convergencePlotCanvas = document.getElementById('convergencePlotCanvas');
const convCtx = convergencePlotCanvas.getContext('2d'); // Context 2D cho canvas biểu đồ hội tụ

// --- Các phần tử DOM cho Thông tin và Điều khiển ---
const numCountriesInput = document.getElementById('numCountries'); // Input cho số lượng cá thể (quốc gia)
const numImperialistsInput = document.getElementById('numImperialists'); // Input cho số lượng đế quốc ban đầu
const maxIterationsInput = document.getElementById('maxIterations'); // Input cho số vòng lặp tối đa
const dimensionsInput = document.getElementById('dimensions'); // Input cho số chiều của bài toán
const searchRangeMinInput = document.getElementById('searchRangeMin'); // Input cho giới hạn tìm kiếm tối thiểu
const searchRangeMaxInput = document.getElementById('searchRangeMax'); // Input cho giới hạn tìm kiếm tối đa
const assimilationCoefficientInput = document.getElementById('assimilationCoefficient'); // Input cho hệ số hấp dẫn (beta)
const revolutionRateInput = document.getElementById('revolutionRate'); // Input cho tỷ lệ cách mạng
const revolutionAmountInput = document.getElementById('revolutionAmount'); // Input mới: Độ lớn cách mạng (zeta)
const imperialistDecayRateInput = document.getElementById('imperialistDecayRate'); // Input mới: Tốc độ suy yếu đế quốc
const unificationThresholdInput = document.getElementById('unificationThreshold'); // Input mới: Ngưỡng thống nhất giữa các đế quốc
const startButton = document.getElementById('startButton'); // Nút Bắt đầu mô phỏng
const resetButton = document.getElementById('resetButton'); // Nút Đặt lại mô phỏng
const currentIterationSpan = document.getElementById('currentIteration'); // Hiển thị vòng lặp hiện tại
const bestCostSpan = document.getElementById('bestCost'); // Hiển thị chi phí tốt nhất toàn cục
const bestPositionSpan = document.getElementById('bestPosition'); // Hiển thị vị trí tốt nhất toàn cục
const numActiveImperialistsSpan = document.getElementById('numActiveImperialists'); // Hiển thị số lượng đế quốc đang hoạt động

// --- Các biến Mô phỏng Toàn cục ---
let imperialists = []; // Mảng chứa các đối tượng đế quốc {leader: Country, colonies: Country[]}
let globalBestCountry = null; // Cá thể tốt nhất toàn cục tìm được
let currentIteration = 0; // Vòng lặp hiện tại của mô phỏng
let animationFrameId = null; // ID của frame hoạt ảnh để điều khiển vòng lặp
let convergenceHistory = []; // Lịch sử lưu trữ chi phí tốt nhất qua các vòng lặp để vẽ biểu đồ hội tụ

// --- Tham số Mô phỏng (Giá trị mặc định từ tài liệu của bạn hoặc các giá trị ICA điển hình) ---
let NUM_COUNTRIES = 50; // Tổng số lượng cá thể (quốc gia)
let NUM_IMPERIALISTS = 5; // Số lượng đế quốc ban đầu
let MAX_ITERATIONS = 1000; // Số vòng lặp tối đa
let DIMENSIONS = 2; // Số chiều của không gian tìm kiếm (để trực quan hóa, chủ yếu dùng 2D)
let SEARCH_RANGE_MIN = -5.12; // Giới hạn dưới của không gian tìm kiếm
let SEARCH_RANGE_MAX = 5.12; // Giới hạn trên của không gian tìm kiếm

// Các tham số cụ thể của thuật toán ICA
let ASSIMILATION_COEFFICIENT = 1.5; // Hệ số hấp dẫn (beta - assimilation factor)
let REVOLUTION_RATE = 0.1; // Tỷ lệ (xác suất) một thuộc địa trải qua quá trình cách mạng
let REVOLUTION_AMOUNT = 0.1; // Zeta (phần trăm của phạm vi tìm kiếm cho độ lớn cách mạng)
let IMPERIALIST_DECAY_RATE = 0.02; // Tốc độ suy yếu quyền lực của đế quốc (ảnh hưởng của chi phí thuộc địa)
let UNIFICATION_THRESHOLD = 0.05; // Ngưỡng khoảng cách tương đối để các đế quốc có thể sáp nhập

// --- Hàm Benchmark: Rastrigin ---
const benchmarkFunction = {
    func: (position) => { // Định nghĩa hàm Rastrigin
        const A = 10;
        return A * position.length + position.reduce((sum, val) => sum + (val * val - A * Math.cos(2 * Math.PI * val)), 0);
    },
    min: 0, // Giá trị cực tiểu toàn cục của hàm Rastrigin
    minPos: (dim) => Array(dim).fill(0) // Vị trí của cực tiểu toàn cục (tất cả các chiều đều bằng 0)
};

// --- Các Hàm Hỗ trợ ---

// Ánh xạ một giá trị từ một phạm vi đầu vào sang một phạm vi đầu ra khác để vẽ lên canvas
function mapRange(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

// Tạo một số ngẫu nhiên trong một phạm vi nhất định
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

// Giới hạn một giá trị trong một phạm vi min/max
function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

// Tính toán chi phí của một vị trí sử dụng hàm benchmark đã chọn
function calculateCost(position) {
    return benchmarkFunction.func(position);
}

// Tính toán khoảng cách Euclidean giữa hai vị trí
function euclideanDistance(pos1, pos2) {
    let sumSq = 0;
    for (let i = 0; i < pos1.length; i++) {
        sumSq += Math.pow(pos1[i] - pos2[i], 2);
    }
    return Math.sqrt(sumSq);
}

// --- Logic Thuật toán ICA ---

class Country { // Định nghĩa lớp Quốc gia (Country)
    constructor(dimensions, searchRangeMin, searchRangeMax) {
        this.position = Array(dimensions).fill(0).map(() => getRandomArbitrary(searchRangeMin, searchRangeMax)); // Vị trí ngẫu nhiên ban đầu
        this.cost = calculateCost(this.position); // Chi phí (giá trị hàm mục tiêu) tại vị trí này
    }
}

function initializeICA() { // Hàm khởi tạo thuật toán ICA
    imperialists = []; // Đặt lại danh sách các đế quốc
    globalBestCountry = null; // Đặt lại quốc gia tốt nhất toàn cục
    convergenceHistory = []; // Xóa lịch sử hội tụ

    let allCountries = [];
    for (let i = 0; i < NUM_COUNTRIES; i++) {
        allCountries.push(new Country(DIMENSIONS, SEARCH_RANGE_MIN, SEARCH_RANGE_MAX)); // Tạo tất cả các quốc gia
    }

    // Sắp xếp tất cả các quốc gia theo chi phí (chi phí thấp hơn là tốt hơn)
    allCountries.sort((a, b) => a.cost - b.cost);

    // Chọn các đế quốc từ các quốc gia tốt nhất
    for (let i = 0; i < NUM_IMPERIALISTS; i++) {
        imperialists.push({
            leader: allCountries[i], // Quốc gia tốt nhất trở thành lãnh đạo đế quốc
            colonies: [], // Khởi tạo danh sách thuộc địa rỗng
            normalizedPower: 0 // Sức mạnh chuẩn hóa (sẽ được tính toán động)
        });
    }

    // Gán các quốc gia còn lại làm thuộc địa
    const coloniesToAssign = allCountries.slice(NUM_IMPERIALISTS);

    // Tính toán sức mạnh ban đầu của đế quốc để phân chia thuộc địa
    const imperialistCosts = imperialists.map(imp => imp.leader.cost);
    const maxImpCost = Math.max(...imperialistCosts);
    const minImpCost = Math.min(...imperialistCosts);
    let totalNormalizedPower = 0;

    imperialists.forEach(imp => {
        // Sức mạnh tỷ lệ nghịch với chi phí (chi phí thấp hơn = sức mạnh cao hơn)
        // Chuẩn hóa sức mạnh: (MaxCost - CurrentCost) / (MaxCost - MinCost)
        // Thêm một số epsilon nhỏ vào mẫu số để tránh chia cho 0 nếu tất cả chi phí đều giống nhau
        imp.normalizedPower = (maxImpCost - imp.leader.cost) / (maxImpCost - minImpCost + 1e-9);
        totalNormalizedPower += imp.normalizedPower;
    });

    // Phân phối thuộc địa dựa trên sức mạnh chuẩn hóa
    let currentColonyIndex = 0;
    if (totalNormalizedPower > 0) { // Tránh chia cho 0
        imperialists.forEach(imp => {
            const numColonies = Math.round(imp.normalizedPower / totalNormalizedPower * coloniesToAssign.length);
            for (let j = 0; j < numColonies && currentColonyIndex < coloniesToAssign.length; j++) {
                imp.colonies.push(coloniesToAssign[currentColonyIndex]);
                currentColonyIndex++;
            }
        });
    }

    // Gán bất kỳ thuộc địa còn lại nào do làm tròn cho đế quốc mạnh nhất
    while (currentColonyIndex < coloniesToAssign.length) {
        let strongestImp = imperialists.reduce((prev, current) =>
            (prev.leader.cost < current.leader.cost) ? prev : current // Tìm đế quốc có chi phí lãnh đạo thấp nhất (mạnh nhất)
        );
        strongestImp.colonies.push(coloniesToAssign[currentColonyIndex]);
        currentColonyIndex++;
    }

    // Cập nhật vị trí tốt nhất toàn cục ban đầu
    updateGlobalBest();
}

function updateGlobalBest() { // Hàm cập nhật vị trí tốt nhất toàn cục
    let currentGlobalBestCost = Infinity;
    let currentGlobalBestPosition = [];

    // Duyệt qua tất cả các đế quốc và thuộc địa để tìm cá thể có chi phí thấp nhất
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

    // Nếu tìm thấy một chi phí tốt hơn hoặc đây là lần cập nhật đầu tiên
    if (globalBestCountry === null || currentGlobalBestCost < globalBestCountry.cost) {
        globalBestCountry = {
            position: currentGlobalBestPosition,
            cost: currentGlobalBestCost
        };
    }
}

function updateICA() { // Hàm chứa logic chính của thuật toán ICA cho mỗi vòng lặp
    // 1. Assimilation (Hấp dẫn): Các thuộc địa di chuyển về phía lãnh đạo đế quốc của chúng
    imperialists.forEach(imp => {
        imp.colonies.forEach(colony => {
            for (let d = 0; d < DIMENSIONS; d++) {
                // Vector hướng từ thuộc địa đến đế quốc
                const direction = imp.leader.position[d] - colony.position[d];
                // Cập nhật vị trí: vị trí hiện tại + số ngẫu nhiên * hệ số hấp dẫn * hướng
                colony.position[d] += getRandomArbitrary(0, 1) * ASSIMILATION_COEFFICIENT * direction;
                colony.position[d] = clamp(colony.position[d], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX); // Đảm bảo nằm trong phạm vi tìm kiếm
            }
            colony.cost = calculateCost(colony.position); // Cập nhật chi phí của thuộc địa
        });
    });

    // 2. Revolution (Cách mạng): Một số thuộc địa ngẫu nhiên có thể trải qua quá trình cách mạng
    imperialists.forEach(imp => {
        imp.colonies.forEach(colony => {
            if (Math.random() < REVOLUTION_RATE) { // Kiểm tra xác suất cách mạng
                // Cách mạng: nhảy ngẫu nhiên trong một tỷ lệ phần trăm của phạm vi tìm kiếm
                const rangeWidth = SEARCH_RANGE_MAX - SEARCH_RANGE_MIN;
                for (let d = 0; d < DIMENSIONS; d++) {
                    colony.position[d] += getRandomArbitrary(-REVOLUTION_AMOUNT * rangeWidth, REVOLUTION_AMOUNT * rangeWidth);
                    colony.position[d] = clamp(colony.position[d], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX); // Đảm bảo nằm trong phạm vi tìm kiếm
                }
                colony.cost = calculateCost(colony.position); // Cập nhật chi phí sau cách mạng
            }
        });
    });

    // 3. Exchange positions of Imperialist and Colony (Trao đổi vị trí giữa Đế quốc và Thuộc địa)
    imperialists.forEach(imp => {
        if (imp.colonies.length > 0) { // Đảm bảo có thuộc địa để so sánh
            // Tìm thuộc địa tốt nhất trong đế quốc này
            const bestColony = imp.colonies.reduce((best, current) =>
                (current.cost < best.cost) ? current : best
            );

            if (bestColony.cost < imp.leader.cost) {
                // Nếu thuộc địa tốt hơn lãnh đạo đế quốc, thì thuộc địa trở thành lãnh đạo mới, lãnh đạo cũ trở thành thuộc địa
                const tempLeader = imp.leader;
                imp.leader = bestColony;
                imp.colonies = imp.colonies.filter(c => c !== bestColony); // Loại bỏ lãnh đạo mới khỏi danh sách thuộc địa
                imp.colonies.push(tempLeader); // Thêm lãnh đạo cũ vào danh sách thuộc địa
            }
        }
    });

    // Cập nhật vị trí tốt nhất toàn cục sau các trao đổi tiềm năng
    updateGlobalBest();

    // 4. Imperialistic Competition (Cạnh tranh giữa các Đế quốc)
    if (imperialists.length > 1) { // Chỉ cạnh tranh nếu có hơn một đế quốc
        // Tính toán tổng chi phí cho mỗi đế quốc (chi phí lãnh đạo + chi phí trung bình của thuộc địa)
        // Tổng chi phí thấp hơn có nghĩa là đế quốc mạnh hơn
        imperialists.forEach(imp => {
            let totalColonyCost = imp.colonies.reduce((sum, col) => sum + col.cost, 0);
            let meanColonyCost = imp.colonies.length > 0 ? totalColonyCost / imp.colonies.length : 0;
            // Sức mạnh của một đế quốc tỷ lệ nghịch với tổng chi phí của nó.
            // Tốc độ suy yếu quyết định mức độ chi phí thuộc địa đóng góp vào tổng chi phí của đế quốc.
            imp.empireCost = imp.leader.cost + (meanColonyCost * IMPERIALIST_DECAY_RATE);
        });

        // Sắp xếp các đế quốc theo chi phí đế quốc của chúng (chi phí thấp hơn là mạnh hơn)
        imperialists.sort((a, b) => a.empireCost - b.empireCost);

        const weakestImperialist = imperialists[imperialists.length - 1]; // Đế quốc yếu nhất (cuối cùng sau khi sắp xếp)
        const strongestImperialist = imperialists[0]; // Đế quốc mạnh nhất (đầu tiên sau khi sắp xếp)

        // Chuyển các thuộc địa từ đế quốc yếu nhất sang các đế quốc khác
        if (weakestImperialist.colonies.length > 0) {
            weakestImperialist.colonies.forEach(colony => {
                // Tính toán sức mạnh để phân phối giữa *tất cả các đế quốc còn lại*
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
                        targetImp.colonies.push(colony); // Thêm thuộc địa vào đế quốc mục tiêu
                    } else { // Trường hợp dự phòng, gán cho đế quốc mạnh nhất nếu không chọn được ngẫu nhiên vì lý do nào đó
                        strongestImperialist.colonies.push(colony);
                    }
                } else { // Nếu chỉ có một đế quốc hoặc tất cả đều có sức mạnh như nhau, gán cho đế quốc mạnh nhất
                    strongestImperialist.colonies.push(colony);
                }
            });
            weakestImperialist.colonies = []; // Xóa các thuộc địa của đế quốc yếu nhất sau khi chuyển
        }

        // Nếu đế quốc yếu nhất không còn thuộc địa nào và không phải là đế quốc duy nhất còn lại, nó sụp đổ
        if (weakestImperialist.colonies.length === 0 && imperialists.length > 1) {
            strongestImperialist.colonies.push(weakestImperialist.leader); // Lãnh đạo của đế quốc sụp đổ bị hấp thụ làm thuộc địa
            imperialists = imperialists.filter(imp => imp !== weakestImperialist); // Loại bỏ đế quốc đã sụp đổ khỏi danh sách
        }
    }

    // 5. Empire Unification (Thống nhất Đế quốc - phiên bản đơn giản)
    // Nếu hai đế quốc quá gần nhau, đế quốc yếu hơn sẽ sụp đổ và sáp nhập vào đế quốc mạnh hơn.
    if (imperialists.length > 1) {
        for (let i = 0; i < imperialists.length; i++) {
            for (let j = i + 1; j < imperialists.length; j++) { // So sánh từng cặp đế quốc
                const imp1 = imperialists[i];
                const imp2 = imperialists[j];
                const searchRangeLength = SEARCH_RANGE_MAX - SEARCH_RANGE_MIN;
                const distance = euclideanDistance(imp1.leader.position, imp2.leader.position); // Tính khoảng cách giữa hai lãnh đạo

                if (distance < UNIFICATION_THRESHOLD * searchRangeLength) { // Nếu khoảng cách nhỏ hơn ngưỡng thống nhất
                    // Quyết định đế quốc nào mạnh hơn dựa trên chi phí lãnh đạo (chi phí thấp hơn là mạnh hơn)
                    let strongerImp = imp1.leader.cost < imp2.leader.cost ? imp1 : imp2;
                    let weakerImp = strongerImp === imp1 ? imp2 : imp1;

                    // Chuyển tất cả các thuộc địa (bao gồm cả lãnh đạo yếu hơn) sang đế quốc mạnh hơn
                    strongerImp.colonies = strongerImp.colonies.concat(weakerImp.colonies);
                    strongerImp.colonies.push(weakerImp.leader); // Lãnh đạo yếu hơn cũng trở thành thuộc địa của đế quốc mạnh hơn

                    // Loại bỏ đế quốc yếu hơn khỏi danh sách
                    imperialists = imperialists.filter(imp => imp !== weakerImp);
                    break; // Thoát vòng lặp bên trong, vì danh sách các đế quốc đã thay đổi
                }
            }
        }
    }
}


// --- Các Hàm Vẽ ---

function resizeCanvases() { // Hàm điều chỉnh kích thước canvas
    optimizationCanvas.width = optimizationCanvas.parentElement.clientWidth; // Chiều rộng bằng chiều rộng của phần tử cha
    optimizationCanvas.height = 400; // Giữ chiều cao cố định
    convergencePlotCanvas.width = convergencePlotCanvas.parentElement.clientWidth; // Chiều rộng bằng chiều rộng của phần tử cha
    convergencePlotCanvas.height = 400; // Giữ chiều cao cố định
    drawOptimizationSpace(); // Vẽ lại không gian tối ưu ngay sau khi thay đổi kích thước
    drawConvergencePlot(); // Vẽ lại biểu đồ hội tụ
}

function drawOptimizationSpace() { // Hàm vẽ không gian tìm kiếm
    if (DIMENSIONS !== 2) { // Chỉ trực quan hóa được ở 2 chiều
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

    // Vẽ nền dựa trên chi phí hàm (Rastrigin)
    const gridSize = 50; // Giá trị nhỏ hơn = chi tiết hơn, nhưng vẽ chậm hơn
    const cellWidth = optimizationCanvas.width / gridSize;
    const cellHeight = optimizationCanvas.height / gridSize;

    // Xác định chi phí min/max để ánh xạ màu cho trực quan hóa
    const vizMaxCost = benchmarkFunction.func(Array(DIMENSIONS).fill(SEARCH_RANGE_MAX)); // Ước tính sơ bộ chi phí tối đa của Rastrigin trong phạm vi
    const vizMinCost = benchmarkFunction.min; // Chi phí tối thiểu của hàm benchmark

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const x = mapRange(i, 0, gridSize, SEARCH_RANGE_MIN, SEARCH_RANGE_MAX);
            const y = mapRange(j, 0, gridSize, SEARCH_RANGE_MIN, SEARCH_RANGE_MAX);
            const cost = calculateCost([x, y]);

            const normalizedCost = clamp(cost, vizMinCost, vizMaxCost) / (vizMaxCost - vizMinCost + 1e-9); // Chuẩn hóa chi phí, thêm epsilon
            const colorVal = Math.floor(normalizedCost * 255);
            // Sử dụng thang màu tím cho ICA
            optCtx.fillStyle = `rgb(${255 - colorVal}, ${200 - colorVal * 0.5}, ${255 - colorVal})`; // Màu sáng hơn cho chi phí thấp hơn
            optCtx.fillRect(i * cellWidth, optimizationCanvas.height - (j * cellHeight) - cellHeight, cellWidth, cellHeight);
        }
    }

    // Vẽ các thuộc địa (chấm tím nhạt)
    imperialists.forEach(imp => {
        imp.colonies.forEach(colony => {
            const drawX = mapRange(colony.position[0], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, 0, optimizationCanvas.width);
            const drawY = mapRange(colony.position[1], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, optimizationCanvas.height, 0); // Đảo ngược Y cho canvas

            optCtx.beginPath();
            optCtx.arc(drawX, drawY, 4, 0, Math.PI * 2); // Vẽ hình tròn
            optCtx.fillStyle = '#A020F0'; // Màu tím nhạt
            optCtx.fill();
            optCtx.strokeStyle = '#800080'; // Màu tím đậm hơn cho viền
            optCtx.lineWidth = 1;
            optCtx.stroke();
        });
    });

    // Vẽ các đế quốc (chấm tím đậm hơn, lớn hơn)
    imperialists.forEach(imp => {
        const drawX = mapRange(imp.leader.position[0], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, 0, optimizationCanvas.width);
        const drawY = mapRange(imp.leader.position[1], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, optimizationCanvas.height, 0); // Đảo ngược Y cho canvas

        optCtx.beginPath();
        optCtx.arc(drawX, drawY, 7, 0, Math.PI * 2); // Vẽ hình tròn lớn hơn
        optCtx.fillStyle = '#800080'; // Màu tím đậm
        optCtx.fill();
        optCtx.strokeStyle = '#4B0082'; // Màu chàm cho viền
        optCtx.lineWidth = 2;
        optCtx.stroke();
    });

    // Vẽ quốc gia tốt nhất toàn cục (chấm vàng sáng nhất, lớn nhất)
    if (globalBestCountry && globalBestCountry.position.length === 2) {
        const drawX = mapRange(globalBestCountry.position[0], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, 0, optimizationCanvas.width);
        const drawY = mapRange(globalBestCountry.position[1], SEARCH_RANGE_MIN, SEARCH_RANGE_MAX, optimizationCanvas.height, 0); // Đảo ngược Y cho canvas

        optCtx.beginPath();
        optCtx.arc(drawX, drawY, 10, 0, Math.PI * 2); // Vẽ hình tròn lớn nhất
        optCtx.fillStyle = '#FFD700'; // Màu vàng (Gold)
        optCtx.fill();
        optCtx.strokeStyle = '#DAA520'; // Màu vàng sẫm (Goldenrod)
        optCtx.lineWidth = 3;
        optCtx.stroke();
        optCtx.closePath();

        // Vẽ dấu thập nhỏ để đánh dấu
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

function drawConvergencePlot() { // Hàm vẽ biểu đồ hội tụ
    convCtx.clearRect(0, 0, convergencePlotCanvas.width, convergencePlotCanvas.height);

    if (convergenceHistory.length === 0) { // Nếu chưa có dữ liệu lịch sử
        convCtx.font = '20px Arial';
        convCtx.fillStyle = '#555';
        convCtx.textAlign = 'center';
        convCtx.fillText('Chưa có dữ liệu để vẽ biểu đồ', convergencePlotCanvas.width / 2, convergencePlotCanvas.height / 2);
        return;
    }

    const padding = 40; // Khoảng đệm cho biểu đồ
    const chartWidth = convergencePlotCanvas.width - 2 * padding; // Chiều rộng của vùng vẽ biểu đồ
    const chartHeight = convergencePlotCanvas.height - 2 * padding; // Chiều cao của vùng vẽ biểu đồ

    let maxCost = Math.max(...convergenceHistory); // Chi phí tối đa trong lịch sử
    let minCost = Math.min(...convergenceHistory); // Chi phí tối thiểu trong lịch sử
    // Đảm bảo costRange không bằng 0 để tránh chia cho 0 nếu chi phí không thay đổi
    const costRange = maxCost - minCost > 1e-9 ? maxCost - minCost : 1;

    // Vẽ các trục tọa độ
    convCtx.strokeStyle = '#888';
    convCtx.lineWidth = 1;
    convCtx.beginPath();
    convCtx.moveTo(padding, padding); // Trục Y
    convCtx.lineTo(padding, padding + chartHeight); // Trục Y
    convCtx.lineTo(padding + chartWidth, padding + chartHeight); // Trục X
    convCtx.stroke();

    // Vẽ nhãn trục
    convCtx.fillStyle = '#555';
    convCtx.font = '12px Arial';
    convCtx.textAlign = 'center';
    convCtx.fillText('Vòng lặp', padding + chartWidth / 2, convergencePlotCanvas.height - 10); // Nhãn trục X
    convCtx.save(); // Lưu trạng thái canvas
    convCtx.translate(15, padding + chartHeight / 2); // Di chuyển đến vị trí nhãn trục Y
    convCtx.rotate(-Math.PI / 2); // Xoay nhãn
    convCtx.fillText('Chi phí tốt nhất', 0, 0); // Nhãn trục Y
    convCtx.restore(); // Khôi phục trạng thái canvas

    // Vẽ các dấu chia và giá trị trên trục
    // Trục Y (Chi phí)
    for (let i = 0; i <= 5; i++) {
        const y = padding + chartHeight - (i / 5) * chartHeight;
        const value = minCost + (i / 5) * costRange;
        convCtx.fillText(value.toExponential(2), padding - 10, y + 4); // Hiển thị giá trị theo ký hiệu khoa học
        convCtx.beginPath();
        convCtx.moveTo(padding, y);
        convCtx.lineTo(padding - 5, y);
        convCtx.stroke();
    }

    // Trục X (Vòng lặp)
    const numTicksX = Math.min(5, convergenceHistory.length - 1); // Tối đa 5 dấu chia trên trục X
    for (let i = 0; i <= numTicksX; i++) {
        const x = padding + (i / numTicksX) * chartWidth;
        const value = Math.floor((i / numTicksX) * (convergenceHistory.length - 1));
        convCtx.fillText(value, x, padding + chartHeight + 15);
        convCtx.beginPath();
        convCtx.moveTo(x, padding + chartHeight);
        convCtx.lineTo(x, padding + chartHeight + 5);
        convCtx.stroke();
    }

    // Vẽ đường hội tụ
    convCtx.beginPath();
    convCtx.strokeStyle = '#800080'; // Đường màu tím đậm cho ICA
    convCtx.lineWidth = 2;

    convergenceHistory.forEach((cost, index) => {
        const x = mapRange(index, 0, MAX_ITERATIONS - 1, padding, padding + chartWidth);
        const y = mapRange(cost, minCost, maxCost, padding + chartHeight, padding); // Đảo ngược trục Y cho canvas

        if (index === 0) {
            convCtx.moveTo(x, y);
        } else {
            convCtx.lineTo(x, y);
        }
    });
    convCtx.stroke();
}

// --- Vòng lặp Mô phỏng Chính ---
let lastFrameTime = 0; // Thời gian của frame cuối cùng
const frameRate = 30; // Mục tiêu 30 khung hình mỗi giây
const frameInterval = 1000 / frameRate; // Khoảng thời gian giữa các khung hình (ms)

function animate(currentTime) { // Hàm hoạt ảnh chính
    animationFrameId = requestAnimationFrame(animate); // Yêu cầu frame hoạt ảnh tiếp theo

    const elapsed = currentTime - lastFrameTime; // Thời gian đã trôi qua kể từ frame cuối cùng

    if (elapsed > frameInterval) { // Nếu đủ thời gian để vẽ frame mới
        lastFrameTime = currentTime - (elapsed % frameInterval); // Điều chỉnh thời gian để giữ frame rate ổn định

        if (currentIteration < MAX_ITERATIONS && imperialists.length > 0) { // Nếu chưa đạt số vòng lặp tối đa và vẫn còn đế quốc
            updateICA(); // Cập nhật trạng thái thuật toán ICA
            convergenceHistory.push(globalBestCountry.cost); // Lưu chi phí tốt nhất để vẽ biểu đồ

            // Cập nhật giao diện người dùng
            currentIterationSpan.textContent = currentIteration;
            bestCostSpan.textContent = globalBestCountry.cost.toExponential(4); // Hiển thị chi phí tốt nhất theo ký hiệu khoa học
            bestPositionSpan.textContent = `[${globalBestCountry.position.map(val => val.toFixed(4)).join(', ')}]`; // Hiển thị vị trí tốt nhất
            numActiveImperialistsSpan.textContent = imperialists.length; // Hiển thị số đế quốc đang hoạt động

            drawOptimizationSpace(); // Vẽ lại không gian tối ưu
            drawConvergencePlot(); // Vẽ lại biểu đồ hội tụ

            currentIteration++; // Tăng vòng lặp hiện tại
        } else { // Nếu mô phỏng đã hoàn tất
            cancelAnimationFrame(animationFrameId); // Dừng vòng lặp hoạt ảnh
            animationFrameId = null;
            startButton.textContent = 'Mô phỏng hoàn tất'; // Cập nhật trạng thái nút
            startButton.disabled = true; // Vô hiệu hóa nút Bắt đầu
        }
    }
}

function startSimulation() { // Hàm bắt đầu mô phỏng
    if (animationFrameId) { // Nếu đang có hoạt ảnh chạy, dừng nó
        cancelAnimationFrame(animationFrameId);
    }

    // Lấy các tham số từ giao diện người dùng và kiểm tra tính hợp lệ
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

    // Kiểm tra các ràng buộc đầu vào
    if (isNaN(NUM_COUNTRIES) || NUM_COUNTRIES <= 0 ||
        isNaN(NUM_IMPERIALISTS) || NUM_IMPERIALISTS <= 0 || NUM_IMPERIALISTS >= NUM_COUNTRIES ||
        isNaN(MAX_ITERATIONS) || MAX_ITERATIONS <= 0 ||
        isNaN(DIMENSIONS) || DIMENSIONS < 1 ||
        isNaN(SEARCH_RANGE_MIN) || isNaN(SEARCH_RANGE_MAX) || SEARCH_RANGE_MIN >= SEARCH_RANGE_MAX) {
        alert("Vui lòng nhập các tham số hợp lệ!"); // Thông báo lỗi nếu đầu vào không hợp lệ
        return;
    }

    // Đặt lại trạng thái mô phỏng
    currentIteration = 0;
    initializeICA(); // Khởi tạo lại ICA cho một lần chạy mới
    startButton.textContent = 'Đang chạy...'; // Cập nhật văn bản nút
    startButton.disabled = true; // Vô hiệu hóa nút Bắt đầu
    resetButton.disabled = false; // Kích hoạt nút Đặt lại

    animationFrameId = requestAnimationFrame(animate); // Bắt đầu vòng lặp hoạt ảnh
}

function resetSimulation() { // Hàm đặt lại mô phỏng
    if (animationFrameId) { // Nếu có hoạt ảnh đang chạy, dừng nó
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    currentIteration = 0; // Đặt lại vòng lặp
    imperialists = []; // Xóa các đế quốc
    globalBestCountry = null; // Xóa quốc gia tốt nhất toàn cục
    convergenceHistory = []; // Xóa lịch sử hội tụ

    // Đặt lại các giá trị hiển thị trên giao diện người dùng
    currentIterationSpan.textContent = '0';
    bestCostSpan.textContent = 'N/A';
    bestPositionSpan.textContent = 'N/A';
    numActiveImperialistsSpan.textContent = 'N/A';

    startButton.textContent = 'Bắt đầu mô phỏng'; // Cập nhật văn bản nút
    startButton.disabled = false; // Kích hoạt nút Bắt đầu
    resetButton.disabled = true; // Vô hiệu hóa nút Đặt lại

    drawOptimizationSpace(); // Vẽ lại không gian tối ưu (trống)
    drawConvergencePlot(); // Vẽ lại biểu đồ hội tụ (trống)
}

// --- Bộ lắng nghe sự kiện ---
startButton.addEventListener('click', startSimulation); // Gắn sự kiện click cho nút Bắt đầu
resetButton.addEventListener('click', resetSimulation); // Gắn sự kiện click cho nút Đặt lại
window.addEventListener('resize', resizeCanvases); // Gắn sự kiện thay đổi kích thước cửa sổ để điều chỉnh canvas

// Thiết lập ban đầu khi trang tải
resizeCanvases(); // Điều chỉnh kích thước canvas lần đầu
resetSimulation(); // Đặt lại mô phỏng về trạng thái ban đầu