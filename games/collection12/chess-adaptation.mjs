// Maintenance transforms for the pinned, readable international-chess runtime.
function replaceOnce(source, from, to) {
  if (!source.includes(from) || source.indexOf(from) !== source.lastIndexOf(from)) {
    throw new Error(`Missing or ambiguous chess adaptation anchor: ${from}`);
  }
  return source.replace(from, to);
}

export function adaptChessPosition(source) {
  source = source.replace(/\r\n/g, '\n');
  source = replaceOnce(source, 'this.halfMoveClock =', 'this.halfmoveClock =');
  source = replaceOnce(source, '/** @return {boolean} */\nChess.Position.prototype.isThreefoldRepetitionRuleDraw', `/**
 * Repetition compares available moves, so an unusable en passant marker does
 * not distinguish otherwise identical positions. Keep the incremental board
 * hash unchanged; only the repetition-history key omits that marker.
 * @return {!Chess.Zobrist}
 */
Chess.Position.prototype.getRepetitionKey = function() {
\tvar key = this.hashKey.dup();
\tif (this.canEnPassant()) {
\t\tvar legalEnPassant = this.generateMoves(true).some(function(move) {
\t\t\treturn move.getKind() === Chess.Move.Kind.EN_PASSANT_CAPTURE && this.isMoveLegal(move);
\t\t}, this);
\t\tif (!legalEnPassant) key.updateEnPassantSquare(this.getEnPassantSquare());
\t}
\treturn key;
};

/** @return {boolean} */
Chess.Position.prototype.isThreefoldRepetitionRuleDraw`);
  source = replaceOnce(source, 'var currentHashKey = this.hashKey;', 'var currentHashKey = this.getRepetitionKey();');
  source = replaceOnce(source, '}, 0) >= 3;', '}, 0) >= 2; // Two past occurrences plus the current position.');
  return replaceOnce(source, 'this.hashHistory.push(this.hashKey.dup());', 'this.hashHistory.push(this.getRepetitionKey());');
}

export function adaptChessUi(source) {
  source = source.replace(/\r\n/g, '\n');
  source = replaceOnce(source, 'var moves = this.chessPosition.getMoves();', 'var playing = this.chessPosition.getStatus() === Chess.Position.Status.NORMAL;\n\tvar moves = playing ? this.chessPosition.getMoves() : [];');
  source = replaceOnce(source, '\n\t$(Chess.UI.CHESSBOARD_PIECES_AND_SQUARES).removeClass("can-move");', '\n\t$("#moves a.cannot").attr({"aria-disabled": "true", "tabindex": "-1"});\n\n\t$(Chess.UI.CHESSBOARD_PIECES_AND_SQUARES).removeClass("can-move");');
  source = replaceOnce(source, '$("#moves a").click(function() {', '$("#moves a").click(function() {\n\t\tif ($(this).hasClass("cannot")) return false;');
  source = replaceOnce(source, '\n\t});\n};\n\n/**\n * @throws {Error}', '\n\t\treturn false;\n\t});\n};\n\n/**\n * @throws {Error}');
  return replaceOnce(source, 'Chess.UI.prototype.doComputerMove = function() {', 'Chess.UI.prototype.doComputerMove = function() {\n\tif (this.chessPosition.getStatus() !== Chess.Position.Status.NORMAL) return;');
}
