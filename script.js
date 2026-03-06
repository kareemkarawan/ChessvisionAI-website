const BACKEND_URL = "https://your-cloud-run-url.a.run.app";

let initialBoard = [
    ["br","bn","bb","bq","bk","bb","bn","br"],
    ["bp","bp","bp","bp","bp","bp","bp","bp"],
    ["--","--","--","--","--","--","--","--"],
    ["--","--","--","--","--","--","--","--"],
    ["--","--","--","--","--","--","--","--"],
    ["--","--","--","--","--","--","--","--"],
    ["wp","wp","wp","wp","wp","wp","wp","wp"],
    ["wr","wn","wb","wq","wk","wb","wn","wr"]
];

let currentFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

let selectedSquare = null;
let possibleMoves = [];

const pieceImages = {
    "wp": "static/assets/wp.png", "wr": "static/assets/wr.png", "wn": "static/assets/wn.png",
    "wb": "static/assets/wb.png", "wq": "static/assets/wq.png", "wk": "static/assets/wk.png",
    "bp": "static/assets/bp.png", "br": "static/assets/br.png", "bn": "static/assets/bn.png",
    "bb": "static/assets/bb.png", "bq": "static/assets/bq.png", "bk": "static/assets/bk.png"
};

const fenToCustomPieces = {
    "P":"wp","R":"wr","N":"wn","B":"wb","Q":"wq","K":"wk",
    "p":"bp","r":"br","n":"bn","b":"bb","q":"bq","k":"bk"
};

function selectPiece(row, col) {
    clearSelection();
    selectedSquare = {row, col};
    const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    square.classList.add('selected');
    // For simplicity, allow moving to any empty square or capture any piece
    possibleMoves = [];
    for(let r=0; r<8; r++){
        for(let c=0; c<8; c++){
            if(initialBoard[r][c] === "--" || (r !== row || c !== col)) {
                possibleMoves.push({row: r, col: c});
            }
        }
    }
    highlightPossibleMoves();
}

function handleSquareClick(event) {
    const square = event.currentTarget;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);

    if (selectedSquare) {
        if (selectedSquare.row === row && selectedSquare.col === col) {
            // Deselect
            clearSelection();
        } else if (possibleMoves.some(move => move.row === row && move.col === col)) {
            // Move piece
            movePiece(selectedSquare.row, selectedSquare.col, row, col);
            clearSelection();
        }
    } else {
        // Select piece if exists
        if (initialBoard[row][col] !== "--") {
            selectPiece(row, col);
        }
    }
}

function clearSelection() {
    selectedSquare = null;
    possibleMoves = [];
    document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.possible-move').forEach(el => el.classList.remove('possible-move'));
}

function highlightPossibleMoves() {
    possibleMoves.forEach(move => {
        const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
        square.classList.add('possible-move');
    });
}

function movePiece(fromRow, fromCol, toRow, toCol) {
    const piece = initialBoard[fromRow][fromCol];
    initialBoard[fromRow][fromCol] = "--";
    initialBoard[toRow][toCol] = piece;
    drawBoard(initialBoard);
    // Update FEN
    currentFEN = boardToFEN(initialBoard);
    updateFENWindow(currentFEN);
    // Optionally, get evaluation after move
    // getEvaluation(currentFEN);
}

function boardToFEN(board) {
    let fen = '';
    for(let row=0; row<8; row++){
        let emptyCount = 0;
        for(let col=0; col<8; col++){
            const piece = board[row][col];
            if(piece === "--") {
                emptyCount++;
            } else {
                if(emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                const fenPiece = Object.keys(fenToCustomPieces).find(key => fenToCustomPieces[key] === piece);
                fen += fenPiece;
            }
        }
        if(emptyCount > 0) fen += emptyCount;
        if(row < 7) fen += '/';
    }
    fen += ' w KQkq - 0 1'; // Simplified, assuming white to move, castling available, etc.
    return fen;
}

// Draw chessboard
function drawBoard(board) {
    const chessboard = document.getElementById('chessboard');
    chessboard.innerHTML = '';
    for(let row=0; row<8; row++){
        for(let col=0; col<8; col++){
            const square = document.createElement('div');
            square.classList.add((row+col)%2===0?'white':'black');
            square.dataset.row = row;
            square.dataset.col = col;
            square.addEventListener('click', handleSquareClick);
            const piece = board[row][col];
            if(piece!=="--"){
                const imgDiv = document.createElement('div');
                imgDiv.classList.add('piece');
                imgDiv.style.backgroundImage = `url(${pieceImages[piece]})`;
                imgDiv.dataset.piece = piece;
                imgDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectPiece(row, col);
                });
                square.appendChild(imgDiv);
            }
            chessboard.appendChild(square);
        }
    }
}

// Prompt for FEN input
async function get_FEN_from_input(){
    let fen = prompt("Enter FEN notation:");
    if(fen) getEvaluation(fen);
}

// Evaluate FEN
async function getEvaluation(fen){
    currentFEN = fen;
    updateFENWindow(fen);
    updateBoard(fen);

    const response = await fetch(`${BACKEND_URL}/evaluate`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({fen})
    });
    const data = await response.json();

    document.getElementById("best-move").innerText = data.best_move || "N/A";

    let evalValue = data.evaluation_type==="cp"?data.evaluation:(data.evaluation>0?1000:-1000);
    let percentage = (evalValue+1000)/2000;

    if(data.evaluation_type==="mate"){
        document.getElementById("move-eval-num").innerText = "Mate in "+data.evaluation;
    }else{
        let evalStr = (evalValue>0?"+":"")+evalValue/100;
        document.getElementById("move-eval-num").innerText = evalStr;
    }

    document.getElementById("white-bar").style.height = `${percentage*100}%`;
    document.getElementById("black-bar").style.height = `${(1-percentage)*100}%`;
}

// Upload image from file
async function uploadImage(){
    let file = document.getElementById("uploadInput").files[0];
    if(!file) return;
    processImageFile(file);
}

// Upload image from camera
async function uploadImageCamera(){
    let file = document.getElementById("uploadInputCamera").files[0];
    if(!file) return;
    processImageFile(file);
}

// Process image and send to backend
function processImageFile(file){
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e=>img.src = e.target.result;
    img.onload = async ()=>{
        const canvas = document.createElement("canvas");
        canvas.width=img.width; canvas.height=img.height;
        canvas.getContext("2d").drawImage(img,0,0);
        canvas.toBlob(async blob=>{
            const formData = new FormData();
            formData.append("image",blob,"img.jpg");
            const res = await fetch(`${BACKEND_URL}/process_image`,{method:"POST",body:formData});
            const data = await res.json();
            getEvaluation(data.fen);
        },"image/jpeg",1.0);
    };
    reader.readAsDataURL(file);
}

// Convert FEN to board array
function updateBoard(fen){
    const rows = fen.split(" ")[0].split("/");
    initialBoard = [];
    for(let r=0;r<8;r++){
        initialBoard[r]=[];
        for(let char of rows[r]){
            if(!isNaN(char)){
                for(let i=0;i<parseInt(char);i++) initialBoard[r].push("--");
            } else initialBoard[r].push(fenToCustomPieces[char]);
        }
    }
    drawBoard(initialBoard);
}

// Update FEN display
function updateFENWindow(fen){
    document.getElementById("fenWindow").textContent = `FEN: ${fen}`;
}

// Initial render once DOM content is loaded
window.addEventListener('DOMContentLoaded', () => {
    drawBoard(initialBoard);
    updateFENWindow(currentFEN);
});